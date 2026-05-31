// src/app/api/auth/pi/route.ts
//
// Validates the Pi accessToken against Pi's /v2/me endpoint (the only
// trusted source of identity), then upserts the corresponding User row.
//
// This route NEVER trusts client-supplied piUserId/username for identity.
// It only uses them as hints for new-user creation (and even then, the
// /v2/me response is the source of truth — the hint just prevents an
// empty username if /v2/me's response is shaped unexpectedly).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PI_ME_ENDPOINT = "https://api.minepi.com/v2/me";

interface PiMeResponse {
  uid: string;
  username: string;
  // Other fields may exist (credentials, etc.) but we only need uid/username.
}

async function validateAccessToken(
  accessToken: string
): Promise<PiMeResponse | null> {
  try {
    const res = await fetch(PI_ME_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      // Don't cache — every auth must hit Pi fresh.
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(
        `[auth/pi] /v2/me returned ${res.status}: ${await res.text().catch(() => "")}`
      );
      return null;
    }

    const data = (await res.json()) as PiMeResponse;
    if (!data?.uid || !data?.username) {
      console.warn("[auth/pi] /v2/me response missing uid or username:", data);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[auth/pi] /v2/me validation failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, hintUsername } = body;

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { error: "accessToken required" },
        { status: 400 }
      );
    }

    // Validate via Pi's /v2/me — the only trusted source of identity.
    const piUser = await validateAccessToken(accessToken);
    if (!piUser) {
      return NextResponse.json(
        { error: "Invalid or expired accessToken" },
        { status: 401 }
      );
    }

    const { uid: piUserId, username } = piUser;
    // Defensive fallback if Pi returns an empty username (shouldn't happen
    // but cheap to guard).
    const effectiveUsername =
      username || (typeof hintUsername === "string" ? hintUsername : piUserId);

    // Legacy migration: older rows had the username copied into piUserId.
    // If a row exists with piUserId === username and no row with the real
    // piUserId yet, migrate the legacy row in place.
    if (piUserId !== effectiveUsername) {
      const legacy = await prisma.user.findUnique({
        where: { piUserId: effectiveUsername },
      });
      const real = await prisma.user.findUnique({ where: { piUserId } });
      if (legacy && !real) {
        const migrated = await prisma.user.update({
          where: { id: legacy.id },
          data: {
            piUserId,
            username: effectiveUsername,
            lastActiveDate: new Date(),
          },
        });
        return NextResponse.json({ user: migrated });
      }
    }

    // Standard upsert by piUserId. The data on /v2/me wins over any
    // local cache.
    const user = await prisma.user.upsert({
      where: { piUserId },
      update: {
        username: effectiveUsername,
        lastActiveDate: new Date(),
      },
      create: {
        piUserId,
        username: effectiveUsername,
        ppaBalance: 100,
        accuracyRate: 0,
        reputationScore: 0,
        streakDays: 0,
        tier: "NEWCOMER",
        totalPredictions: 0,
        correctPredictions: 0,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth/pi] error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}