/**
 * Validation for incoming questions.
 *
 * Lives here rather than in the import script so it can be tested. The check
 * that matters most is that the answer key is one of the options: a question
 * failing that looks completely normal in the admin list and marks every
 * player wrong, taking reputation off people who answered correctly. There is
 * no way to notice it from the outside except by reading the question.
 */

export const QUESTION_CATEGORIES = [
  "GENERAL",
  "TECH",
  "FINANCE",
  "SOCIAL",
  "SPORTS",
  "POLITICS",
] as const;

export const QUESTION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export interface IncomingQuestion {
  /** 1-based line in the source file, for error messages. */
  row: number;
  text: string;
  options: string[];
  correctAnswer: string;
  category: string;
  difficulty: string;
}

/** Comparison form for duplicate detection: case and spacing don't count. */
export function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Structural faults, which abort an import.
 *
 * Duplicates are deliberately NOT in here — see findDuplicates. A half-written
 * batch is worse than none because you can't tell by looking which half
 * arrived, so anything returned by this stops the whole file. But a file being
 * re-imported after edits will legitimately contain rows that are already in
 * the pool, and refusing the batch over those would make the normal workflow
 * fail.
 */
export function validateIncoming(
  rows: IncomingQuestion[],
  minOptions = 2,
): string[] {
  const problems: string[] = [];

  for (const q of rows) {
    const at = `row ${q.row}`;

    if (!q.text.trim()) problems.push(`${at}: no question text`);

    if (!(QUESTION_CATEGORIES as readonly string[]).includes(q.category)) {
      problems.push(
        `${at}: category "${q.category}" is not one of ${QUESTION_CATEGORIES.join("/")}`,
      );
    }
    if (!(QUESTION_DIFFICULTIES as readonly string[]).includes(q.difficulty)) {
      problems.push(
        `${at}: difficulty "${q.difficulty}" is not one of ${QUESTION_DIFFICULTIES.join("/")}`,
      );
    }

    if (q.options.length < minOptions) {
      problems.push(`${at}: needs at least ${minOptions} options, found ${q.options.length}`);
    }
    if (q.options.some((o) => !o.trim())) {
      problems.push(`${at}: an option is blank`);
    }
    if (new Set(q.options.map(normalizeQuestionText)).size !== q.options.length) {
      problems.push(`${at}: two options are the same`);
    }

    if (!q.correctAnswer.trim()) {
      problems.push(`${at}: no answer_key`);
    } else if (!q.options.includes(q.correctAnswer)) {
      problems.push(
        `${at}: answer_key "${q.correctAnswer}" is not one of the options (${q.options.join(" | ")})`,
      );
    }

  }

  return problems;
}

/**
 * Read either JSON shape the repo uses into a flat list.
 *
 * data/question-pool.json is nested { CATEGORY: { DIFFICULTY: [...] } }, which
 * keeps it readable while authoring but means category and difficulty live in
 * the keys rather than on the question. A flat array of questions that carry
 * their own category and difficulty is also accepted, because that is what an
 * export produces.
 */
export function flattenQuestionJson(raw: unknown): IncomingQuestion[] {
  const out: IncomingQuestion[] = [];

  const push = (q: Record<string, unknown>, category: string, difficulty: string) => {
    out.push({
      row: out.length + 1,
      text: String(q.text ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: String(q.correctAnswer ?? q.answer_key ?? "").trim(),
      category: String(q.category ?? category).trim().toUpperCase(),
      difficulty: String(q.difficulty ?? difficulty).trim().toUpperCase(),
    });
  };

  if (Array.isArray(raw)) {
    for (const q of raw) push(q as Record<string, unknown>, "", "");
    return out;
  }

  if (raw && typeof raw === "object") {
    for (const [category, byDifficulty] of Object.entries(raw as Record<string, unknown>)) {
      if (!byDifficulty || typeof byDifficulty !== "object") continue;

      // { CATEGORY: [ ... ] } — questions carry their own difficulty.
      if (Array.isArray(byDifficulty)) {
        for (const q of byDifficulty) push(q as Record<string, unknown>, category, "");
        continue;
      }

      for (const [difficulty, list] of Object.entries(byDifficulty as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        for (const q of list) push(q as Record<string, unknown>, category, difficulty);
      }
    }
  }

  return out;
}

export interface DuplicateRow {
  row: number;
  text: string;
  reason: "already in the pool" | "repeated in this file";
  /** The earlier row it repeats, when the clash is inside the file. */
  firstSeenAtRow?: number;
}

/**
 * Rows to skip rather than reject: the question is already known.
 *
 * Skipping keeps the obvious workflow working — author a file, import it, add
 * more rows, import it again — without either duplicating the pool or making
 * the author hunt for which lines to delete.
 */
export function findDuplicates(
  rows: IncomingQuestion[],
  existingTexts: Set<string> = new Set(),
): DuplicateRow[] {
  const dupes: DuplicateRow[] = [];
  const seenInFile = new Map<string, number>();

  for (const q of rows) {
    const key = normalizeQuestionText(q.text);
    if (!key) continue;

    if (existingTexts.has(key)) {
      dupes.push({ row: q.row, text: q.text, reason: "already in the pool" });
      continue;
    }

    const earlier = seenInFile.get(key);
    if (earlier !== undefined) {
      dupes.push({
        row: q.row,
        text: q.text,
        reason: "repeated in this file",
        firstSeenAtRow: earlier,
      });
      continue;
    }

    seenInFile.set(key, q.row);
  }

  return dupes;
}
