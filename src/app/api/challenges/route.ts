import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const challenges = await prisma.content.findMany({
      where: {
        type: "challenge",
        status: "ACTIVE",
        endsAt: { gt: new Date() },
      },
      include: {
        questions: true,
        creator: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error("Challenges fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const {
      creatorId,
      title,
      category,
      difficulty,
      questions,
      rewardPool,
      durationDays,
    } = await req.json();

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const challenge = await prisma.content.create({
      data: {
        creatorId,
        title,
        category,
        type: "challenge",
        status: "ACTIVE",
        rewardPool: rewardPool || 0,
        endsAt,
        questions: {
          create: questions.map((q: {
            text: string;
            options: string[];
            correctAnswer: string;
            timeSeconds: number;
          }) => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            category,
            difficulty: difficulty || "MEDIUM",
            qualityScore: 7,
          })),
        },
      },
      include: { questions: true },
    });

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error("Challenge create error:", error);
    return NextResponse.json(
      { error: "Failed to create challenge" },
      { status: 500 }
    );
  }
}