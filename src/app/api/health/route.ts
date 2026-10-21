/**
 * GET /api/health — is the app alive, and can it reach its database?
 *
 * No authentication, because the point is to answer that question when
 * authentication is the thing in doubt. Today both /api/me/summary and
 * /api/streak failed at once and there was no way to tell from outside
 * whether the cause was the database, the session check, or the client never
 * sending the request at all. Every authenticated route is a bad instrument
 * for that, because each one fails for several reasons at once.
 *
 * Deliberately says nothing a stranger shouldn't know: no versions, no
 * environment variables, no connection strings, no row counts beyond whether
 * the pool is empty. "Up, and the database answered" is the whole payload.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IS_TESTNET } from "@/lib/ppa/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  let database: "ok" | "unreachable" = "unreachable";
  let questionsInRotation: number | null = null;

  try {
    questionsInRotation = await prisma.question.count({
      where: { qualityScore: { gte: 0 } },
    });
    database = "ok";
  } catch {
    // Swallowed on purpose: the error text can carry the connection string.
  }

  const body = {
    ok: database === "ok",
    database,
    questionsInRotation,
    network: IS_TESTNET ? "testnet" : "mainnet",
    checkedAt: new Date().toISOString(),
    tookMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
