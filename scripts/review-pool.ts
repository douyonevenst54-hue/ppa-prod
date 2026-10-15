/**
 * Human review of generated questions.
 *
 *   npx tsx --env-file=.env scripts/review-pool.ts --bench
 *   npx tsx --env-file=.env scripts/review-pool.ts --export
 *   npx tsx --env-file=.env scripts/review-pool.ts --apply question-review.csv
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * A generated question with a wrong answer key is indistinguishable from a
 * correct one until a player answers it right and loses reputation for it.
 * Reputation gates the harder tiers, so that loss is real: someone did the
 * work and the app told them they hadn't. No script can detect this — checking
 * whether an answer is true is the one thing that needs a person.
 *
 * So: bench the unread questions, read them in a spreadsheet, apply the
 * verdicts. The pool runs on the 108 hand-checked questions in the meantime,
 * which is enough for the rotation to cycle without repeating.
 *
 * ── QUALITY SCORES ────────────────────────────────────────────────────────
 *
 *   100  hand-checked, from data/question-pool.json
 *   0..  generated, in rotation
 *    -1  quarantined: duplicate, broken, or rejected on review
 *    -2  awaiting human review
 *
 * The rotation serves qualityScore >= 0, so -1 and -2 never reach a player.
 * Nothing is ever deleted: ChallengeResult rows reference questionId, and a
 * player's history is the record the emission gate exists to keep honest.
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync, readFileSync } from "node:fs";
import { parseCsv, csvRow } from "../src/lib/csv";

const prisma = new PrismaClient();

const HAND_CHECKED = 100;
const REJECTED = -1;
const AWAITING_REVIEW = -2;

const args = process.argv.slice(2);
const BENCH = args.includes("--bench");
const EXPORT = args.includes("--export");
const APPLY_IDX = args.indexOf("--apply");
const APPLY_FILE = APPLY_IDX >= 0 ? args[APPLY_IDX + 1] : null;

function optionsOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through */
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */

async function bench() {
  const { count } = await prisma.question.updateMany({
    where: { qualityScore: { gte: 0, not: HAND_CHECKED } },
    data: { qualityScore: AWAITING_REVIEW },
  });

  const live = await prisma.question.count({
    where: { qualityScore: { gte: 0 } },
  });

  console.log(`\nBENCH UNREAD QUESTIONS`);
  console.log("─".repeat(70));
  console.log(`  ${count} generated question(s) moved to awaiting review.`);
  console.log(`  ${live} hand-checked question(s) remain in rotation.\n`);

  // The rotation needs QUESTIONS_PER_CHALLENGE in the smallest cell it can
  // draw from, so report the thinnest one rather than leaving it to be
  // discovered by a player seeing no challenge.
  const cells = await prisma.question.groupBy({
    by: ["category", "difficulty"],
    where: { qualityScore: { gte: 0 } },
    _count: { id: true },
  });

  const thin = cells.filter((c) => c._count.id < 5);
  if (thin.length > 0) {
    console.log(`  ⚠ ${thin.length} category/difficulty cell(s) below 5:`);
    for (const c of thin) {
      console.log(`      ${c.category}/${c.difficulty}: ${c._count.id}`);
    }
    console.log(`    A themed day on one of these will be skipped.\n`);
  } else {
    console.log(`  All 18 cells hold 5+ questions. Themed days are covered.\n`);
  }
}

async function exportCsv() {
  const rows = await prisma.question.findMany({
    where: {
      // Awaiting review, or generated and still live. Already-rejected (-1)
      // questions are a decision already made, so they stay out of the export.
      OR: [
        { qualityScore: AWAITING_REVIEW },
        { qualityScore: { gte: 0, not: HAND_CHECKED } },
      ],
    },
    orderBy: [{ category: "asc" }, { difficulty: "asc" }, { id: "asc" }],
    select: {
      id: true,
      category: true,
      difficulty: true,
      text: true,
      options: true,
      correctAnswer: true,
      qualityScore: true,
      timesServed: true,
    },
  });

  const header = [
    "verdict",
    "corrected_answer",
    "text",
    "answer_key",
    "options",
    "category",
    "difficulty",
    "served",
    "id",
  ];

  const lines = [csvRow(header)];
  for (const q of rows) {
    lines.push(
      csvRow([
        "", // verdict: ok | bad | fix
        "", // corrected_answer: only when verdict is fix
        q.text,
        q.correctAnswer,
        optionsOf(q.options).join(" | "),
        q.category,
        q.difficulty,
        String(q.timesServed),
        q.id,
      ]),
    );
  }

  const out = "question-review.csv";
  writeFileSync(out, lines.join("\n") + "\n", "utf8");

  console.log(`\nEXPORT FOR REVIEW`);
  console.log("─".repeat(70));
  console.log(`  ${rows.length} question(s) written to ${out}\n`);
  console.log(`  Open it in Excel or Sheets. For each row, read the question`);
  console.log(`  and the answer_key, then put one word in the verdict column:\n`);
  console.log(`    ok    the answer key is correct`);
  console.log(`    bad   wrong, ambiguous, or not worth asking — benched for good`);
  console.log(`    fix   the question is fine but the key is wrong; put the`);
  console.log(`          right option in corrected_answer\n`);
  console.log(`  Leave verdict blank to decide later; blank rows stay benched.`);
  console.log(`  Save as CSV, then:\n`);
  console.log(`    npx tsx --env-file=.env scripts/review-pool.ts --apply ${out}\n`);
}

