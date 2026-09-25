// src/app/api/auth/pi/route.ts
//
// Validates the Pi accessToken against Pi's /v2/me endpoint (the only
// trusted source of identity), then upserts the corresponding User row.
//
// This route NEVER trusts client-supplied piUserId/username for identity.
// It only uses them as hints for new-user creation (and even then, the
// /v2/me response is the source of truth — the hint just prevents an
// empty username if /v2/me's response is shaped unexpectedly).
//
// ── CHANGE: THE WELCOME GRANT GOES THROUGH THE GATE ───────────────────────
//
// New users were created with `ppaBalance: 100` written straight onto the row.
// That was the last unmigrated write path, and it showed up in verification as
// "chain says 0, User.ppaBalance says 100" on every account that hadn't earned
// anything yet.
//
// Users are now created at zero and granted 100 through award(), so they start
// on the hash chain at row one instead of joining it whenever they happen to
// earn something. The idempotency key is derived from piUserId, so a replayed
// or retried signup cannot grant twice.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { award } from "@/lib/ppa/award";

const PI_ME_ENDPOINT = "https://api.minepi.com/v2/me";

/** PPA granted once, on account creation. */
const WELCOME_GRANT = 100;

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

    // Resolve by piUserId first — the only trusted identity key.
    const byPiId = await prisma.user.findUnique({ where: { piUserId } });
    // Any row currently holding this username (may be a legacy duplicate).
    const byUsername = await prisma.user.findUnique({
      where: { username: effectiveUsername },
    });

    let user;
    let isNew = false;

    if (byPiId) {
      // Normal case: user exists. Only sync username if no OTHER row owns it.
      const usernameConflict = byUsername && byUsername.id !== byPiId.id;
      user = await prisma.user.update({
        where: { id: byPiId.id },
        data: {
          ...(usernameConflict ? {} : { username: effectiveUsername }),
          lastActiveDate: new Date(),
        },
      });
      if (usernameConflict) {
        console.warn(
          `[auth/pi] username "${effectiveUsername}" held by user ${byUsername.id}; ` +
            `signed in ${byPiId.id} without renaming. Needs manual merge.`
        );
      }
    } else if (byUsername && byUsername.deletedAt === null) {
      // Legacy row owns the username but has a stale/absent piUserId.
      // Claim it for this Pi identity (preserves balance & stats).
      //
      // Worth knowing: this branch transfers whatever balance that row holds to
      // whoever signs in with a matching Pi username. It exists because the old
      // ecosystem bridge auto-created users from arbitrary piUserId strings, so
      // rows can exist that were never a real Pi account. That bridge no longer
      // creates users, so this path should stop firing — if these log lines
      // keep appearing months from now, something is still minting accounts.
      user = await prisma.user.update({
        where: { id: byUsername.id },
        data: { piUserId, lastActiveDate: new Date() },
      });
      console.log(
        `[auth/pi] migrated legacy user ${byUsername.id} to piUserId ${piUserId} ` +
          `(balance ${byUsername.ppaBalance} carried over)`
      );
    } else {
      // Brand new user. Created at zero — the grant is awarded below so it
      // lands on the ledger rather than being written onto the row.
      user = await prisma.user.create({
        data: {
          piUserId,
          username: effectiveUsername,
          ppaBalance: 0,
          accuracyRate: 0,
          reputationScore: 0,
          streakDays: 0,
          tier: "NEWCOMER",
          totalPredictions: 0,
          correctPredictions: 0,
        },
      });
      isNew = true;
    }

    if (isNew) {
      // Through the gate: row lock, chained ledger entry, idempotent on the
      // Pi uid. A signup that retries pays once.
      const grant = await award({
        piUserId,
        amount: WELCOME_GRANT,
        source: "ADMIN",
        idempotencyKey: `signup:${piUserId}`,
        detail: "welcome_grant",
      });

      if (grant.ok) {
        user = { ...user, ppaBalance: grant.balance };
      } else {
        // The account exists and is usable; only the grant failed. Log it
        // rather than failing the sign-in, and let a human decide.
        console.error("[auth/pi] welcome grant refused", {
          piUserId,
          reason: grant.reason,
        });
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth/pi] error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
