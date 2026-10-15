/**
 * Make the hand-checked pool win over generated twins.
 *
 *   npx tsx --env-file=.env.local scripts/reclaim-pool.ts
 *   npx tsx --env-file=.env.local scripts/reclaim-pool.ts --apply
 *
 * ── THE BUG THIS FIXES ────────────────────────────────────────────────────
 *
 * seed-questions.ts skips any question whose text already exists, so that
 * re-running it is idempotent. That was right for re-runs and wrong for the
 * first run: where a generated question already had the same text as one in
 * data/question-pool.json, the generated one won and the hand-checked version
 * was never inserted.
 *
 * The generated copy is exactly the one whose answer key is unverified. So the
 * seeder quietly preferred the unverified answer over the checked one, for
 * precisely the questions where both existed.
 *
 * This reverses that: for every question text present in the pool file, any
 * row that isn't hand-checked is quarantined (qualityScore -1, never deleted),
 * and the pool version is inserted if it's missing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Category, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const HAND_CHECKED = 100;

interface PoolQuestion {
  text: string;
  options: string[];
  correctAnswer: string;
}
type Pool = Record<string, Record<string, PoolQuestion[]>>;

async function main() {
  const pool = JSON.parse(
    readFileSync(join(process.cwd(), "data", "question-pool.json"), "utf8"),
  ) as Pool;

  // Flatten the pool file, keyed by normalised text.
  const wanted = new Map<
    string,
    PoolQuestion & { category: string; difficulty: string }
  >();
  for (const [category, byDifficulty] of Object.entries(pool)) {
    for (const [difficulty, questions] of Object.entries(byDifficulty)) {
      for (const q of questions) {
        wanted.set(q.text.trim().toLowerCase(), { ...q, category, difficulty });
      }
    }
  }

  const rows = await prisma.question.findMany({
    select: {
      id: true,
      text: true,
      qualityScore: true,
      correctAnswer: true,
      category: true,
      difficulty: true,
    },
  });

  const toQuarantine: string[] = [];
  const toInsert: string[] = [];
  const disagreements: string[] = [];

  const haveHandChecked = new Set(
    rows
      .filter((r) => r.qualityScore === HAND_CHECKED)
      .map((r) => r.text.trim().toLowerCase()),
  );

  for (const row of rows) {
    const key = row.text.trim().toLowerCase();
    const poolVersion = wanted.get(key);
    if (!poolVersion) continue;                       // not a pool question
    if (row.qualityScore === HAND_CHECKED) continue;  // already the good one

    toQuarantine.push(row.id);

    // The interesting case: the generated row disagrees with the checked
    // answer. That's a question that has been scoring players wrongly.
    if (row.correctAnswer !== poolVersion.correctAnswer) {
      disagreements.push(
        `  "${row.text.slice(0, 58)}"\n` +
          `     generated says: ${row.correctAnswer}\n` +
          `     checked says:   ${poolVersion.correctAnswer}`,
      );
    }
  }

  for (const [key, q] of wanted) {
    if (!haveHandChecked.has(key)) toInsert.push(key);
  }

  console.log(`\nRECLAIM POOL`);
  console.log("─".repeat(70));
  console.log(`  ${toQuarantine.length} generated twin(s) to quarantine`);
  console.log(`  ${toInsert.length} pool question(s) missing from the database`);

  if (disagreements.length > 0) {
    console.log(
      `\n  ${disagreements.length} ANSWER-KEY DISAGREEMENT(S) — these have been marking players wrong:\n`,
    );
    console.log(disagreements.join("\n\n"));
    console.log("");
  } else {
    console.log(`\n  No answer-key disagreements among the overlapping questions.`);
  }

  if (!APPLY) {
    console.log(`\n  Dry run. Re-run with --apply.\n`);
    return;
  }

  if (toQuarantine.length > 0) {
    const { count } = await prisma.question.updateMany({
      where: { id: { in: toQuarantine } },
      data: { qualityScore: -1 },
    });
    console.log(`\n  Quarantined ${count} generated twin(s).`);
  }

  let inserted = 0;
  for (const key of toInsert) {
    const q = wanted.get(key)!;
    await prisma.question.create({
      data: {
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        category: q.category as Category,
        difficulty: q.difficulty as Difficulty,
        qualityScore: HAND_CHECKED,
      },
    });
    inserted++;
  }

  const live = await prisma.question.count({ where: { qualityScore: { gte: 0 } } });
  console.log(`  Inserted ${inserted} hand-checked question(s).`);
  console.log(`  ${live} questions now in rotation.\n`);
}

main().finally(() => prisma.$disconnect());