async function apply(file: string) {
  const rows = parseCsv(readFileSync(file, "utf8"));
  if (rows.length < 2) {
    console.log(`\n${file} has no data rows.\n`);
    return;
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${file} is missing the "${name}" column`);
    return i;
  };

  const iVerdict = col("verdict");
  const iCorrected = col("corrected_answer");
  const iId = col("id");
  const iText = col("text");

  const approved: string[] = [];
  const rejected: string[] = [];
  const fixes: { id: string; answer: string; text: string }[] = [];
  const problems: string[] = [];
  let blank = 0;

  for (const row of rows.slice(1)) {
    const verdict = (row[iVerdict] ?? "").trim().toLowerCase();
    const id = (row[iId] ?? "").trim();
    const text = (row[iText] ?? "").trim();

    if (!id) continue;
    if (verdict === "") {
      blank++;
      continue;
    }

    if (verdict === "ok") {
      approved.push(id);
    } else if (verdict === "bad") {
      rejected.push(id);
    } else if (verdict === "fix") {
      const answer = (row[iCorrected] ?? "").trim();
      if (!answer) {
        problems.push(`fix with no corrected_answer: ${text.slice(0, 60)}`);
        continue;
      }
      fixes.push({ id, answer, text });
    } else {
      problems.push(`unknown verdict "${verdict}": ${text.slice(0, 60)}`);
    }
  }

  // A corrected answer has to be one of the options, or the question becomes
  // unanswerable in a way no player could work around.
  const live = await prisma.question.findMany({
    where: { id: { in: fixes.map((f) => f.id) } },
    select: { id: true, options: true },
  });
  const optsById = new Map(live.map((q) => [q.id, optionsOf(q.options)]));

  const validFixes = fixes.filter((f) => {
    const opts = optsById.get(f.id) ?? [];
    if (opts.includes(f.answer)) return true;
    problems.push(
      `corrected_answer "${f.answer}" is not one of the options for: ${f.text.slice(0, 50)}`,
    );
    return false;
  });

  console.log(`\nAPPLY REVIEW — ${file}`);
  console.log("─".repeat(70));
  console.log(`  ${approved.length} approved`);
  console.log(`  ${rejected.length} rejected`);
  console.log(`  ${validFixes.length} answer key(s) corrected`);
  console.log(`  ${blank} left blank (stay benched)\n`);

  if (problems.length > 0) {
    console.log(`  ${problems.length} row(s) could not be applied:\n`);
    for (const p of problems) console.log(`    ${p}`);
    console.log("");
  }

  if (approved.length + rejected.length + validFixes.length === 0) {
    console.log(`  Nothing to apply.\n`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (approved.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: approved } },
        data: { qualityScore: HAND_CHECKED },
      });
    }
    if (rejected.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: rejected } },
        data: { qualityScore: REJECTED },
      });
    }
    for (const f of validFixes) {
      await tx.question.update({
        where: { id: f.id },
        data: { correctAnswer: f.answer, qualityScore: HAND_CHECKED },
      });
    }
  });

  const total = await prisma.question.count({
    where: { qualityScore: { gte: 0 } },
  });
  const waiting = await prisma.question.count({
    where: { qualityScore: AWAITING_REVIEW },
  });

  console.log(`  Applied. ${total} question(s) in rotation, ${waiting} still awaiting review.\n`);

  if (validFixes.length > 0) {
    console.log(`  Note: players who answered a corrected question before now`);
    console.log(`  were scored against the old key. ChallengeResult keeps what`);
    console.log(`  they picked, so those rows can be re-scored if it matters —`);
    console.log(`  check 'served' in the export before you decide.\n`);
  }
}

async function main() {
  if (!BENCH && !EXPORT && !APPLY_FILE) {
    console.log(`
Human review of generated questions.

  --bench            move every unread generated question out of rotation
  --export           write question-review.csv for reading in a spreadsheet
  --apply <file>     read the verdict column back in

Typical first run:

  npx tsx --env-file=.env scripts/review-pool.ts --bench
  npx tsx --env-file=.env scripts/review-pool.ts --export
`);
    return;
  }

  if (BENCH) await bench();
  if (EXPORT) await exportCsv();
  if (APPLY_FILE) await apply(APPLY_FILE);
}

main().finally(() => prisma.$disconnect());
