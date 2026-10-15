import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, headerIndex, requireColumns } from "@/lib/csv";
import {
  validateIncoming,
  findDuplicates,
  flattenQuestionJson,
  normalizeQuestionText,
  type IncomingQuestion,
} from "@/lib/ppa/question-import";

/**
 * The question files that ship in this repo are checked here.
 *
 * A wrong answer key is the one defect no amount of structural review catches
 * downstream: the question looks correct in the admin list and marks every
 * player wrong, taking reputation off people who answered correctly. This at
 * least guarantees the mechanical half — that the key is one of the options,
 * that nothing is duplicated, that every category and difficulty is spelled
 * the way Prisma expects — before any of it reaches the database.
 *
 * It cannot check whether an answer is true. That still needs a person.
 */

const root = resolve(__dirname, "..");

function readCsvQuestions(relPath: string): IncomingQuestion[] {
  const table = parseCsv(readFileSync(resolve(root, relPath), "utf8"));
  const index = headerIndex(table[0]);
  expect(
    requireColumns(index, ["text", "answer_key", "options", "category", "difficulty"]),
  ).toEqual([]);

  const cell = (r: string[], name: string) => (r[index.get(name)!] ?? "").trim();

  return table.slice(1).map((r, i) => ({
    row: i + 2,
    text: cell(r, "text"),
    options: cell(r, "options").split("|").map((o) => o.trim()).filter(Boolean),
    correctAnswer: cell(r, "answer_key"),
    category: cell(r, "category").toUpperCase(),
    difficulty: cell(r, "difficulty").toUpperCase(),
  }));
}

const CSV_BATCHES = ["data/question-batch-002.csv"];

describe.each(CSV_BATCHES)("%s", (relPath) => {
  const rows = readCsvQuestions(relPath);

  it("has questions in it", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("passes the same validation the importer runs", () => {
    expect(validateIncoming(rows)).toEqual([]);
  });

  it("contains no duplicates of itself", () => {
    expect(findDuplicates(rows)).toEqual([]);
  });

  it("gives every question exactly four options", () => {
    const wrong = rows.filter((q) => q.options.length !== 4);
    expect(wrong.map((q) => `row ${q.row}: ${q.options.length} options`)).toEqual([]);
  });

  it("fills every category and difficulty cell", () => {
    const cells = new Map<string, number>();
    for (const q of rows) {
      const k = `${q.category}/${q.difficulty}`;
      cells.set(k, (cells.get(k) ?? 0) + 1);
    }
    // 6 categories x 3 difficulties. A cell left empty means a themed day on
    // that subject has nothing to serve.
    expect(cells.size).toBe(18);
    for (const [cell, n] of cells) {
      expect(n, `${cell} has only ${n}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("does not use a pipe inside an option, which is the separator", () => {
    for (const q of rows) {
      for (const o of q.options) expect(o).not.toContain("|");
    }
  });

  it("asks a question rather than stating something", () => {
    const notQuestions = rows.filter((q) => !q.text.trim().endsWith("?"));
    expect(notQuestions.map((q) => `row ${q.row}: ${q.text.slice(0, 40)}`)).toEqual([]);
  });
});

describe("data/question-pool.json", () => {
  const path = resolve(root, "data/question-pool.json");

  it("is valid against the importer's rules", () => {
    if (!existsSync(path)) return;

    const rows = flattenQuestionJson(JSON.parse(readFileSync(path, "utf8")));

    // The nested shape must actually yield questions; reading it as a flat
    // array produced an empty list and quietly passed every other check.
    expect(rows.length).toBeGreaterThan(0);
    expect(validateIncoming(rows)).toEqual([]);
    expect(findDuplicates(rows)).toEqual([]);
  });
});

describe("the two shipped files together", () => {
  it("do not duplicate each other", () => {
    const poolPath = resolve(root, "data/question-pool.json");
    if (!existsSync(poolPath)) return;

    const pool = flattenQuestionJson(JSON.parse(readFileSync(poolPath, "utf8")));
    const existing = new Set(pool.map((q) => normalizeQuestionText(q.text)));

    const clashes = CSV_BATCHES.flatMap((p) =>
      findDuplicates(readCsvQuestions(p), existing).map((d) => `${p} row ${d.row}: ${d.text}`),
    );
    expect(clashes).toEqual([]);
  });
});
