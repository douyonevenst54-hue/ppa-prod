/**
 * Bulk-import questions from a spreadsheet.
 *
 *   npx tsx --env-file=.env scripts/import-questions.ts --template
 *   npx tsx --env-file=.env scripts/import-questions.ts data/question-batch-002.csv
 *   npx tsx --env-file=.env scripts/import-questions.ts data/question-batch-002.csv --apply
 *
 * ── WHY THIS IS THE REPLENISHMENT PATH ────────────────────────────────────
 *
 * The pool is the ceiling on how long the app can go without repeating
 * itself: at five questions a day, 36 live questions per difficulty is seven
 * days. Raising that means adding verified questions, and the only way that
 * happens regularly is if adding fifty of them is an evening's work rather
 * than a project. So: author in a spreadsheet, run this, read the report.
 *
 * Imported questions land at qualityScore 100 — hand-checked — because
 * everything in a file you wrote has been through a person. Pass --review to
 * land them at -2 instead, which keeps them out of rotation until they are
 * approved through review-pool.ts; that is the setting to use for anything
 * generated or copied from a source you have not checked line by line.
 *
 * ── WHAT IT REFUSES ───────────────────────────────────────────────────────
 *
 * A question whose answer key is not one of its options is unanswerable, and
 * a duplicate dilutes the rotation while looking like growth. Both are
 * rejected with the row number, and nothing is written unless every row
 * passes — a half-imported batch is worse than none, because you cannot tell
 * by looking which half arrived.
 *
 * Accepts .csv or .json. CSV columns, in any order:
 *
 *   text, answer_key, options, category, difficulty
 *
 * `options` is pipe-separated ("Paris | Rome | Madrid | Berlin"), which is
 * what review-pool.ts exports, so a reviewed file can come straight back in.
 * option_a / option_b / option_c / option_d work too, if that is easier to
 * type in a spreadsheet.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv, toCsv, headerIndex, requireColumns } from "../src/lib/csv";
import {
  QUESTION_CATEGORIES,
  QUESTION_DIFFICULTIES,
  type IncomingQuestion,
  normalizeQuestionText as norm,
  validateIncoming,
  findDuplicates,
  flattenQuestionJson,
} from "../src/lib/ppa/question-import";

const prisma = new PrismaClient();

const HAND_CHECKED = 100;
const AWAITING_REVIEW = -2;
const QUESTIONS_PER_CHALLENGE = 5;

const CATEGORIES = [...QUESTION_CATEGORIES];
const DIFFICULTIES = [...QUESTION_DIFFICULTIES];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const REVIEW = args.includes("--review");
const TEMPLATE = args.includes("--template");
const file = args.find((a) => !a.startsWith("--"));

type Incoming = IncomingQuestion;

/* ------------------------------------------------------------------ */

function writeTemplate() {
  const out = "data/question-template.csv";
  writeFileSync(
    out,
    toCsv(
      ["text", "answer_key", "options", "category", "difficulty"],
      [
        [
          "What is the capital of Haiti?",
          "Port-au-Prince",
          "Port-au-Prince | Cap-Haïtien | Jacmel | Gonaïves",
          "GENERAL",
          "EASY",
        ],
        [
          "What does APR stand for?",
          "Annual Percentage Rate",
          "Annual Percentage Rate | Average Payment Ratio | Applied Principal Return | Annual Payment Reduction",
          "FINANCE",
          "MEDIUM",
        ],
      ],
    ),
    "utf8",
  );
  console.log(`\nTemplate written to ${out}`);
  console.log(`  Categories:   ${CATEGORIES.join(", ")}`);
  console.log(`  Difficulties: ${DIFFICULTIES.join(", ")}`);
  console.log(`  options is pipe-separated; answer_key must be one of them.\n`);
}

function readRows(path: string): Incoming[] {
  const raw = readFileSync(path, "utf8");

  // data/question-pool.json is nested by category and difficulty, not a flat
  // array — reading it as one silently produced nothing.
  if (path.endsWith(".json")) return flattenQuestionJson(JSON.parse(raw));

  const table = parseCsv(raw);
  if (table.length < 2) throw new Error(`${path} has a header but no rows`);

  const index = headerIndex(table[0]);
  const hasSplitOptions = index.has("option_a") && index.has("option_b");

  const missing = requireColumns(index, [
    "text",
    "answer_key",
    "category",
    "difficulty",
    ...(hasSplitOptions ? [] : ["options"]),
  ]);
  if (missing.length > 0) {
    throw new Error(`${path} is missing column(s): ${missing.join(", ")}`);
  }

  const cell = (r: string[], name: string) => (r[index.get(name)!] ?? "").trim();

  return table.slice(1).map((r, i) => ({
    row: i + 2, // +2: 1-based, and the header is row 1
    text: cell(r, "text"),
    options: hasSplitOptions
      ? ["option_a", "option_b", "option_c", "option_d"]
          .filter((k) => index.has(k))
          .map((k) => cell(r, k))
          .filter(Boolean)
      : cell(r, "options")
          .split("|")
          .map((o) => o.trim())
          .filter(Boolean),
    correctAnswer: cell(r, "answer_key"),
    category: cell(r, "category").toUpperCase(),
    difficulty: cell(r, "difficulty").toUpperCase(),
  }));
}

