import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateContent, GeneratedQA } from "@/lib/ai-content-generator";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, category, difficulty, count, topic, autoSave } = body;

    if (!category || !count) {
      return NextResponse.json({ error: "category and count are required" }, { status: 400 });
    }
    if (count < 1 || count > 25) {
      return NextResponse.json({ error: "count must be between 1 and 25" }, { status: 400 });
    }

    const result = await generateContent({
      type: "qa",
      category,
      difficulty,
      count,
      topic,
      sourceApp: "PPA",
    });

    const generated = result.items as GeneratedQA[];

    let saved = 0;
    if (autoSave && generated.length > 0) {
      for (const q of generated) {
        try {
          await prisma.question.create({
            data: {
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              category: q.category,
              difficulty: q.difficulty,
              createdBy: userId || "ai-generator",
              source: "AI_SONNET_46",
            },
          });
          saved++;
        } catch (err) {
          console.error("[generate-questions] save error:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      questions: generated,
      meta: { ...result.meta, saved },
    });
  } catch (err: any) {
    console.error("[generate-questions]", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}