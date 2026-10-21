/**
 * GET /api/me/summary — everything the home screen shows, in one request.
 *
 * The home page has always been a server component fetching public endpoints,
 * so it could not show a signed-in player anything about themselves. That is
 * why it carried a mockLeaderboard with invented usernames as its first-launch
 * fallback. One authenticated call replaces both.
 *
 * ── NOTHING HERE IS INVENTED ──────────────────────────────────────────────
 *
 * Every number is read or counted. Where there is no data — a new player with
 * no challenges answered — the field is null and the screen says so plainly
 * rather than showing a zero dressed up as a score. A fabricated streak is a
 * small lie that makes every real number next to it less believable.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureDailyChallenges, utcDayStart } from "@/lib/ppa/rotation";
import { tierStatus, unlockedDifficulties, utcDateKey } from "@/lib/ppa/daily-challenge";

export const dynamic = "force-dynamic";

const WEEK = 7;

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const day = utcDayStart();

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      username: true,
      ppaBalance: true,
      reputationScore: true,
      accuracyRate: true,
      streakDays: true,
      longestStreak: true,
      tier: true,
      totalChallenges: true,
      correctChallenges: true,
    },
  });

  const sets = await ensureDailyChallenges();
  const unlocked = new Set(unlockedDifficulties(me.reputationScore));

  // Which of today's tiers are already done. Per day, because the pool
  // recycles and a question answered last week says nothing about today.
  const todaysIds = sets.flatMap((s) => s.questionIds);
  const answeredToday = await prisma.challengeResult.findMany({
    where: { userId: session.id, questionId: { in: todaysIds }, day },
    select: { questionId: true },
  });
  const answered = new Set(answeredToday.map((a) => a.questionId));

  const tiers = sets.map((set) => ({
    difficulty: set.difficulty,
    title: set.title,
    category: set.category,
    questionCount: set.questionIds.length,
    unlocked: unlocked.has(set.difficulty),
    completed: set.questionIds.every((id) => answered.has(id)),
  }));

  /* ---- the shared-set figure: how many people played today ---- */

  // The whole point of one question set per day is that everyone answers the
  // same thing, which is what makes the leaderboard comparable. Saying how
  // many have played is the one number that expresses it.
  const playedToday = await prisma.challengeResult.findMany({
    where: { day, questionId: { in: todaysIds } },
    select: { userId: true },
    distinct: ["userId"],
  });

  /* ---- the last seven days of play, for the streak strip ---- */

  const since = new Date(day);
  since.setUTCDate(since.getUTCDate() - (WEEK - 1));

  const recent = await prisma.challengeResult.findMany({
    where: { userId: session.id, day: { gte: since } },
    select: { day: true },
    distinct: ["day"],
  });
  const playedDays = new Set(recent.map((r) => r.day.toISOString().slice(0, 10)));

  const week = Array.from({ length: WEEK }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { date: key, played: playedDays.has(key) };
  });

  /* ---- standings ---- */

  const top = await prisma.user.findMany({
    where: { leaderboardOptOut: false, deletedAt: null, totalChallenges: { gt: 0 } },
    orderBy: { reputationScore: "desc" },
    take: 3,
    select: { username: true, reputationScore: true, tier: true, accuracyRate: true },
  });

  const myRank =
    me.totalChallenges > 0
      ? (await prisma.user.count({
          where: {
            leaderboardOptOut: false,
            deletedAt: null,
            totalChallenges: { gt: 0 },
            reputationScore: { gt: me.reputationScore },
          },
        })) + 1
      : null;

  return NextResponse.json({
    date: utcDateKey(),
    username: me.username,
    balance: me.ppaBalance,
    reputation: Number(me.reputationScore.toFixed(1)),
    tier: me.tier,
    // null rather than 0 for a player who has not answered anything: an
    // accuracy of "0%" reads as a bad score, not as an absent one.
    accuracy: me.totalChallenges > 0 ? Math.round(me.accuracyRate * 100) : null,
    answered: me.totalChallenges,
    correct: me.correctChallenges,
    streakDays: me.streakDays,
    longestStreak: me.longestStreak,
    week,
    tiers,
    tierStatus: tierStatus(me.reputationScore),
    playedToday: playedToday.length,
    rank: myRank,
    top: top.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      reputation: Number(u.reputationScore.toFixed(1)),
      accuracy: Math.round(u.accuracyRate * 100),
      tier: u.tier,
      isMe: u.username === me.username,
    })),
  });
}
