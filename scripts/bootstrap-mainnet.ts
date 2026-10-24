/**
 * Bring a fresh Mainnet database up to a state worth launching.
 *
 *   npx tsx --env-file=.env.mainnet scripts/bootstrap-mainnet.ts
 *   npx tsx --env-file=.env.mainnet scripts/bootstrap-mainnet.ts --apply
 *
 * Checks the environment, refuses to run against a database that already has
 * players, loads the question pool, and tells you what is left. It does not
 * run migrations — do that first with `npx prisma migrate deploy`, so that a
 * schema change is never a side effect of a seeding script.
 *
 * ── WHY IT REFUSES A POPULATED DATABASE ───────────────────────────────────
 *
 * The one thing that must not happen is pointing this at the testnet database
 * by leaving DATABASE_URL unchanged. That would seed duplicate questions into
 * live data and, worse, mean the Mainnet deployment was quietly sharing
 * testnet balances — which is exactly what starting from zero is meant to
 * prevent. A database with users in it is not a fresh Mainnet database, so
 * this stops.
 */

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

interface Step {
  name: string;
  ok: boolean;
  detail: string;
  fatal?: boolean;
}

const steps: Step[] = [];
const note = (name: string, ok: boolean, detail: string, fatal = false) =>
  steps.push({ name, ok, detail, fatal });

function envCheck() {
  const network = process.env.NEXT_PUBLIC_PI_NETWORK;
  note("Network is mainnet", network === "mainnet", network ?? "unset", true);

  note("PI_API_KEY set", Boolean(process.env.PI_API_KEY),
    process.env.PI_API_KEY ? "set" : "missing — every signed-in request will fail", true);

  const db = process.env.DATABASE_URL ?? "";
  note("DATABASE_URL set", Boolean(db), db ? "set" : "missing", true);

  note("CRON_SECRET set", Boolean(process.env.CRON_SECRET),
    process.env.CRON_SECRET
      ? "set"
      : "missing — the rotation cron stays closed and the first visitor builds the day");

  note("Plaintext keys refused", process.env.PPA_ALLOW_PLAINTEXT_KEYS === "false",
    process.env.PPA_ALLOW_PLAINTEXT_KEYS === "false"
      ? "hashed only"
      : "set PPA_ALLOW_PLAINTEXT_KEYS=false — a fresh database has no legacy keys");

  const retired = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "WALLET_PRIVATE_SEED", "APP_WALLET_ADDRESS"]
    .filter((k) => Boolean(process.env[k]));
  note("No retired secrets", retired.length === 0,
    retired.length === 0 ? "none" : `carried over from testnet: ${retired.join(", ")}`);
}

async function main() {
  envCheck();

  // Is this really an empty database?
  const users = await prisma.user.count();
  const questions = await prisma.question.count();
  const ledgerRows = await prisma.pPATransaction.count();

  const empty = users === 0 && ledgerRows === 0;
  note("Database is fresh", empty,
    empty
      ? "no users, no ledger entries"
      : `${users} user(s), ${ledgerRows} ledger row(s) — this is NOT a new database`,
    true);

  console.log(`\nBOOTSTRAP MAINNET`);
  console.log("─".repeat(72) + "\n");
  for (const s of steps) {
    console.log(`  ${s.ok ? "ok  " : s.fatal ? "STOP" : "warn"}  ${s.name.padEnd(26)} ${s.detail}`);
  }

  const blocked = steps.filter((s) => s.fatal && !s.ok);
  if (blocked.length > 0) {
    console.log(`\n  Stopped. Fix: ${blocked.map((b) => b.name).join(", ")}\n`);
    if (!empty) {
      console.log(`  If DATABASE_URL still points at testnet, that is the bug.`);
      console.log(`  Starting Mainnet from zero is the whole point — testnet PPA`);
      console.log(`  was bought with Test-Pi.\n`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\n  ${questions} question(s) currently in this database.`);

  if (!APPLY) {
    console.log(`
  Dry run. With --apply this will load the question pool.

  Before that, make sure the schema exists:
      npx prisma migrate deploy
`);
    return;
  }

  // Seeding runs through the existing importer so the same validation applies:
  // every answer key must be one of its options, nothing duplicated.
  const files = [
    "data/question-pool.json",
    "data/question-batch-002.csv",
    "data/question-batch-003.csv",
  ];
  for (const f of files) {
    console.log(`\n  Loading ${f} …`);
    try {
      execFileSync(
        "npx",
        ["tsx", "scripts/import-questions.ts", f, "--apply"],
        { stdio: "inherit", env: process.env },
      );
    } catch {
      console.log(`  ${f} did not import cleanly — see the output above.`);
      process.exitCode = 1;
      return;
    }
  }

  const after = await prisma.question.count({ where: { qualityScore: { gte: 0 } } });
  console.log(`\n  ${after} question(s) in rotation.\n`);
  console.log(`  Next:
    - add directory listings:  scripts/listings.ts add --file data/my-apps.json --apply
    - verify the whole thing:  scripts/preflight.ts
    - play one full round in Pi Browser before telling anyone it is live
`);
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
