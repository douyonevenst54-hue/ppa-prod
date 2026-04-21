import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "predictors";

    if (type === "predictors") {
      const users = await prisma.user.findMany({
        where: { totalPredictions: { gt: 0 } },
        orderBy: { accuracyRate: "desc" },
        take: 20,
        select: {
          id: true,
          username: true,
          accuracyRate: true,
          reputationScore: true,
          tier: true,
          streakDays: true,
        },
      });
      return NextResponse.json({ users });
    }

    if (type === "players") {
      const users = await prisma.user.findMany({
        orderBy: { reputationScore: "desc" },
        take: 20,
        select: {
          id: true,
          username: true,
          reputationScore: true,
          accuracyRate: true,
          tier: true,
          streakDays: true,
        },
      });
      return NextResponse.json({ users });
    }

    if (type === "creators") {
      const users = await prisma.user.findMany({
        where: { createdContent: { some: {} } },
        orderBy: { reputationScore: "desc" },
        take: 20,
        select: {
          id: true,
          username: true,
          reputationScore: true,
          tier: true,
          _count: { select: { createdContent: true } },
        },
      });
      return NextResponse.json({ users });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}