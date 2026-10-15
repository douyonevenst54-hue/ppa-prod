/**
 * Quarantine duplicate questions.
 *
 *   npx tsx --env-file=.env.local scripts/dedupe-questions.ts
 *   npx tsx --env-file=.env.local scripts/dedupe-questions.ts --apply
 *
 * When the same question text exists more than once, keep one and set
 * qualityScore to -1 on the rest. The rotation skips anything below 0, so a
 * quarantined question stays in the table without reaching a player.
 *
 * ── WHY QUARANTINE RATHER THAN DELETE ─────────────────────────────────────
 *
 * ChallengeResult rows reference questionId. Deleting a question that has been
 * answered would either fail on the foreign key or strip the record of what a
 * player actually did — and their challenge history is the thing the whole
 * emission gate exists to keep honest. Nothing is deleted here.
 *
 * ── WHICH COPY SURVIVES ───────────────────────────────────────────────────
 *
 * The hand-checked copy (qualityScore 100) wins over a generated one. If both
 * are the same grade, the one with more serves wins, so existing play history
 * stays attached to the live question rather than to the quarantined twin.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const HAND_CHECKED = 100;

async function main() {
  const all = await prisma.question.findMany({
    where: { qualityScore: { gte: 0 } },
    select: {
      id: true,
      text: true,
      qualityScore: true,
      timesServed: true,
      category: true,
      difficulty: true,
    },
  });

  const groups = new Map<string, typeof all>();
  for (const q of all) {
    const key = q.text.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }

  const toQuarantine: typeof all = [];

  for (const [, copies] of groups) {
    if (copies.length < 2) continue;

    const ranked = [...copies].sort((a, b) => {
      const aHand = a.qualityScore === HAND_CHECKED ? 1 : 0;
      const bHand = b.qualityScore === HAND_CHECKED ? 1 : 0;
      if (aHand !== bHand) return bHand - aHand;        // hand-checked first
      if (a.timesServed !== b.timesServed) {
        return b.timesServed - a.timesServed;           // then more history
      }
      return a.id < b.id ? -1 : 1;                      // then stable
    });

    const [keep, ...drop] = ranked;
    console.log(`\n"${keep.text.slice(0, 60)}"`);
    console.log(
      `  keep       ${keep.category}/${keep.difficulty}  quality ${keep.qualityScore}  served ${keep.timesServed}`,
    );
    for (const d of drop) {
      console.log(
        `  quarantine ${d.category}/${d.difficulty}  quality ${d.qualityScore}  served ${d.timesServed}`,
      );
      toQuarantine.push(d);
    }
  }

  if (toQuarantine.length === 0) {
    console.log("\nNo duplicates.\n");
    return;
  }

  if (!APPLY) {
    console.log(
      `\n${toQuarantine.length} duplicate(s) found. Re-run with --apply to quarantine them.\n`,
    );
    return;
  }

  const { count } = await prisma.question.updateMany({
    where: { id: { in: toQuarantine.map((q) => q.id) } },
    data: { qualityScore: -1 },
  });

  const live = await prisma.question.count({ where: { qualityScore: { gte: 0 } } });
  console.log(`\nQuarantined ${count}. ${live} questions remain in rotation.\n`);
}

main().finally(() => prisma.$disconnect());
