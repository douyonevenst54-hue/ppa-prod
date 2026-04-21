import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      contentId,
      answer,
      confidenceLevel,
      stakeAmount,
    } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.ppaBalance < stakeAmount) {
      return NextResponse.json(
        { error: "Insufficient PPA balance" },
        { status: 400 }
      );
    }

    const CONFIDENCE_MULTIPLIERS: Record<number, number> = {
      1: 1.2,
      2: 1.8,
      3: 3.0,
    };

    const potentialReward = Math.floor(
      stakeAmount * (CONFIDENCE_MULTIPLIERS[confidenceLevel] || 1.2)
    );

    // Create prediction
    const prediction = await prisma.prediction.create({
      data: {
        userId,
        contentId,
        answer,
        confidenceLevel,
        stakeAmount,
        potentialReward,
      },
    });

    // Deduct stake from balance
    await prisma.user.update({
      where: { id: userId },
      data: { ppaBalance: { decrement: stakeAmount } },
    });

    // Log transaction
    await prisma.pPATransaction.create({
      data: {
        userId,
        amount: -stakeAmount,
        type: "spend",
        source: "prediction",
      },
    });

    // Increment participant count
    await prisma.content.update({
      where: { id: contentId },
      data: { participantCount: { increment: 1 } },
    });

    return NextResponse.json({ prediction, potentialReward });
  } catch (error) {
    console.error("Prediction submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit prediction" },
      { status: 500 }
    );
  }
}