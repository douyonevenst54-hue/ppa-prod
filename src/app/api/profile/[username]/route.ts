import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        tier: true,
        accuracyRate: true,
        reputationScore: true,
        streakDays: true,
        longestStreak: true,
        totalPredictions: true,
        correctPredictions: true,
        createdAt: true,
        createdContent: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            title: true,
            type: true,
            category: true,
            participantCount: true,
            endsAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            createdContent: true,
            predictions: true,
            pollVotes: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}