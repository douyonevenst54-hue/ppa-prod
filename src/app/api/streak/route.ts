import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isYesterday(date: Date, today: Date): boolean {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.8;
  if (streakDays >= 7)  return 1.5;
  if (streakDays >= 3)  return 1.2;
  return 1.0;
}

function getStreakBonus(streakDays: number): number {
  if (streakDays >= 30) return 50;
  if (streakDays >= 14) return 30;
  if (streakDays >= 7)  return 20;
  if (streakDays >= 3)  return 10;
  return 5;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const today = new Date();
    const lastStreak = user.lastStreakDate;

    let newStreak = user.streakDays;
    let ppaBonus = 0;
    let streakMessage = "";
    let streakUpdated = false;

    if (!lastStreak) {
      // First time — start streak
      newStreak = 1;
      ppaBonus = getStreakBonus(1);
      streakMessage = "🔥 Streak started!";
      streakUpdated = true;

    } else if (isSameDay(lastStreak, today)) {
      // Already checked in today — no change
      streakMessage = "✅ Already checked in today";
      streakUpdated = false;

    } else if (isYesterday(lastStreak, today)) {
      // Consecutive day — extend streak
      newStreak = user.streakDays + 1;
      ppaBonus = getStreakBonus(newStreak);
      streakMessage = `🔥 ${newStreak} day streak! +${ppaBonus} PPA`;
      streakUpdated = true;

    } else {
      // Gap > 1 day — reset streak
      newStreak = 1;
      ppaBonus = getStreakBonus(1);
      streakMessage = "💔 Streak reset. Starting fresh!";
      streakUpdated = true;
    }

    if (streakUpdated) {
      const longestStreak = Math.max(newStreak, user.longestStreak || 0);

      await prisma.user.update({
        where: { id: userId },
        data: {
          streakDays: newStreak,
          lastStreakDate: today,
          lastActiveDate: today,
          longestStreak,
          ppaBalance: { increment: ppaBonus },
        },
      });

      if (ppaBonus > 0) {
        await prisma.pPATransaction.create({
          data: {
            userId,
            amount: ppaBonus,
            type: "earn",
            source: `streak_day_${newStreak}`,
          },
        });
      }
    }

    const multiplier = getStreakMultiplier(newStreak);

    return NextResponse.json({
      streakDays: newStreak,
      streakUpdated,
      ppaBonus,
      multiplier,
      message: streakMessage,
      longestStreak: Math.max(newStreak, user.longestStreak || 0),
    });

  } catch (error) {
    console.error("Streak error:", error);
    return NextResponse.json(
      { error: "Failed to update streak" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        streakDays: true,
        lastStreakDate: true,
        longestStreak: true,
        ppaBalance: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const today = new Date();
    const lastStreak = user.lastStreakDate;

    let streakStatus: "active" | "at_risk" | "broken" = "active";

    if (!lastStreak) {
      streakStatus = "broken";
    } else if (isSameDay(lastStreak, today)) {
      streakStatus = "active";
    } else if (isYesterday(lastStreak, today)) {
      streakStatus = "at_risk";
    } else {
      streakStatus = "broken";
    }

    return NextResponse.json({
      streakDays: user.streakDays,
      longestStreak: user.longestStreak,
      multiplier: getStreakMultiplier(user.streakDays),
      streakStatus,
      checkedInToday: lastStreak ? isSameDay(lastStreak, today) : false,
    });

  } catch (error) {
    console.error("Streak fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch streak" },
      { status: 500 }
    );
  }
}