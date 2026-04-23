import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const content = await prisma.content.findMany({
      where: { creatorId: userId },
      select: {
        type: true,
        participantCount: true,
      },
    });

    const totalCreated = content.length;
    const predictions = content.filter(c => c.type === "prediction").length;
    const polls = content.filter(c => c.type === "poll").length;
    const challenges = content.filter(c => c.type === "challenge").length;

    // Calculate earnings from engagement
    const totalEngagement = content.reduce((sum, c) => sum + c.participantCount, 0);
    const totalEarned = Math.floor(totalEngagement * 2); // 2 PPA per engagement

    return NextResponse.json({
      stats: {
        totalCreated,
        totalEarned,
        predictions,
        polls,
        challenges,
      },
    });
  } catch (error) {
    console.error("Creator stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}