import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, pollOptionId, ppaWeight } = await req.json();

    // Check already voted
    const existing = await prisma.pollVote.findUnique({
      where: { userId_pollOptionId: { userId, pollOptionId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already voted" },
        { status: 400 }
      );
    }

    // Create vote
    const vote = await prisma.pollVote.create({
      data: { userId, pollOptionId, ppaWeight: ppaWeight || 0 },
    });

    // Increment vote count
    await prisma.pollOption.update({
      where: { id: pollOptionId },
      data: { voteCount: { increment: 1 } },
    });

    // Reward 5 PPA for voting
    await prisma.user.update({
      where: { id: userId },
      data: { ppaBalance: { increment: 5 } },
    });

    await prisma.pPATransaction.create({
      data: {
        userId,
        amount: 5,
        type: "earn",
        source: "poll",
      },
    });

    return NextResponse.json({ vote, ppaEarned: 5 });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json(
      { error: "Failed to submit vote" },
      { status: 500 }
    );
  }
}