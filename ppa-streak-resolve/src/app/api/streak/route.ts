/**
 * Daily streak check-in.
 *
 * ── WHAT CHANGED ──────────────────────────────────────────────────────────
 *
 *  1. AUTHENTICATED. `userId` came from the request body, so anyone could
 *     check in as anyone — including bots keeping dormant accounts' streaks
 *     alive to inflate their multipliers.
 *
 *  2. UTC DAYS. `isSameDay` compared local calendar fields via getFullYear /
 *     getMonth / getDate, so "today" depended on the server's timezone and the
 *     `isYesterday` arithmetic could double-count or skip a day across a DST
 *     boundary. Everything is UTC now, matching the emission gate — otherwise a
 *     user's streak day and their cap day are different days.
 *
 *  3. RACE-PROOF. Two concurrent check-ins both read `lastStreakDate`, both saw
 *     yesterday, and both incremented and paid. The date claim below is a
 *     single conditional UPDATE: exactly one request can win it, without a lock.
 *
 *  4. PAID THROUGH THE GATE. The bonus goes through award(), so it lands on the
 *     hash chain and counts against the STREAK daily cap. The idempotency key
 *     includes the UTC date, so a double-tapped check-in pays once.
 *
 * The streak ladder itself is unchanged: 3/7/14/30 days, 1.2x through 2.0x,
 * bonus 5 through 50 PPA.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { award } from "@/lib/ppa/award";
import { streakMultiplier } from "@/lib/ppa/rewards";

export const dynamic = "force-dynamic";

/** Midnight UTC of the day `date` falls in. */
function utcDayStart(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** "2026-08-25" — the date component of the idempotency key. */
function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function streakBonus(streakDays: number): number {
  if (streakDays >= 30) return 50;
  if (streakDays >= 14) return 30;
  if (streakDays >= 7) return 20;
  if (streakDays >= 3) return 10;
  return 5;
}

type StreakStatus = "active" | "at_risk" | "broken";

function statusFor(lastStreakDate: Date | null, now: Date): StreakStatus {
  if (!lastStreakDate) return "broken";
  const today = utcDayStart(now).getTime();
  const last = utcDayStart(lastStreakDate).getTime();
  const DAY = 86_400_000;
  if (last === today) return "active";
  if (last === today - DAY) return "at_risk";
  return "broken";
}

// ──────────────────────────────────────────────────────────────────────────
// POST — check in
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = utcDayStart(now);

  const before = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      streakDays: true,
      longestStreak: true,
      lastStreakDate: true,
      ppaBalance: true,
    },
  });

  // Claim today, atomically. The WHERE clause is the whole concurrency story:
  // only a row whose lastStreakDate is null or before today can be updated, so
  // of two simultaneous requests exactly one gets count === 1.
  const claim = await prisma.user.updateMany({
    where: {
      id: session.id,
      OR: [{ lastStreakDate: null }, { lastStreakDate: { lt: todayStart } }],
    },
    data: { lastStreakDate: now, lastActiveDate: now },
  });

  if (claim.count === 0) {
    return NextResponse.json({
      streakDays: before.streakDays,
      streakUpdated: false,
      ppaBonus: 0,
      multiplier: streakMultiplier(before.streakDays),
      message: "Already checked in today",
      longestStreak: before.longestStreak,
      balance: before.ppaBalance,
    });
  }

  // We won the claim. Decide continue-or-reset from what we read before it.
  const wasYesterday =
    before.lastStreakDate !== null &&
    utcDayStart(before.lastStreakDate).getTime() ===
      todayStart.getTime() - 86_400_000;

  const newStreak = wasYesterday ? before.streakDays + 1 : 1;
  const isReset = !wasYesterday && before.lastStreakDate !== null;
  const longestStreak = Math.max(newStreak, before.longestStreak ?? 0);

  await prisma.user.update({
    where: { id: session.id },
    data: { streakDays: newStreak, longestStreak },
  });

  const bonus = streakBonus(newStreak);

  const result = await award({
    piUserId: session.piUserId,
    amount: bonus,
    source: "STREAK",
    // The date makes this unique per day and stable within it.
    idempotencyKey: `streak:${session.piUserId}:${utcDateKey(now)}`,
    allowPartial: true,
    detail: `day_${newStreak}`,
  });

  const message = isReset
    ? "Streak reset. Starting fresh."
    : newStreak === 1
      ? "Streak started."
      : `${newStreak} day streak.`;

  return NextResponse.json({
    streakDays: newStreak,
    streakUpdated: true,
    ppaBonus: result.applied,
    multiplier: streakMultiplier(newStreak),
    message,
    longestStreak,
    balance: result.balance,
    // Told plainly rather than silently paying less than the message promised.
    capped: result.applied < bonus,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// GET — read your own streak
// ──────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Reads the session user only. The old version took a userId from the query
  // string, which let anyone read anyone's streak state.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { streakDays: true, lastStreakDate: true, longestStreak: true },
  });

  const now = new Date();

  return NextResponse.json({
    streakDays: user.streakDays,
    longestStreak: user.longestStreak,
    multiplier: streakMultiplier(user.streakDays),
    streakStatus: statusFor(user.lastStreakDate, now),
    checkedInToday: statusFor(user.lastStreakDate, now) === "active",
  });
}
