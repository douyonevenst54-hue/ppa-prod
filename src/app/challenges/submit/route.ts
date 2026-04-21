import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function calculateReward(
  correct: number,
  total: number,
  timeSeconds: number,
  streakDays: number,
  tier: string
): number {
  const TIER_MULTIPLIERS: Record<string, number> = {
    NEWCOMER: 0.8,
    MEMBER: 1.0,
    TRUSTED: 1.2,
    EXPERT: 1.5,
    ELITE: 2.0,
  };

  const accuracy = correct / total;
  const accuracySquared = Math.pow(accuracy, 2);
  const speedBonus = Math.max(0, (total * 15 - timeSeconds) / (total * 15));
  const streakMultiplier = Math.min(1 + streakDays * 0.05, 2.0);
  const tierMultiplier = TIER_MULTIPLIERS[tier] || 1.0;
  const base = 20;

  return Math.floor(
    base * accuracySquared * (1 + speedBonus) * streakMultiplier * tierMultiplier
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId, questionResults, totalTimeSeconds } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const correct = questionResults.filter((r: { isCorrect: boolean }) => r.isCorrect).length;
    const total = questionResults.length;
    const ppaEarned = calculateReward(
      correct,
      total,
      totalTimeSeconds,
      user.streakDays,
      user.tier
    );

    // Save results
    await prisma.challengeResult.createMany({
      data: questionResults.map((r: {
        questionId: string;
        isCorrect: boolean;
        timeSeconds: number;
      }) => ({
        userId,
        questionId: r.questionId,
        isCorrect: r.isCorrect,
        timeSeconds: r.timeSeconds,
        ppaEarned: 0,
      })),
    });

    // Update user balance and accuracy
    const newTotal = user.totalPredictions + total;
    const newCorrect = user.correctPredictions + correct;
    const newAccuracy = newCorrect / newTotal;

    await prisma.user.update({
      where: { id: userId },
      data: {
        ppaBalance: { increment: ppaEarned },
        correctPredictions: { increment: correct },
        totalPredictions: { increment: total },
        accuracyRate: newAccuracy,
        lastActiveDate: new Date(),
      },
    });

    // Log transaction
    await prisma.pPATransaction.create({
      data: {
        userId,
        amount: ppaEarned,
        type: "earn",
        source: "challenge",
      },
    });

    return NextResponse.json({ ppaEarned, correct, total });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit results" },
      { status: 500 }
    );
  }
}