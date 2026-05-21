import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateContent } from "@/lib/ai-content-generator";

const prisma = new PrismaClient();
const RATE_LIMIT_PER_HOUR = 100;

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
    }

    const app = await prisma.pPAApp.findUnique({ where: { apiKey } });
    if (!app || !app.isActive) {
      return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.ecosystemTransaction.count({
      where: { appId: app.id, type: "AI_GENERATE", createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Rate limit exceeded", limit: RATE_LIMIT_PER_HOUR, window: "1 hour" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { type, category, difficulty, count, topic } = body;

    if (!type || !["qa", "poll"].includes(type)) {
      return NextResponse.json({ error: "type must be 'qa' or 'poll'" }, { status: 400 });
    }
    if (!category || !count) {
      return NextResponse.json({ error: "category and count are required" }, { status: 400 });
    }
    if (count < 1 || count > 20) {
      return NextResponse.json({ error: "count must be between 1 and 20" }, { status: 400 });
    }

    const result = await generateContent({
      type, category, difficulty, count, topic, sourceApp: app.name,
    });

    await prisma.ecosystemTransaction.create({
      data: {
        appId: app.id,
        type: "AI_GENERATE",
        metadata: {
          contentType: type,
          category,
          difficulty: difficulty || null,
          requested: count,
          returned: result.meta.returned,
          duplicatesRejected: result.meta.duplicatesRejected,
        },
      },
    });

    return NextResponse.json({ success: true, items: result.items, meta: result.meta });
  } catch (err: any) {
    console.error("[external/ppa/generate-content]", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}