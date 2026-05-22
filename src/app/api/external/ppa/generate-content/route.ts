// src/app/api/external/ppa/generate-content/route.ts
//
// External AI content generation endpoint for PPA Ecosystem apps.
// Authenticated via x-ppa-api-key header against the PPAApp registry.
//
// Returns generated questions WITHOUT saving them to the Question table —
// the calling app is responsible for storing or discarding as it sees fit.
// Logs the generation action via EcosystemTransaction for audit trail.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category, Difficulty } from "@prisma/client";
import { generateQuestions } from "@/lib/ai-content-generator";

async function validateApiKey(req: NextRequest): Promise<{
  valid: boolean;
  app?: { id: string; name: string; slug: string };
}> {
  const apiKey = req.headers.get("x-ppa-api-key");
  if (!apiKey) return { valid: false };

  const app = await prisma.pPAApp.findUnique({
    where: { apiKey },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (!app || app.status !== "ACTIVE") return { valid: false };
  return { valid: true, app: { id: app.id, name: app.name, slug: app.slug } };
}

export async function POST(req: NextRequest) {
  const { valid, app } = await validateApiKey(req);
  if (!valid || !app) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { category, difficulty, count, topic, piUserId, username } = body;

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
      sourceApp: app.slug,
    });

    // Log the generation as an ecosystem activity (no balance change,
    // just for audit). amount = number of questions returned.
    if (piUserId) {
      try {
        await prisma.ecosystemTransaction.create({
          data: {
            appId: app.id,
            piUserId,
            username: username || piUserId,
            amount: result.questions.length,
            type: "generate",
            source: `ai_content_${category}_${difficulty}`,
          },
        });
      } catch (logErr) {
        // Non-fatal — generation succeeded, only the audit log failed
        console.error(
          "[external/generate-content] audit log failed:",
          logErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      questions: result.questions,
      meta: result.meta,
      app: app.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate content";
    console.error("[external/generate-content] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
