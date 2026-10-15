/**
 * Preview the rotation without touching the database.
 *
 *   npx tsx --env-file=.env.local scripts/rotate-check.ts
 *   npx tsx --env-file=.env.local scripts/rotate-check.ts 14
 *
 * Prints the next N days of challenges straight from the selection functions.
 * Read-only — it never writes a DailyChallenge row.
 *
 * ── IT SIMULATES timesServed ──────────────────────────────────────────────
 *
 * The live rotation orders candidates by `timesServed ASC` and that counter
 * goes up every time a question is served, so the ordering changes daily and
 * the pool self-balances. An earlier version of this script fetched the
 * ordering once and reused it for every simulated day, which made the rotation
 * look far worse than it is — on a fresh pool every question has timesServed 0,
 * so the order never changed and the same questions appeared to repeat.
 *
 * It now increments a local counter and re-sorts each day, exactly as the
 * database does. The repeat numbers below are the real ones.
 */

import { PrismaClient } from "@prisma/client";
import {
  DIFFICULTIES,
  categoryForDay,
  selectQuestionIds,
  challengeTitle,
  QUESTIONS_PER_CHALLENGE,
} from "../src/lib/ppa/daily-challenge";

const prisma = new PrismaClient();
const DAYS = Number(process.argv[2] ?? 7);

async function main() {
  const all = await prisma.question.findMany({
    orderBy: [{ timesServed: "asc" }, { id: "asc" }],
    select: { id: true, text: true, category: true, difficulty: true },
  });

  if (all.length === 0) {
    console.error("Pool is empty — run scripts/seed-questions.ts first.");
    process.exit(1);
  }

  const seen = new Map<string, number>();
  // Local mirror of Question.timesServed, incremented as the live rotation does.
  const served = new Map<string, number>(all.map((q) => [q.id, 0]));

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(Date.now() + d * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    console.log(`\n${key}`);

    for (const difficulty of DIFFICULTIES) {
      // null category = a mixed day, drawing from every category at this level.
      const category = categoryForDay(key, difficulty);
      const candidates = all
        .filter(
          (q) =>
            q.difficulty === difficulty &&
            (category === null || q.category === category),
        )
        // ORDER BY timesServed ASC, id ASC — the same ordering the live query uses.
        .sort(
          (a, b) =>
            (served.get(a.id) ?? 0) - (served.get(b.id) ?? 0) ||
            (a.id < b.id ? -1 : 1),
        );

      if (candidates.length < QUESTIONS_PER_CHALLENGE) {
        console.log(
          `  ${difficulty.padEnd(7)} ${challengeTitle(category as never, difficulty).padEnd(22)} ` +
            `SKIPPED — only ${candidates.length} questions in ${category ?? "MIXED"}/${difficulty}`,
        );
        continue;
      }

      const picked = selectQuestionIds(
        key,
        difficulty,
        candidates.map((c) => c.id),
      );
      for (const id of picked) {
        seen.set(id, (seen.get(id) ?? 0) + 1);
        served.set(id, (served.get(id) ?? 0) + 1);
      }

      console.log(
        `  ${difficulty.padEnd(7)} ${challengeTitle(category as never, difficulty).padEnd(22)} ${picked.length} questions`,
      );
    }
  }

  // How much of the pool gets used, and how hard it repeats.
  const used = seen.size;
  const repeats = [...seen.values()].filter((n) => n > 1).length;
  const worst = Math.max(0, ...seen.values());

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${DAYS} days · ${used}/${all.length} questions used`);
  console.log(`  ${repeats} question(s) repeated, most-used appears ${worst}×`);
  // One serve per ~N/(slots) days is normal. Flag only genuine starvation.
  const slots = DAYS * 3 * 5;
  const expected = Math.ceil(slots / Math.max(1, all.length));
  if (worst > expected * 2) {
    console.log(
      `\n  Expected about ${expected}× per question over ${DAYS} days; the most-used\n` +
        `  appears ${worst}×. That category/difficulty is thin — add more to\n` +
        `  data/question-pool.json and re-seed.`,
    );
  }
  console.log("");
}

main().finally(() => prisma.$disconnect());
