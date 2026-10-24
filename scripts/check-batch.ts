/**
 * Check a question batch without a database.
 *
 *   npx tsx scripts/check-batch.ts data/question-batch-003.csv
 *   npx tsx scripts/check-batch.ts data/question-batch-003.csv --against data/question-pool.json data/question-batch-002.csv
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * import-questions.ts validates a batch properly, but even its dry run opens
 * a Prisma client to look for duplicates, so it cannot run where there is no
 * DATABASE_URL — which includes every place a batch is actually written and
 * reviewed. The result was that a file's first contact with validation was
 * also its first contact with the live pool.
 *
 * This runs the same rules from src/lib/ppa/question-import.ts, offline, and
 * compares against other files instead of the database. It is a pre-flight,
 * not a replacement: import-questions still has the last word, because only
 * it can see what is really in the pool.
 *
 * Exits non-zero if anything is wrong, so it can gate a commit.
 */

import { readFileSync } from "node:fs";
import { parseCsv } from "../src/lib/csv";
import {
  QUESTION_CATEGORIES,
  QUESTION_DIFFICULTIES,
  normalizeQuestionText,
  validateIncoming,
  flattenQuestionJson,
  type IncomingQuestion,
} from "../src/lib/ppa/question-import";

const QUESTIONS_PER_CHALLENGE = 5;

const args = process.argv.slice(2);
const againstAt = args.indexOf("--against");
const target = args.find((a) => !a.startsWith("--") && args.indexOf(a) < (againstAt === -1 ? Infinity : againstAt));
const compareFiles = againstAt === -1 ? [] : args.slice(againstAt + 1).filter((a) => !a.startsWith("--"));

function readRows(file: string): IncomingQuestion[] {
  const raw = readFileSync(file, "utf8");
  if (file.endsWith(".json")) return flattenQuestionJson(JSON.parse(raw));

  const table = parseCsv(raw);
  const header = table[0].map((h) => h.trim().toLowerCase());
  const at = (name: string) => header.indexOf(name);
  const cell = (r: string[], name: string) => (r[at(name)] ?? "").trim();

  return table.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r, i) => ({
      row: i + 2,
      text: cell(r, "text"),
      options: cell(r, "options").split("|").map((o) => o.trim()).filter(Boolean),
      correctAnswer: cell(r, "answer_key"),
      category: cell(r, "category").toUpperCase(),
      difficulty: cell(r, "difficulty").toUpperCase(),
    }));
}

