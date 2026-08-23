import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONFIDENCE_MULTIPLIERS: Record<number, number> = {
  1: 1.2,
  2: 1.8,
  3: 3.0,
};

export async function POST(req: NextRequest) {
  try {
    const { userId, contentId, answer, confidenceLevel, stakeAmount } =
      await req.json();

    // TODO: replace body-supplied userId with the Pi access-token check used
    // elsewhere (Path B /v2/me). Right now any caller can submit as any user
    // and spend that user's balance.

    if (!userId || !contentId || !answer) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Stake must be a non-negative integer. A negative value would turn the
    // decrement below into a credit and mint PPA.
    const stake = Number(stakeAmount);
    if (!Number.isInteger(stake) || stake < 0) {
      return NextResponse.json({ error: "Invalid stake" }, { status: 400 });
    }

    const confidence = Number(confidenceLevel);
    if (!CONFIDENCE_MULTIPLIERS[confidence]) {
      return NextResponse.json(
        { error: "Invalid confidence level" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { pollOptions: { select: { text: true } } },
    });
    if (!content) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Predictions close at kickoff — otherwise a result can be predicted
    // after it's known.
    if (content.status !== "ACTIVE") {
      return NextResponse.json({ error: "Match is not open" }, { status: 400 });
    }
    if (content.endsAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Predictions are closed for this match" },
        { status: 400 }
      );
    }

    // The answer has to be one of the options this match defines.
    const validAnswers = content.pollOptions.map((o) => o.text);
    if (validAnswers.length && !validAnswers.includes(answer)) {
      return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
    }

    // One entry per user per match. Without this, staking every outcome is a
    // guaranteed profit whenever the multiplier exceeds the option count.
    const existing = await prisma.prediction.findFirst({
      where: { userId, contentId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You've already entered this match" },
        { status: 409 }
      );
    }

    if (user.ppaBalance < stake) {
      return NextResponse.json(
        { error: "Insufficient PPA balance" },
        { status: 400 }
      );
    }

    // Free entry: no stake in, no reward out. Still recorded, so it counts
    // toward accuracy and the leaderboard.
    const potentialReward =
      stake === 0
        ? 0
        : Math.floor(stake * CONFIDENCE_MULTIPLIERS[confidence]);

    const prediction = await prisma.$transaction(async (tx) => {
      const created = await tx.prediction.create({
        data: {
          userId,
          contentId,
          answer,
          confidenceLevel: confidence,
          stakeAmount: stake,
          potentialReward,
        },
      });

      if (stake > 0) {
        // Guard against a concurrent spend draining the balance between the
        // check above and this write.
        const debited = await tx.user.updateMany({
          where: { id: userId, ppaBalance: { gte: stake } },
          data: { ppaBalance: { decrement: stake } },
        });
        if (debited.count === 0) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        await tx.pPATransaction.create({
          data: {
            userId,
            amount: -stake,
            type: "spend",
            source: "prediction",
          },
        });
      }

      await tx.content.update({
        where: { id: contentId },
        data: { participantCount: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json({ prediction, potentialReward });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Insufficient PPA balance" },
        { status: 400 }
      );
    }

    // ← add here
    if (
      typeof error === "object" && error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You've already entered this match" },
        { status: 409 }
      );
    }

    console.error("Prediction submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit prediction" },
      { status: 500 }
    );
  }
}