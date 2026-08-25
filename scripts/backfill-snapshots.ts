/**
 * Lay the genesis snapshot row for every existing user.
 *
 *   npx tsx scripts/backfill-snapshots.ts
 *
 * Run this ONCE, before the new write paths go live.
 *
 * Why it's needed: `appendLedgerEntry` chains from the previous row, and the
 * first row has to come from somewhere. The old code threw MISSING_SNAPSHOT
 * when there was none — which is why no user had a chain and every write path
 * fell back to mutating ppaBalance directly. The patched ledger creates the
 * snapshot inline on first append, so this script isn't strictly required, but
 * running it means `verifyUserChain` is meaningful for all 19 users from day
 * one instead of only after each user's next transaction.
 *
 * It is idempotent. Running it twice is a no-op.
 */

import { PrismaClient } from "@prisma/client";
import { ensureUserSnapshot, verifyUserChain } from "../src/lib/ledger";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { piUserId: true, username: true, ppaBalance: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await ensureUserSnapshot(prisma, user.piUserId);
      if (result.created) {
        created++;
        console.log(
          `snapshot  ${user.username.padEnd(18)} balance ${String(user.ppaBalance).padStart(8)}  ${result.rowHash.slice(0, 12)}…`,
        );
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      console.error(`FAILED    ${user.username}:`, (err as Error).message);
    }
  }

  console.log(`\n${created} created, ${skipped} already had one, ${failed} failed`);

  // Verify immediately — a snapshot that doesn't verify is worse than none.
  console.log("\nverifying:");
  let broken = 0;
  for (const user of users) {
    const check = await verifyUserChain(prisma, user.piUserId);
    if (!check.ok) {
      broken++;
      console.error(`BROKEN    ${user.username}: ${check.reason}`);
    }
  }
  console.log(
    broken === 0
      ? `all ${users.length} chains verify`
      : `${broken} of ${users.length} chains broken`,
  );

  process.exit(failed > 0 || broken > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
