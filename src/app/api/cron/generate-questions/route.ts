// src/app/api/cron/generate-questions/route.ts
//
// Scheduled top-up of the question pool. Triggered by Vercel Cron every 12h
// (see vercel.json). For each category, counts questions that have NEVER been
// served (timesServed === 0) and generates enough to refill to TARGET_PER_CATEGORY.
//
// Security: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We reject
// any request whose bearer token doesn't match process.env.CRON_SECRET, so the
// public route can't be abused to burn Anthropic credits.
//
// Safety: each category is generated inside its own try/catch, so one category
// failing (or one Claude hiccup) does not abort the rest of the run. The route
// always returns 200 with a per-category summary unless auth itself fails.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Category, Difficulty } from "@prisma/client";
import { generateQuestions, saveQuestions } from "@/lib/ai-content-generator";

// Don't cache — this must run fresh each invocation.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for multiple Claude calls

const CATEGORIES: Category[] = [
  "SPORTS",
  "FINANCE",
  "TECH",
  "POLITICS",
  "SOCIAL",
  "GENERAL",
];

// Keep at least this many NEVER-SERVED questions available per category.
const TARGET_PER_CATEGORY = 10;

// Spread generated questions across difficulties so the pool isn't all-EASY.
// The counts are weights; we slice the needed total across them in order.
const DIFFICULTY_MIX: Difficulty[] = ["EASY", "EASY", "MEDIUM", "MEDIUM", "HARD"];

type CategorySummary = {
  category: Category;
  fresh: number;
  generated: number;
  saved: number;
  error?: string;
};

function pickDifficulties(needed: number): Record<Difficulty, number> {
  const out: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (let i = 0; i < needed; i++) {
    const d = DIFFICULTY_MIX[i % DIFFICULTY_MIX.length];
    out[d] += 1;
  }
  return out;
}

export async function POST(req: NextRequest) {
  // ---- Auth: only Vercel Cron (or someone with the secret) may trigger ----
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/generate-questions] CRON_SECRET not set — refusing.");
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summaries: CategorySummary[] = [];

  for (const category of CATEGORIES) {
    try {
      // How many never-served questions remain in this category?
      const fresh = await prisma.question.count({
        where: { category, timesServed: 0 },
      });

      const needed = Math.max(0, TARGET_PER_CATEGORY - fresh);
      if (needed === 0) {
        summaries.push({ category, fresh, generated: 0, saved: 0 });
        continue;
      }

      // Generate per-difficulty so the pool stays varied.
      const perDifficulty = pickDifficulties(needed);
      let generatedTotal = 0;
      let savedTotal = 0;

      for (const difficulty of ["EASY", "MEDIUM", "HARD"] as Difficulty[]) {
        const count = perDifficulty[difficulty];
        if (count === 0) continue;

        const result = await generateQuestions({
          category,
          difficulty,
          count,
          sourceApp: "CRON",
        });
        generatedTotal += result.questions.length;

        const saved = await saveQuestions(
          result.questions,
          category,
          difficulty
        );
        savedTotal += saved;
      }

      summaries.push({
        category,
        fresh,
        generated: generatedTotal,
        saved: savedTotal,
      });
    } catch (err) {
      // Isolate the failure to this category; keep going.
      const message =
        err instanceof Error ? err.message : "unknown generation error";
      console.error(
        `[cron/generate-questions] category ${category} failed:`,
        err
      );
      summaries.push({
        category,
        fresh: -1,
        generated: 0,
        saved: 0,
        error: message,
      });
    }
  }

  const totalSaved = summaries.reduce((n, s) => n + s.saved, 0);
  console.log(
    `[cron/generate-questions] run complete. Saved ${totalSaved} questions.`,
    summaries
  );

  return NextResponse.json({
    success: true,
    totalSaved,
    summaries,
    ranAt: new Date().toISOString(),
  });
}

// Allow GET as well, since Vercel Cron issues GET by default for some configs.
// Same auth + same logic path.
export async function GET(req: NextRequest) {
  return POST(req);
}