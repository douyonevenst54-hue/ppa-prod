/**
 * Ledger verification.
 *
 *   npx tsx scripts/verify-ledger.ts            # every user
 *   npx tsx scripts/verify-ledger.ts <piUserId> # one user
 *
 * ── WHY THIS FILE WAS REPLACED ────────────────────────────────────────────
 *
 * The previous version used a verifier I wrote before I had seen yours, in
 * src/lib/ppa/ledger.ts. It reported all 19 chains BROKEN with "missing hashed
 * field" — which was a bug in the verifier, not in the data.
 *
 * Two mistakes in it:
 *
 *   1. It treated a null `idempotencyKey` as a missing field. Snapshot rows
 *      have no idempotency key by design, so every chain failed at its own
 *      genesis row. That's why the reported break indices were 0 for users with
 *      one row, and 115 / 42 for the two accounts with long histories — it was
 *      finding the snapshot wherever it happened to sit.
 *   2. It read every PPATransaction row, including the pre-chain legacy ones
 *      written by the old direct-balance paths.
 *
 * Your `verifyUserChain` gets both right: it filters on `rowHash: { not: null }`
 * and folds a null idempotencyKey into the hash as null. It also checks running
 * balance against User.ppaBalance, which mine didn't do at all.
 *
 * So this script is now a thin runner over yours. Delete these when convenient
 * — nothing imports them any more:
 *     src/lib/ppa/ledger.ts
 *     test/gate.test.mjs        (tests the superseded canonicalisation)
 */

import { PrismaClient } from "@prisma/client";
import { verifyUserChain } from "../src/lib/ledger";

const prisma = new PrismaClient();

async function main() {
  const target = process.argv[2];

  const users = target
    ? await prisma.user.findMany({
        where: { piUserId: target },
        select: { piUserId: true, username: true, ppaBalance: true },
      })
    : await prisma.user.findMany({
        select: { piUserId: true, username: true, ppaBalance: true },
        orderBy: { createdAt: "asc" },
      });

  if (users.length === 0) {
    console.error(target ? `no user with piUserId ${target}` : "no users");
    process.exit(1);
  }

  let broken = 0;

  for (const user of users) {
    const result = await verifyUserChain(prisma, user.piUserId);
    const name = user.username.padEnd(18);

    if (result.ok) {
      console.log(
        `ok      ${name} ${String(result.rowCount).padStart(4)} chained rows  balance ${user.ppaBalance}`,
      );
    } else {
      broken++;
      console.error(`BROKEN  ${name} row ${result.brokenAt}: ${result.reason}`);
    }
  }

  console.log(`\n${users.length - broken}/${users.length} chains verified`);
  process.exit(broken > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
