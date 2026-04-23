import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.8;
  if (streakDays >= 7)  return 1.5;
  if (streakDays >= 3)  return 1.2;
  return 1.0;
}

const TIER_MULTIPLIERS: Record<string, number> = {
  NEWCOMER: 0.8,
  MEMBER: 1.0,
  TRUSTED: 1.2,
  EXPERT: 1.5,
  ELITE: 2.0,
};

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      challengeId,
      correct,
      total,
      timeSeconds,
      streakDays,
      tier,
    } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate reward breakdown
    const accuracy = correct / total;
    const accuracySquared = Math.pow(accuracy, 2);
    const maxTime = total * 15;
    const speedRatio = Math.max(0, (maxTime - timeSeconds) / maxTime);
    const streakMultiplier = getStreakMultiplier(streakDays || user.streakDays);
    const tierMultiplier = TIER_MULTIPLIERS[tier || user.tier] || 1.0;
    const base = 20;

    const baseReward = Math.floor(base * accuracySquared);
    const speedBonus = Math.floor(base * accuracySquared * speedRatio);
    const streakBonus = Math.floor(
      base * accuracySquared * (streakMultiplier - 1)
    );
    const tierBonus = Math.floor(
      base * accuracySquared * (tierMultiplier - 1)
    );
    const ppaEarned = baseReward + speedBonus + streakBonus + tierBonus;

    // Update user stats
    const newTotalPredictions = user.totalPredictions + total;
    const newCorrectPredictions = user.correctPredictions + correct;
    const newAccuracyRate = newCorrectPredictions / newTotalPredictions;

    // Determine new tier
    function getTier(accuracy: number, total: number): string {
      if (total < 10) return "NEWCOMER";
      if (accuracy >= 0.85 && total >= 50) return "ELITE";
      if (accuracy >= 0.75 && total >= 30) return "EXPERT";
      if (accuracy >= 0.65 && total >= 20) return "TRUSTED";
      if (total >= 10) return "MEMBER";
      return "NEWCOMER";
    }

    const newTier = getTier(newAccuracyRate, newTotalPredictions);
    const newReputation = parseFloat(
      (newAccuracyRate * 10 * streakMultiplier).toFixed(2)
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        ppaBalance: { increment: ppaEarned },
        correctPredictions: { increment: correct },
        totalPredictions: { increment: total },
        accuracyRate: newAccuracyRate,
        reputationScore: newReputation,
        tier: newTier as "NEWCOMER" | "MEMBER" | "TRUSTED" | "EXPERT" | "ELITE",
        lastActiveDate: new Date(),
      },
    });

    // Log transaction
    if (ppaEarned > 0) {
      await prisma.pPATransaction.create({
        data: {
          userId,
          amount: ppaEarned,
          type: "earn",
          source: `challenge_${challengeId || "unknown"}`,
        },
      });
    }

    return NextResponse.json({
      ppaEarned,
      baseReward,
      speedBonus,
      streakBonus,
      tierBonus,
      correct,
      total,
      newAccuracyRate,
      newTier,
      newReputation,
    });

  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit results" },
      { status: 500 }
    );
  }
}