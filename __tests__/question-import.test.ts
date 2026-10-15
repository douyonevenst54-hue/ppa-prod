import { describe, it, expect } from "vitest";
import {
  validateIncoming,
  findDuplicates,
  normalizeQuestionText,
  QUESTION_CATEGORIES,
  QUESTION_DIFFICULTIES,
  type IncomingQuestion,
} from "@/lib/ppa/question-import";

function q(over: Partial<IncomingQuestion> = {}): IncomingQuestion {
  return {
    row: 2,
    text: "What is the capital of Haiti?",
    options: ["Port-au-Prince", "Cap-Haïtien", "Jacmel", "Gonaïves"],
    correctAnswer: "Port-au-Prince",
    category: "GENERAL",
    difficulty: "EASY",
    ...over,
  };
}

describe("validateIncoming", () => {
  it("accepts a well-formed question", () => {
    expect(validateIncoming([q()])).toEqual([]);
  });

  it("rejects an answer key that is not one of the options", () => {
    // The whole reason this file exists. A question like this looks correct in
    // the admin list and marks every player wrong.
    const problems = validateIncoming([q({ correctAnswer: "Portau Prince" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not one of the options");
    expect(problems[0]).toContain("row 2");
  });

  it("is strict about the answer key, including whitespace and case", () => {
    expect(validateIncoming([q({ correctAnswer: "port-au-prince" })])).toHaveLength(1);
    expect(validateIncoming([q({ correctAnswer: "Port-au-Prince " })])).toHaveLength(1);
  });

  it("rejects a blank answer key", () => {
    expect(validateIncoming([q({ correctAnswer: "   " })])[0]).toContain("no answer_key");
  });

  it("rejects a question with no text", () => {
    expect(validateIncoming([q({ text: "  " })])[0]).toContain("no question text");
  });

  it("rejects duplicate options, which make two answers right", () => {
    const problems = validateIncoming([
      q({ options: ["Jacmel", "Jacmel", "Gonaïves"], correctAnswer: "Jacmel" }),
    ]);
    expect(problems.some((p) => p.includes("two options are the same"))).toBe(true);
  });

  it("rejects a blank option", () => {
    const problems = validateIncoming([
      q({ options: ["Port-au-Prince", "", "Jacmel"], correctAnswer: "Port-au-Prince" }),
    ]);
    expect(problems.some((p) => p.includes("blank"))).toBe(true);
  });

  it("rejects too few options", () => {
    const problems = validateIncoming([
      q({ options: ["Port-au-Prince"], correctAnswer: "Port-au-Prince" }),
    ]);
    expect(problems.some((p) => p.includes("at least 2 options"))).toBe(true);
  });

  it("rejects an unknown category or difficulty and names the valid ones", () => {
    const problems = validateIncoming([q({ category: "CULTURE", difficulty: "EXPERT" })]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(QUESTION_CATEGORIES[0]);
    expect(problems[1]).toContain(QUESTION_DIFFICULTIES[0]);
  });

  it("does not treat a duplicate as a structural fault", () => {
    // Duplicates are skipped by findDuplicates, not fatal — re-importing an
    // edited file is the normal workflow and must not fail.
    expect(validateIncoming([q({ row: 2 }), q({ row: 7 })])).toEqual([]);
  });

  it("reports every problem rather than stopping at the first", () => {
    const problems = validateIncoming([
      q({ row: 2, correctAnswer: "nope" }),
      q({ row: 3, text: "", category: "NOPE" }),
    ]);
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts an empty batch", () => {
    expect(validateIncoming([])).toEqual([]);
  });
});

describe("findDuplicates", () => {
  it("finds nothing in a clean batch", () => {
    expect(findDuplicates([q()])).toEqual([]);
  });

  it("flags a repeat inside the file and points at the first row", () => {
    const dupes = findDuplicates([q({ row: 2 }), q({ row: 7 })]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      row: 7,
      reason: "repeated in this file",
      firstSeenAtRow: 2,
    });
  });

  it("treats case and extra spacing as the same question", () => {
    const dupes = findDuplicates([
      q({ row: 2 }),
      q({ row: 3, text: "  WHAT IS THE   capital of Haiti? " }),
    ]);
    expect(dupes).toHaveLength(1);
  });

  it("flags a question already in the pool", () => {
    const existing = new Set([normalizeQuestionText("What is the capital of Haiti?")]);
    expect(findDuplicates([q()], existing)[0].reason).toBe("already in the pool");
  });

  it("keeps the first of three copies and flags the other two", () => {
    const dupes = findDuplicates([q({ row: 2 }), q({ row: 3 }), q({ row: 4 })]);
    expect(dupes.map((d) => d.row)).toEqual([3, 4]);
  });

  it("flags every copy when the question is already in the pool", () => {
    const existing = new Set([normalizeQuestionText("What is the capital of Haiti?")]);
    expect(findDuplicates([q({ row: 2 }), q({ row: 3 })], existing)).toHaveLength(2);
  });
});

describe("normalizeQuestionText", () => {
  it("collapses whitespace and case", () => {
    expect(normalizeQuestionText("  Hello   World  ")).toBe("hello world");
    expect(normalizeQuestionText("Hello\nWorld")).toBe("hello world");
  });

  it("does not strip accents, which change meaning", () => {
    expect(normalizeQuestionText("Cap-Haïtien")).toBe("cap-haïtien");
  });
});
