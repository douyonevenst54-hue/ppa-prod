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

    // Migration path: legacy rows had username copied into piUserId.
    // If we find a row with piUserId === current username but no row with
    // the real piUserId yet, update the legacy row in place.
    if (piUserId !== username) {
      const legacy = await prisma.user.findUnique({ where: { piUserId: username } });
      const real = await prisma.user.findUnique({ where: { piUserId } });
      if (legacy && !real) {
        const migrated = await prisma.user.update({
          where: { id: legacy.id },
          data: { piUserId, username, lastActiveDate: new Date() },
        });
        return NextResponse.json({ user: migrated });
      }
    }

    // Standard upsert by piUserId — create if new, update if existing.
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