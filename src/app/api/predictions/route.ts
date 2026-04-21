import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const predictions = await prisma.content.findMany({
      where: {
        type: "prediction",
        status: "ACTIVE",
        endsAt: { gt: new Date() },
      },
      include: {
        creator: { select: { username: true } },
        _count: { select: { predictions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error("Predictions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      creatorId,
      title,
      category,
      options,
      durationDays,
      rewardPool,
    } = await req.json();

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const prediction = await prisma.content.create({
      data: {
        creatorId,
        title,
        category,
        type: "prediction",
        status: "ACTIVE",
        rewardPool: rewardPool || 0,
        endsAt,
      },
    });

    return NextResponse.json({ prediction });
  } catch (error) {
    console.error("Prediction create error:", error);
    return NextResponse.json(
      { error: "Failed to create prediction" },
      { status: 500 }
    );
  }
}