/**
 * Close the demo challenges that shipped in src/lib/seed.ts.
 *
 *   npx tsx --env-file=.env scripts/retire-seed-challenges.ts
 *   npx tsx --env-file=.env scripts/retire-seed-challenges.ts --apply
 *
 * ── WHAT THESE ARE ────────────────────────────────────────────────────────
 *
 * seed.ts creates a handful of Content rows with ids like
 * "seed_chal_Tech_IQ", each holding fixed questions, status ACTIVE and an
 * endsAt far enough out that they never expire. They were demo data for an
 * empty database and they worked — but they then sat at the top of the Play
 * tab for months, showing the same five questions, which is what "the
 * challenge button returns to the old draft question and never changes"
 * was describing.
 *
 * The API now filters them out, so this script is not required to fix the
 * screen. It exists to close them properly in the database rather than
 * leaving rows that are live but hidden, which is the kind of difference
 * that bites later.
 *
 * ── WHY STATUS, NOT DELETE ────────────────────────────────────────────────
 *
 * Deleting them would orphan any ChallengeResult a player earned on them and
 * break the ledger entries those results justify. Setting status and pulling
 * endsAt back to now retires them by the same rules every other finished
 * challenge follows.
 *
 * Their questions carry contentId, and the daily rotation now excludes
 * anything with a contentId, so they are already out of the daily pool.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const PREFIX = "seed_chal_";

async function main() {
  const seeded = await prisma.content.findMany({
    where: { id: { startsWith: PREFIX } },
    select: {
      id: true,
      title: true,
      status: true,
      endsAt: true,
      _count: { select: { questions: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`\nSEEDED DEMO CHALLENGES`);
  console.log("─".repeat(72) + "\n");

  if (seeded.length === 0) {
    console.log("  None found. Nothing to do.\n");
    return;
  }

  let liveCount = 0;
  for (const c of seeded) {
    const isLive = c.status === "ACTIVE" && c.endsAt > new Date();
    if (isLive) liveCount++;
    console.log(
      `  ${isLive ? "live " : "done "}  ${c.id.padEnd(28)} ${c.title.padEnd(18)} ${c._count.questions} questions`,
    );
  }

  console.log(`\n  ${liveCount} of ${seeded.length} still live.`);

  if (liveCount === 0) {
    console.log("  Already retired.\n");
    return;
  }

  if (!APPLY) {
    console.log(`
  Dry run. With --apply these are marked ARCHIVED with endsAt set to now.
  Questions and past results are left exactly as they are.
`);
    return;
  }

  const now = new Date();
  const result = await prisma.content.updateMany({
    where: { id: { startsWith: PREFIX }, status: "ACTIVE" },
    data: { status: "ARCHIVED", endsAt: now },
  });

  console.log(`\n  Retired ${result.count} challenge(s).`);
  console.log(`  Play now opens the daily rotation; the community list shows`);
  console.log(`  only challenges players wrote.\n`);
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
