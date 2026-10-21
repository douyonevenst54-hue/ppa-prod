/**
 * Give existing players the tier their record already earned.
 *
 *   npx tsx --env-file=.env scripts/backfill-tiers.ts
 *   npx tsx --env-file=.env scripts/backfill-tiers.ts --apply
 *
 * `tier` was set to NEWCOMER at signup and never written again, so everyone
 * who played before promotion existed is still on the bottom rung of a
 * five-step reward multiplier. Promotion now happens on submission, but it
 * only looks forward — without this, a player with a hundred questions behind
 * them would have to answer a hundred more to be recognised for the first
 * hundred.
 *
 * Only promotes. If a stored tier is already higher than the numbers justify
 * — the seeded ELITE account, say — it is left alone and reported.
 */

import { PrismaClient } from "@prisma/client";
import { nextTier, tierFor, challengeAccuracy, rankOf } from "../src/lib/ppa/tiers";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      username: true,
      tier: true,
      totalChallenges: true,
      correctChallenges: true,
    },
    orderBy: { totalChallenges: "desc" },
  });

  const moves: {
    id: string;
    username: string;
    from: string;
    to: string;
    answered: number;
    accuracy: number;
  }[] = [];
  const above: string[] = [];

  for (const u of users) {
    const to = nextTier(u.tier, u.correctChallenges, u.totalChallenges);
    const earned = tierFor(u.correctChallenges, u.totalChallenges);

    if (rankOf(u.tier) > rankOf(earned)) {
      above.push(`${u.username}: holds ${u.tier}, numbers say ${earned}`);
    }
    if (to === u.tier) continue;

    moves.push({
      id: u.id,
      username: u.username,
      from: u.tier,
      to,
      answered: u.totalChallenges,
      accuracy: challengeAccuracy(u.correctChallenges, u.totalChallenges),
    });
  }

  console.log(`\nBACKFILL TIERS`);
  console.log("─".repeat(70));
  console.log(`  ${users.length} player(s) examined`);

  if (moves.length === 0) {
    console.log(`\n  Nobody is due a promotion.\n`);
  } else {
    console.log(`\n  ${moves.length} promotion(s):\n`);
    for (const m of moves) {
      console.log(
        `    ${m.username.padEnd(20)} ${m.from.padEnd(9)} → ${m.to.padEnd(9)}` +
          `  ${String(m.answered).padStart(5)} answered at ${Math.round(m.accuracy * 100)}%`,
      );
    }
  }

  if (above.length > 0) {
    console.log(`\n  ${above.length} holding a tier above their record — left alone:`);
    for (const a of above) console.log(`    ${a}`);
  }

  if (!APPLY) {
    console.log(`\n  Dry run. Re-run with --apply.\n`);
    return;
  }

  if (moves.length > 0) {
    await prisma.$transaction(
      moves.map((m) =>
        prisma.user.update({
          where: { id: m.id },
          data: { tier: m.to as never },
        }),
      ),
    );
  }

  console.log(`\n  Applied ${moves.length} promotion(s).\n`);
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
