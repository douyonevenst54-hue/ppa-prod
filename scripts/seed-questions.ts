/**
 * Seed the question pool.
 *
 *   npx tsx --env-file=.env.local scripts/seed-questions.ts
 *   npx tsx --env-file=.env.local scripts/seed-questions.ts --dry
 *
 * Idempotent: questions are matched on their text, so re-running adds only
 * what's new. Safe to run after every edit to data/question-pool.json.
 *
 * Pool questions are stored with contentId NULL. They are never consumed by a
 * single challenge — the daily rotation references them by id, so one question
 * can appear in many days without being locked to one Content row.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Category, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

interface PoolQuestion {
  text: string;
  options: string[];
  correctAnswer: string;
}

type Pool = Record<string, Record<string, PoolQuestion[]>>;

async function main() {
  const path = join(process.cwd(), "data", "question-pool.json");
  const pool = JSON.parse(readFileSync(path, "utf8")) as Pool;

  let created = 0;
  let skipped = 0;
  let invalid = 0;

  for (const [category, byDifficulty] of Object.entries(pool)) {
    for (const [difficulty, questions] of Object.entries(byDifficulty)) {
      for (const q of questions) {
        // Validate before writing. A question whose correctAnswer isn't among
        // its options is unanswerable — it would mark every player wrong and
        // cost them reputation they earned.
        if (!q.options.includes(q.correctAnswer)) {
          console.error(`INVALID  ${category}/${difficulty}: correctAnswer not in options — ${q.text}`);
          invalid++;
          continue;
        }
        if (new Set(q.options).size !== q.options.length) {
          console.error(`INVALID  ${category}/${difficulty}: duplicate options — ${q.text}`);
          invalid++;
          continue;
        }

        const existing = await prisma.question.findFirst({
          where: { text: q.text },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        if (!DRY) {
          await prisma.question.create({
            data: {
              text: q.text,
              options: q.options,
              correctAnswer: q.correctAnswer,
              category: category as Category,
              difficulty: difficulty as Difficulty,
              qualityScore: 100, // hand-checked
            },
          });
        }
        created++;
      }
    }
  }

  const total = await prisma.question.count();

  console.log(
    `\n${DRY ? "[dry run] " : ""}${created} created, ${skipped} already present, ${invalid} invalid`,
  );
  console.log(`Pool now holds ${total} questions.\n`);

  const byCat = await prisma.question.groupBy({
    by: ["category", "difficulty"],
    _count: true,
    orderBy: [{ category: "asc" }, { difficulty: "asc" }],
  });
  for (const row of byCat) {
    console.log(`  ${row.category.padEnd(10)} ${row.difficulty.padEnd(8)} ${row._count}`);
  }
  console.log("");

  process.exit(invalid > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
