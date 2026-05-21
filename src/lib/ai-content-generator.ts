// src/lib/ai-content-generator.ts
// Shared AI generator used by /api/admin/generate-questions
// and /api/external/ppa/generate-content

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const prisma = new PrismaClient();

// ---------- Types ----------
export type ContentType = "qa" | "poll";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface GenerateRequest {
  type: ContentType;
  category: string;
  difficulty?: Difficulty;
  count: number;
  topic?: string;
  sourceApp: string;
}

export interface GeneratedQA {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: Difficulty;
}

export interface GeneratedPoll {
  question: string;
  options: string[];
  category: string;
  expectedSplit?: string;
}

// ---------- System prompts (cached) ----------
const QA_SYSTEM_PROMPT = `You are a question-generation engine for a Pi Network trivia and prediction app.

Your job: produce high-quality multiple-choice questions with exactly 4 options each.

Rules:
- Output VALID JSON only. No markdown. No preamble. No code fences.
- Each question must have exactly 4 options.
- "correctAnswer" is the 0-indexed position of the right answer.
- Difficulty levels:
  * EASY = known to most casual fans / general public
  * MEDIUM = requires real knowledge of the topic
  * HARD = expert-level, specific facts, dates, or nuance
- Avoid trick questions, double negatives, or ambiguous phrasing.
- Each option must be plausible. No "obviously wrong" filler options.
- Questions must be self-contained (no "as we discussed earlier").
- Never repeat questions from the "Do not duplicate" list provided.
- Match the style and tone of the example questions provided.

Output format:
{
  "questions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "1-2 sentence explanation of why the answer is correct",
      "category": "CATEGORY_NAME",
      "difficulty": "EASY|MEDIUM|HARD"
    }
  ]
}`;

const POLL_SYSTEM_PROMPT = `You are a poll-generation engine for a Pi Network social prediction app.

Your job: produce engaging poll questions with 2-4 options where there is NO single correct answer — these are opinion, preference, or prediction polls.

Rules:
- Output VALID JSON only. No markdown. No preamble. No code fences.
- Each poll has 2-4 options.
- Polls should provoke discussion or split opinion.
- Mix angles: hypothetical, comparative, preference, prediction.
- Options must be roughly balanced (no obvious "right" answer).
- Questions must be self-contained.
- Never repeat polls from the "Do not duplicate" list provided.

Output format:
{
  "polls": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "category": "CATEGORY_NAME",
      "expectedSplit": "brief prediction of how votes will divide"
    }
  ]
}`;

// ---------- Few-shot fetching ----------
async function getFewShotExamples(
  type: ContentType,
  category: string,
  difficulty?: Difficulty,
  limit = 3
): Promise<string> {
  if (type === "qa") {
    const examples = await prisma.$queryRaw
      Array<{
        question: string;
        options: string[];
        correctAnswer: number;
        category: string;
        difficulty: string;
      }>
    >`
      SELECT question, options, "correctAnswer", category, difficulty
      FROM "Question"
      WHERE category = ${category}
      ${difficulty ? prisma.$queryRaw`AND difficulty = ${difficulty}` : prisma.$queryRaw``}
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;

    if (examples.length === 0) return "";

    return (
      "Example questions in the same category and style:\n\n" +
      examples
        .map(
          (ex, i) =>
            `Example ${i + 1}:\n${JSON.stringify(
              {
                question: ex.question,
                options: ex.options,
                correctAnswer: ex.correctAnswer,
                category: ex.category,
                difficulty: ex.difficulty,
              },
              null,
              2
            )}`
        )
        .join("\n\n")
    );
  }

  try {
    const examples = await prisma.$queryRaw
      Array<{ question: string; options: string[]; category: string }>
    >`
      SELECT question, options, category
      FROM "Poll"
      WHERE category = ${category}
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    if (examples.length === 0) return "";
    return (
      "Example polls in the same category and style:\n\n" +
      examples.map((ex, i) => `Example ${i + 1}:\n${JSON.stringify(ex, null, 2)}`).join("\n\n")
    );
  } catch {
    return "";
  }
}

// ---------- Dedup fetching ----------
async function getRecentForDedup(
  type: ContentType,
  category: string,
  limit = 50
): Promise<string[]> {
  if (type === "qa") {
    const recent = await prisma.$queryRaw<Array<{ question: string }>>`
      SELECT question FROM "Question"
      WHERE category = ${category}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
    return recent.map((r) => r.question);
  }
  try {
    const recent = await prisma.$queryRaw<Array<{ question: string }>>`
      SELECT question FROM "Poll"
      WHERE category = ${category}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
    return recent.map((r) => r.question);
  } catch {
    return [];
  }
}

// ---------- Main generator ----------
export async function generateContent(req: GenerateRequest): Promise<{
  items: GeneratedQA[] | GeneratedPoll[];
  meta: {
    model: string;
    sourceApp: string;
    duplicatesRejected: number;
    requested: number;
    returned: number;
  };
}> {
  const { type, category, difficulty, count, topic, sourceApp } = req;

  const fewShot = await getFewShotExamples(type, category, difficulty);
  const dedupList = await getRecentForDedup(type, category);
  const dedupBlock =
    dedupList.length > 0
      ? `Do NOT duplicate any of these existing questions:\n${dedupList
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}`
      : "No existing questions to avoid.";

  const userPrompt = [
    `Generate ${count} ${type === "qa" ? "questions" : "polls"} for category: ${category}.`,
    difficulty ? `Difficulty: ${difficulty}.` : "",
    topic ? `Specific topic focus: ${topic}.` : "",
    "",
    dedupBlock,
    "",
    `Return JSON only. ${
      type === "qa" ? `Wrap in {"questions": [...]}` : `Wrap in {"polls": [...]}`
    }.`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = type === "qa" ? QA_SYSTEM_PROMPT : POLL_SYSTEM_PROMPT;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
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

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  const rawText = textBlock.text.trim().replace(/^```json\s*|\s*```$/g, "");

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error("[ai-content-generator] JSON parse failed. Raw:", rawText);
    throw new Error("Claude returned invalid JSON");
  }

  const items: any[] = type === "qa" ? parsed.questions || [] : parsed.polls || [];

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  const existingNormalized = new Set(dedupList.map(norm));
  const fresh = items.filter((it) => !existingNormalized.has(norm(it.question)));
  const duplicatesRejected = items.length - fresh.length;

  return {
    items: fresh,
    meta: {
      model: "claude-sonnet-4-6",
      sourceApp,
      duplicatesRejected,
      requested: count,
      returned: fresh.length,
    },
  };
}