function main() {
  if (!target) {
    console.log(`
Check a question batch offline.

  scripts/check-batch.ts <file.csv|file.json>
  scripts/check-batch.ts <file> --against <other files...>
`);
    process.exitCode = 1;
    return;
  }

  const rows = readRows(target);
  console.log(`\nBATCH CHECK — ${target}`);
  console.log("─".repeat(70));
  console.log(`  ${rows.length} row(s) read\n`);

  // ── the shared rules ────────────────────────────────────────────────
  const problems = validateIncoming(rows);

  // ── rules this format needs that the library cannot know about ──────
  //
  // Options are stored pipe-separated, so a pipe inside an option silently
  // becomes two options. The library sees the already-split array and cannot
  // tell that happened; only the file can.
  for (const r of rows) {
    if (r.options.length !== 4) {
      problems.push(`row ${r.row}: ${r.options.length} options, expected 4 — ${r.text.slice(0, 40)}`);
    }
    for (const o of r.options) {
      if (o.includes("|")) {
        problems.push(`row ${r.row}: option contains a pipe — ${o.slice(0, 40)}`);
      }
    }
    const lower = r.options.map((o) => o.toLowerCase());
    for (const banned of ["all of the above", "none of the above"]) {
      if (lower.some((o) => o.includes(banned))) {
        problems.push(`row ${r.row}: "${banned}" is not a usable option — ${r.text.slice(0, 40)}`);
      }
    }
    if (new Set(lower).size !== lower.length) {
      problems.push(`row ${r.row}: duplicate options — ${r.text.slice(0, 40)}`);
    }
  }

  // ── duplicates within the batch ─────────────────────────────────────
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = normalizeQuestionText(r.text);
    const first = seen.get(key);
    if (first !== undefined) {
      problems.push(`row ${r.row}: duplicate of row ${first} — ${r.text.slice(0, 50)}`);
    } else {
      seen.set(key, r.row);
    }
  }

  // ── duplicates against other files ──────────────────────────────────
  const known = new Map<string, string>();
  for (const f of compareFiles) {
    for (const r of readRows(f)) known.set(normalizeQuestionText(r.text), f);
  }
  let clashes = 0;
  for (const r of rows) {
    const where = known.get(normalizeQuestionText(r.text));
    if (where) {
      clashes++;
      problems.push(`row ${r.row}: already in ${where} — ${r.text.slice(0, 50)}`);
    }
  }
  if (compareFiles.length > 0) {
    console.log(`  compared against ${known.size} existing question(s) in ${compareFiles.length} file(s)`);
    console.log(`  ${clashes} clash(es)\n`);
  }

  // ── near-duplicates ─────────────────────────────────────────────────
  //
  // Exact matching is not enough, and the live pool proves it: it already
  // holds "What does 'CPU' stand for?" beside "What does CPU stand for?",
  // "What is a race condition?" beside "What does a race condition
  // describe?", and two separate questions asking which key is shared openly
  // in public-key cryptography. None of those are exact duplicates, all of
  // them make the rotation feel more repetitive than the arithmetic says.
  //
  // Reported as a warning rather than a failure: two questions can share most
  // of their words and still be different questions ("longest river in the
  // world" and "longest river in Africa"), so this needs eyes, not a rule.
  const NEAR = 0.7;
  const tokens = (t: string) =>
    new Set(normalizeQuestionText(t).split(/\s+/).filter((w) => w.length > 2));

  const batchTokens = rows.map((r) => ({ row: r.row, text: r.text, set: tokens(r.text) }));
  const nearPairs: string[] = [];
  for (let i = 0; i < batchTokens.length; i++) {
    for (let j = i + 1; j < batchTokens.length; j++) {
      const a = batchTokens[i], b = batchTokens[j];
      const inter = [...a.set].filter((w) => b.set.has(w)).length;
      const union = new Set([...a.set, ...b.set]).size;
      if (union > 0 && inter / union >= NEAR) {
        nearPairs.push(`rows ${a.row} and ${b.row} overlap heavily — "${a.text.slice(0, 44)}" / "${b.text.slice(0, 44)}"`);
      }
    }
  }
  if (nearPairs.length > 0) {
    console.log(`  ${nearPairs.length} near-duplicate pair(s) to read:`);
    for (const p of nearPairs.slice(0, 20)) console.log(`    ${p}`);
    console.log("");
  }

  // ── shape of the batch ──────────────────────────────────────────────
  const cells = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.difficulty}/${r.category}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }

  console.log("  per cell:");
  for (const d of QUESTION_DIFFICULTIES) {
    const line = QUESTION_CATEGORIES.map((c) => `${c}:${cells.get(`${d}/${c}`) ?? 0}`).join("  ");
    console.log(`    ${d.padEnd(7)} ${line}`);
  }

  // Runway, counting this batch plus whatever it was compared against — the
  // number that actually answers "how long until a question comes back".
  const combined = new Map<string, number>();
  for (const [k, n] of cells) combined.set(k, n);
  for (const f of compareFiles) {
    for (const r of readRows(f)) {
      const k = `${r.difficulty}/${r.category}`;
      combined.set(k, (combined.get(k) ?? 0) + 1);
    }
  }

  console.log("\n  runway with this batch applied:");
  for (const d of QUESTION_DIFFICULTIES) {
    const counts = QUESTION_CATEGORIES.map((c) => combined.get(`${d}/${c}`) ?? 0);
    const total = counts.reduce((a, b) => a + b, 0);
    const thinnest = Math.min(...counts);
    console.log(
      `    ${d.padEnd(7)} ${String(total).padStart(4)} live   ` +
        `mixed day: ${Math.floor(total / QUESTIONS_PER_CHALLENGE)}d   ` +
        `thinnest cell: ${thinnest} → ${Math.floor(thinnest / QUESTIONS_PER_CHALLENGE)}d themed`,
    );
  }

  if (problems.length > 0) {
    console.log(`\n  ${problems.length} problem(s):\n`);
    for (const p of problems.slice(0, 60)) console.log(`    ${p}`);
    if (problems.length > 60) console.log(`    … and ${problems.length - 60} more`);
    console.log("");
    process.exitCode = 1;
    return;
  }

  console.log(`\n  No problems. import-questions.ts still has the last word —\n` +
    `  only it can see what is already in the live pool.\n`);
}

main();
