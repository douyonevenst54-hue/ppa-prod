// src/lib/ai-content-generator.ts
//
// Shared AI generator used by:
//   - /api/admin/generate-questions  (admin-only, saves directly to DB)
//   - /api/external/ppa/generate-content  (external apps via x-ppa-api-key)
//
// Aligned with the Question table:
//   text          String           (the question prompt)
//   options       Json             (array of 4 strings)
//   correctAnswer String           (the literal text of the correct option,
//                                   not an index)
//   category      Category enum    (SPORTS|FINANCE|TECH|POLITICS|SOCIAL|GENERAL)
//   difficulty    Difficulty enum  (EASY|MEDIUM|HARD)
//
// Model: Haiku 4.5 by default, overridable via ANTHROPIC_MODEL env var.

import Anthropic from "@anthropic-ai/sdk";
import { Prisma, Category, Difficulty } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL_ID = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

// ---------- Types ----------
export interface GenerateRequest {
  category: Category;
  difficulty: Difficulty;
  count: number;
  topic?: string;
  sourceApp: string;
}

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface GenerateResult {
  questions: GeneratedQuestion[];
  meta: {
    model: string;
    sourceApp: string;
    duplicatesRejected: number;
    invalidRejected: number;
    requested: number;
    returned: number;
  };
}

// Valid enum values used in the prompt AND to validate Claude's output.
const VALID_CATEGORIES = [
  "SPORTS",
  "FINANCE",
  "TECH",
  "POLITICS",
  "SOCIAL",
  "GENERAL",
] as const;

const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

// ---------- System prompt ----------
function buildSystemPrompt(): string {
  return `You are a question-generation engine for a Pi Network skill-based prediction app.

Your job: produce high-quality multiple-choice questions with exactly 4 options each.

OUTPUT FORMAT — return VALID JSON only. No markdown, no code fences, no preamble.

Required structure:
{
  "questions": [
    {
      "text": "the question prompt as a single sentence ending with ?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "exact text of the correct option (must match one of the options exactly)",
      "explanation": "1-2 sentence explanation of why the answer is correct"
    }
  ]
}

CRITICAL RULES:
- Each question MUST have exactly 4 options.
- "correctAnswer" MUST be the LITERAL TEXT of the correct option (not an index, not a letter).
- "correctAnswer" MUST appear verbatim in the "options" array.
- Questions must be self-contained (no "as discussed above").
- Each option must be plausible. No "obviously wrong" filler options.
- No trick questions, no double negatives, no opinion-based items.
- Questions must have ONE objectively verifiable correct answer.
- Never repeat questions from the "Do not duplicate" list.

CATEGORY MEANINGS:
- SPORTS: athletics, teams, players, records, rules
- FINANCE: markets, economics, crypto, banking, investing
- TECH: software, hardware, AI, internet, science
- POLITICS: governments, elections, history, geopolitics
- SOCIAL: pop culture, music, film, celebrities, internet culture
- GENERAL: trivia that doesn't fit cleanly elsewhere

DIFFICULTY LEVELS:
- EASY: known to most casual fans / general public
- MEDIUM: requires real knowledge of the topic
- HARD: expert-level, specific facts, dates, or nuance`;
}