async function runway() {
  const cells = await prisma.question.groupBy({
    by: ["category", "difficulty"],
    where: { qualityScore: { gte: 0 } },
    _count: { id: true },
  });

  console.log(`\n  POOL RUNWAY — days before a question repeats`);
  console.log("  " + "─".repeat(66));

  for (const difficulty of DIFFICULTIES) {
    const inTier = cells.filter((c) => c.difficulty === difficulty);
    const total = inTier.reduce((n, c) => n + c._count.id, 0);
    const thinnest = inTier.reduce(
      (min, c) => (c._count.id < min.n ? { name: String(c.category), n: c._count.id } : min),
      { name: "—", n: Infinity },
    );

    const mixedDays = Math.floor(total / QUESTIONS_PER_CHALLENGE);
    const themedDays = Math.floor(
      (thinnest.n === Infinity ? 0 : thinnest.n) / QUESTIONS_PER_CHALLENGE,
    );

    console.log(
      `  ${difficulty.padEnd(7)} ${String(total).padStart(4)} live   ` +
        `mixed day: ${String(mixedDays).padStart(2)}d   ` +
        `thinnest cell: ${thinnest.name} (${thinnest.n === Infinity ? 0 : thinnest.n}) → ${themedDays}d`,
    );

    const missing = CATEGORIES.filter(
      (c) => !inTier.some((x) => String(x.category) === c),
    );
    if (missing.length > 0) {
      console.log(`          no questions at all in: ${missing.join(", ")}`);
    }
  }

  console.log(
    `\n  A themed day draws from one cell, so the thinnest cell is the one\n` +
      `  that repeats first. Roughly 150 per difficulty gets you a month.\n`,
  );
}

async function main() {
  if (TEMPLATE) {
    writeTemplate();
    return;
  }

  if (!file) {
    console.log(`
Bulk-import questions from a spreadsheet.

  --template              write data/question-template.csv
  <file.csv|file.json>    check a batch and report (changes nothing)
  <file> --apply          insert it
  <file> --apply --review land it benched, awaiting human review

Current pool runway:`);
    await runway();
    return;
  }

  const rows = readRows(file);

  // ── ONLY QUESTIONS THAT CAN ACTUALLY BE SERVED COUNT AS DUPLICATES ──────
  //
  // Comparing against every row meant a benched question blocked a verified
  // one. A question awaiting review (-2) or rejected (-1) never reaches a
  // player, so if it is the only copy of that question the question is simply
  // absent — and skipping the hand-checked import on its account left it
  // absent. That is the same fault as the original seeder, which preferred a
  // generated answer over a hand-checked one because the text already existed.
  const live = await prisma.question.findMany({
    where: { qualityScore: { gte: 0 } },
    select: { text: true },
  });
  const existingTexts = new Set(live.map((q) => norm(q.text)));

  // Reported separately: these are being imported *despite* a benched twin,
  // which is the intended outcome but worth seeing.
  const benched = await prisma.question.findMany({
    where: { qualityScore: { lt: 0 } },
    select: { text: true },
  });
  const benchedTexts = new Set(benched.map((q) => norm(q.text)));

  const problems = validateIncoming(rows);

  console.log(`\nIMPORT — ${file}`);
  console.log("─".repeat(70));
  console.log(`  ${rows.length} row(s) read`);

  if (problems.length > 0) {
    console.log(`\n  ${problems.length} problem(s). Nothing was written:\n`);
    for (const p of problems.slice(0, 40)) console.log(`    ${p}`);
    if (problems.length > 40) console.log(`    … and ${problems.length - 40} more`);
    console.log("");
    process.exitCode = 1;
    return;
  }

  // Duplicates are skipped, not fatal: re-importing an edited file is the
  // normal way this gets used.
  const dupes = findDuplicates(rows, existingTexts);
  const skip = new Set(dupes.map((d) => d.row));
  const fresh = rows.filter((q) => !skip.has(q.row));

  if (dupes.length > 0) {
    console.log(`\n  ${dupes.length} already known, will be skipped:`);
    for (const d of dupes.slice(0, 15)) {
      console.log(
        `    row ${String(d.row).padStart(4)}  ${d.reason}` +
          `${d.firstSeenAtRow ? ` (row ${d.firstSeenAtRow})` : ""}  — ${d.text.slice(0, 48)}`,
      );
    }
    if (dupes.length > 15) console.log(`    … and ${dupes.length - 15} more`);
  }

  const replacingBenched = fresh.filter((q) => benchedTexts.has(norm(q.text)));
  if (replacingBenched.length > 0) {
    console.log(
      `\n  ${replacingBenched.length} of these also exist as a benched copy, which` +
        `\n  cannot be served — importing the checked version puts the question` +
        `\n  back into rotation:`,
    );
    for (const q of replacingBenched.slice(0, 10)) {
      console.log(`    row ${String(q.row).padStart(4)}  ${q.text.slice(0, 56)}`);
    }
    if (replacingBenched.length > 10) {
      console.log(`    … and ${replacingBenched.length - 10} more`);
    }
  }

  if (fresh.length === 0) {
    console.log(`\n  Nothing new in this file.\n`);
    await runway();
    return;
  }

  const byCell = new Map<string, number>();
  for (const q of fresh) {
    const k = `${q.category}/${q.difficulty}`;
    byCell.set(k, (byCell.get(k) ?? 0) + 1);
  }

  console.log(`\n  ${fresh.length} new question(s). Distribution:\n`);
  for (const [cell, n] of [...byCell.entries()].sort()) {
    console.log(`    ${cell.padEnd(18)} ${n}`);
  }

  if (!APPLY) {
    console.log(`\n  Dry run. Re-run with --apply to insert.`);
    await runway();
    return;
  }

  const qualityScore = REVIEW ? AWAITING_REVIEW : HAND_CHECKED;

  const { count } = await prisma.question.createMany({
    data: fresh.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: q.category as never,
      difficulty: q.difficulty as never,
      qualityScore,
    })),
  });

  console.log(
    `\n  Inserted ${count} question(s) at qualityScore ${qualityScore}` +
      `${REVIEW ? " — benched until reviewed" : ""}.`,
  );

  await runway();
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
