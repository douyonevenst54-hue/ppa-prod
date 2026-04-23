import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const ADMIN_PI_USERIDS = ["douyonevenst54"];
const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { userId, category, difficulty, count, topic } = await req.json();

    // Verify admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !ADMIN_PI_USERIDS.includes(user.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prompt = `Generate ${count} multiple choice quiz questions for a skill-based prediction app.

Category: ${category}
Difficulty: ${difficulty}
${topic ? `Topic Focus: ${topic}` : ""}

Requirements:
- Each question must have exactly 4 options
- One correct answer that is objectively verifiable
- No ambiguous or opinion-based questions
- Questions should test real knowledge
- Difficulty ${difficulty}: ${
  difficulty === "EASY" ? "basic knowledge, widely known facts" :
  difficulty === "MEDIUM" ? "intermediate knowledge, requires some expertise" :
  "advanced knowledge, requires deep expertise"
}

Return ONLY a JSON array, no markdown, no explanation:
[
  {
    "text": "question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "brief explanation why this is correct"
  }
]`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Parse questions
    const text = content.text.replace(/```json|```/g, "").trim();
    const questions = JSON.parse(text);

    // Validate each question
    const validated = questions.filter((q: {
      text: string;
      options: string[];
      correctAnswer: string;
    }) =>
      q.text &&
      q.options?.length === 4 &&
      q.correctAnswer &&
      q.options.includes(q.correctAnswer)
    );

    // Save to database (as standalone questions, no contentId)
    const saved = await prisma.question.createMany({
      data: validated.map((q: {
        text: string;
        options: string[];
        correctAnswer: string;
      }) => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        category: category as never,
        difficulty: difficulty as never,
        qualityScore: 8,
      })),
    });

    return NextResponse.json({
      success: true,
      generated: questions.length,
      saved: saved.count,
      questions: validated,
    });

  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}