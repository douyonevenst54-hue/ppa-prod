/**
 * Daily rotation warm-up.
 *
 * Builds tomorrow's challenges ahead of time so the first player of the day
 * doesn't pay for the selection queries. Entirely optional — the daily route
 * builds lazily if this never runs, which is the right failure mode: a cron
 * that doesn't fire should degrade latency, not availability.
 *
 * Schedule in vercel.json (now wired up; it was documented here for a long
 * time and never actually added, so nothing ever called this route):
 *   { "crons": [{ "path": "/api/cron/daily-challenge", "schedule": "5 0 * * *" }] }
 *
 * 00:05 UTC, just after the day boundary the selection uses. Once per day is
 * also the Hobby plan's limit.
 *
 * A cron entry accepts exactly two keys, `path` and `schedule`. Vercel rejects
 * any other property — including a "comment" — at config validation, which
 * fails the deployment in about two seconds before the build starts. So the
 * reasoning lives here, where a comment is legal, and not in the JSON.
 *
 * Vercel sends CRON_SECRET as a bearer token on scheduled invocations. Until
 * that variable is set the route returns 401 to everything, deliberately, so
 * the schedule is inert rather than dangerous before it exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureDailyChallenges } from "@/lib/ppa/rotation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  // Without a configured secret this endpoint stays closed rather than open.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = await ensureDailyChallenges();
  const tomorrow = await ensureDailyChallenges(
    new Date(Date.now() + 24 * 3600 * 1000),
  );

  return NextResponse.json({
    ok: true,
    today: today.map((c) => `${c.difficulty}:${c.category}`),
    tomorrow: tomorrow.map((c) => `${c.difficulty}:${c.category}`),
  });
}
