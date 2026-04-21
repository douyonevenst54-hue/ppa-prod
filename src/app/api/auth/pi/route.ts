import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { piUserId, username } = await req.json();

    if (!piUserId || !username) {
      return NextResponse.json(
        { error: "piUserId and username are required" },
        { status: 400 }
      );
    }

    // Upsert user — create if not exists, return if exists
    const user = await prisma.user.upsert({
      where: { piUserId },
      update: {
        username,
        lastActiveDate: new Date(),
      },
      create: {
        piUserId,
        username,
        ppaBalance: 100,
        accuracyRate: 0,
        reputationScore: 0,
        streakDays: 0,
        tier: "NEWCOMER",
        totalPredictions: 0,
        correctPredictions: 0,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}