// ---------- Few-shot fetching ----------
async function getFewShotExamples(
  category: Category,
  difficulty: Difficulty,
  limit = 3
): Promise<string> {
  try {
    const examples = await prisma.$queryRaw<
      Array<{
        text: string;
        options: Prisma.JsonValue;
        correctAnswer: string;
      }>
    >`
      SELECT text, options, "correctAnswer"
      FROM "Question"
      WHERE category = ${category}::"Category"
        AND difficulty = ${difficulty}::"Difficulty"
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;

    if (examples.length === 0) return "";

    return (
      "Example questions in the same category and difficulty:\n\n" +
      examples
        .map(
          (ex, i) =>
            `Example ${i + 1}:\n${JSON.stringify(
              {
                text: ex.text,
                options: ex.options,
                correctAnswer: ex.correctAnswer,
              },
              null,
              2
            )}`
        )
        .join("\n\n")
    );
  } catch (err) {
    console.error("[ai-content-generator] few-shot fetch failed:", err);
    return "";
  }
}

// ---------- Dedup fetching ----------
async function getRecentForDedup(
  category: Category,
  limit = 50
): Promise<string[]> {
  try {
    const recent = await prisma.question.findMany({
      where: { category },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { text: true },
    });
    return recent.map((r) => r.text);
  } catch (err) {
    console.error("[ai-content-generator] dedup fetch failed:", err);
    return [];
  }
}

// ---------- Main generator ----------
export async function generateQuestions(
  req: GenerateRequest
): Promise<GenerateResult> {
  const { category, difficulty, count, topic, sourceApp } = req;

  // Defensive validation
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    throw new Error(
      `Invalid category: ${category}. Must be one of ${VALID_CATEGORIES.join(", ")}`
    );
  }
  if (
    !VALID_DIFFICULTIES.includes(difficulty as typeof VALID_DIFFICULTIES[number])
  ) {
    throw new Error(
      `Invalid difficulty: ${difficulty}. Must be one of ${VALID_DIFFICULTIES.join(", ")}`
    );
  }
  if (count < 1 || count > 20) {
    throw new Error("count must be between 1 and 20");
  }

  const fewShot = await getFewShotExamples(category, difficulty);
  const dedupList = await getRecentForDedup(category);
  const dedupBlock =
    dedupList.length > 0
      ? `Do NOT duplicate any of these existing questions:\n${dedupList
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}`
      : "No existing questions to avoid.";

  const userPrompt = [
    `Generate ${count} questions.`,
    `Category: ${category}`,
    `Difficulty: ${difficulty}`,
    topic ? `Topic focus: ${topic}` : "",
    "",
    dedupBlock,
    "",
    `Return JSON in the format: {"questions": [...]}. Return only the JSON, no other text.`,
  ]
    .filter(Boolean)
    .join("\n");

  let response;
  try {
    response = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 4096,
    system: [
      {
        type: "text" as const,
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" as const },
      },
      ...(fewShot
        ? [
            {
              type: "text" as const,
              text: fewShot,
              cache_control: { type: "ephemeral" as const },
            },
          ]
        : []),
    ],
    messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    // Classify Anthropic API failures so the cause is obvious in logs.
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    if (status === 401 || status === 403) {
      console.error(
        "[ai-content-generator] Auth/model error (" +
          status +
          "): check ANTHROPIC_API_KEY and that MODEL_ID '" +
          MODEL_ID +
          "' is valid for this account."
      );
      throw new Error("Claude auth/model error (" + status + ")");
    }
    if (status === 429) {
      console.error(
        "[ai-content-generator] Rate limited (429): too many requests for current usage tier."
      );
      throw new Error("Claude rate limited (429)");
    }
    if (status === 400 || status === 402) {
      console.error(
        "[ai-content-generator] Request rejected (" +
          status +
          "): often means the Anthropic credit balance is exhausted. Top up at console.anthropic.com."
      );
      throw new Error("Claude request rejected (" + status + ") - check credit balance");
    }
    console.error("[ai-content-generator] Claude call failed:", err);
    throw new Error(
      "Claude call failed: " + (err instanceof Error ? err.message : "unknown")
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  const rawText = textBlock.text.trim().replace(/^```json\s*|\s*```$/g, "");

  let parsed: { questions?: GeneratedQuestion[] };
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error("[ai-content-generator] JSON parse failed. Raw:", rawText);
    throw new Error("Claude returned invalid JSON");
  }

  const items: GeneratedQuestion[] = parsed.questions || [];

  // Validate each question
  const valid = items.filter((q) => {
    if (typeof q.text !== "string" || q.text.trim().length === 0) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (!q.options.every((o) => typeof o === "string" && o.length > 0))
      return false;
    if (typeof q.correctAnswer !== "string") return false;
    if (!q.options.includes(q.correctAnswer)) return false;
    return true;
  });
  const invalidRejected = items.length - valid.length;

  // Dedup against existing questions
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  const existingNormalized = new Set(dedupList.map(norm));
  const fresh = valid.filter((q) => !existingNormalized.has(norm(q.text)));
  const duplicatesRejected = valid.length - fresh.length;

  return {
    questions: fresh,
    meta: {
      model: MODEL_ID,
      sourceApp,
      duplicatesRejected,
      invalidRejected,
      requested: count,
      returned: fresh.length,
    },
  };
}

// ---------- Save helper ----------
// Saves generated questions to the Question table. Returns the count saved.
export async function saveQuestions(
  questions: GeneratedQuestion[],
  category: Category,
  difficulty: Difficulty
): Promise<number> {
  if (questions.length === 0) return 0;

  const result = await prisma.question.createMany({
    data: questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category,
      difficulty,
      qualityScore: 8,
    })),
  });
  return result.count;
}
