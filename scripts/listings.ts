/**
 * Manage the ecosystem directory from the terminal.
 *
 *   npx tsx --env-file=.env scripts/listings.ts
 *   npx tsx --env-file=.env scripts/listings.ts pending
 *   npx tsx --env-file=.env scripts/listings.ts add --name "LoPiPo" \
 *       --tagline "Local Pi points for neighbourhood shops" \
 *       --url https://lopipo.app --category MARKETPLACE --apply
 *   npx tsx --env-file=.env scripts/listings.ts add --file data/my-apps.json --apply
 *   npx tsx --env-file=.env scripts/listings.ts approve <id>
 *   npx tsx --env-file=.env scripts/listings.ts reject <id> "not reachable"
 *
 * ── WHY A SCRIPT AND NOT CURL ─────────────────────────────────────────────
 *
 * The admin API needs a Pi bearer token, and that token lives in Pi Browser's
 * memory. There is no reasonable way to get it into a terminal, so the curl
 * command suggested for this was unusable. This talks to the database the same
 * way the other admin scripts do.
 *
 * It also closes a gap: /api/ecosystem/apps/review exists but nothing in the
 * app calls it, so until there is a review screen this is how a submission
 * gets approved.
 *
 * Submissions are validated with the same validateListing the API uses, so a
 * link added here is held to the same standard as one a stranger submits —
 * https only, no embedded credentials, no schemes that can execute.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import {
  validateListing,
  LISTING_CATEGORIES,
  type ListingInput,
} from "../src/lib/ecosystem/listing";

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const command = argv[0] ?? "show";
const APPLY = argv.includes("--apply");

function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

const DECISION_LABEL: Record<string, string> = {
  APPROVED: "live",
  PENDING: "waiting for review",
  REJECTED: "rejected",
  HIDDEN: "hidden",
};

/* ------------------------------------------------------------------ */

async function show() {
  const all = await prisma.ecosystemListing.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, url: true, category: true, status: true },
  });

  console.log(`\nECOSYSTEM DIRECTORY`);
  console.log("─".repeat(74));

  if (all.length === 0) {
    console.log(`  Nothing listed yet.\n`);
    console.log(`  Add your own:`);
    console.log(`    npx tsx --env-file=.env scripts/listings.ts add \\`);
    console.log(`      --name "LoPiPo" --tagline "What it does, in one line" \\`);
    console.log(`      --url https://lopipo.app --category MARKETPLACE --apply\n`);
    console.log(`  Categories: ${LISTING_CATEGORIES.join(", ")}\n`);
    return;
  }

  for (const l of all) {
    console.log(
      `  ${(DECISION_LABEL[l.status] ?? l.status).padEnd(18)} ${l.name.padEnd(24)} ${l.category.padEnd(12)} ${l.url}`,
    );
  }

  const live = all.filter((l) => l.status === "APPROVED").length;
  const waiting = all.filter((l) => l.status === "PENDING").length;
  console.log(`\n  ${live} live · ${waiting} waiting for review\n`);
  if (waiting > 0) {
    console.log(`  Review them:  npx tsx --env-file=.env scripts/listings.ts pending\n`);
  }
}

async function pending() {
  const rows = await prisma.ecosystemListing.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      url: true,
      category: true,
      submittedAt: true,
      submittedBy: { select: { username: true } },
    },
  });

  console.log(`\nWAITING FOR REVIEW`);
  console.log("─".repeat(74));

  if (rows.length === 0) {
    console.log(`  Nothing waiting.\n`);
    return;
  }

  for (const r of rows) {
    console.log(`\n  ${r.name}  [${r.category}]`);
    console.log(`    ${r.tagline}`);
    console.log(`    ${r.url}`);
    console.log(
      `    from ${r.submittedBy?.username ?? "(deleted account)"} on ${r.submittedAt.toISOString().slice(0, 10)}`,
    );
    console.log(`    approve: npx tsx --env-file=.env scripts/listings.ts approve ${r.id}`);
    console.log(`    reject:  npx tsx --env-file=.env scripts/listings.ts reject ${r.id} "reason"`);
  }

  console.log(
    `\n  ${rows.length} waiting. Open each link before approving — once it is` +
      `\n  listed, your users will read its presence as your vetting.\n`,
  );
}

async function add() {
  const file = flag("file");

  const inputs: ListingInput[] = file
    ? (JSON.parse(readFileSync(file, "utf8")) as ListingInput[])
    : [
        {
          name: flag("name") ?? "",
          tagline: flag("tagline") ?? "",
          url: flag("url") ?? "",
          category: flag("category") ?? "OTHER",
          logoUrl: flag("logo") ?? null,
        },
      ];

  console.log(`\nADD LISTINGS`);
  console.log("─".repeat(74));

  const ready: { input: ListingInput; clean: NonNullable<ReturnType<typeof validateListing>["clean"]> }[] = [];

  for (const [i, input] of inputs.entries()) {
    const { errors, clean } = validateListing(input);
    if (!clean) {
      console.log(`\n  ✗ ${input.name || `entry ${i + 1}`}`);
      for (const e of errors) console.log(`      ${e}`);
      continue;
    }
    console.log(`\n  ✓ ${clean.name}  [${clean.category}]`);
    console.log(`      ${clean.tagline}`);
    console.log(`      ${clean.url}`);
    ready.push({ input, clean });
  }

  if (ready.length === 0) {
    console.log(`\n  Nothing valid to add.\n`);
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log(`\n  Dry run. Re-run with --apply to add ${ready.length}.\n`);
    return;
  }

  let added = 0;
  for (const { clean } of ready) {
    const clash = await prisma.ecosystemListing.findFirst({
      where: { OR: [{ slug: clean.slug }, { url: clean.url }] },
      select: { name: true },
    });
    if (clash) {
      console.log(`\n  — ${clean.name}: already listed as "${clash.name}"`);
      continue;
    }

    await prisma.ecosystemListing.create({
      data: {
        ...clean,
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: "script",
      },
    });
    added++;
  }

  console.log(`\n  Added ${added}. They are live in /discover now.\n`);
}

async function decide(status: "APPROVED" | "REJECTED" | "HIDDEN") {
  const id = argv[1];
  if (!id) {
    console.log(`\n  Give the listing id. Find it with: scripts/listings.ts pending\n`);
    process.exitCode = 1;
    return;
  }

  const note = argv[2] ? String(argv[2]).slice(0, 500) : null;

  const listing = await prisma.ecosystemListing.update({
    where: { id },
    data: { status, reviewedAt: new Date(), reviewedBy: "script", reviewNote: note },
    select: { name: true, url: true, status: true },
  });

  console.log(`\n  ${listing.name} → ${DECISION_LABEL[listing.status] ?? listing.status}`);
  console.log(`  ${listing.url}\n`);
}

async function main() {
  switch (command) {
    case "pending":
      return pending();
    case "add":
      return add();
    case "approve":
      return decide("APPROVED");
    case "reject":
      return decide("REJECTED");
    case "hide":
      return decide("HIDDEN");
    case "show":
      return show();
    default:
      console.log(`
Manage the ecosystem directory.

  show                 what is listed (default)
  pending              submissions waiting for review
  add --name ... --tagline ... --url ... --category ...   [--apply]
  add --file apps.json                                    [--apply]
  approve <id>
  reject <id> "reason"
  hide <id>

Categories: ${LISTING_CATEGORIES.join(", ")}
`);
  }
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
