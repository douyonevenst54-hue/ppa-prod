// src/app/api/admin/generate-questions/route.ts
//
// Admin-only endpoint for generating quiz questions using Claude.
// Requires the requesting user's username to be in ADMIN_PI_USERIDS.
// Saves generated questions directly to the Question table.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category, Difficulty } from "@prisma/client";
import {
  generateQuestions,
  saveQuestions,
} from "@/lib/ai-content-generator";

const ADMIN_PI_USERIDS = ["douyonevenst54"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, category, difficulty, count, topic } = body;

    // Verify admin
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (!user || !ADMIN_PI_USERIDS.includes(user.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate inputs
    if (!category || !difficulty || !count) {
      return NextResponse.json(
        { error: "category, difficulty, and count are required" },
        { status: 400 }
      );
    }

    const result = await generateQuestions({
      category: category as Category,
      difficulty: difficulty as Difficulty,
      count: Number(count),
      topic: topic || undefined,
      sourceApp: "ADMIN",
    });

    const saved = await saveQuestions(
      result.questions,
      category as Category,
      difficulty as Difficulty
    );

    return NextResponse.json({
      success: true,
      questions: result.questions,
      meta: { ...result.meta, saved },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate questions";
    console.error("[admin/generate-questions] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
