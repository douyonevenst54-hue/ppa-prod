import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const polls = await prisma.content.findMany({
      where: {
        type: "poll",
        status: "ACTIVE",
        endsAt: { gt: new Date() },
      },
      include: {
        pollOptions: true,
        creator: { select: { username: true } },
        _count: { select: { pollOptions: true } },
      },
      orderBy: { participantCount: "desc" },
    });

    return NextResponse.json({ polls });
  } catch (error) {
    console.error("Polls fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch polls" },
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
      weighted,
    } = await req.json();

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const poll = await prisma.content.create({
      data: {
        creatorId,
        title,
        category,
        type: "poll",
        status: "ACTIVE",
        endsAt,
        pollOptions: {
          create: options.map((text: string) => ({ text })),
        },
      },
      include: { pollOptions: true },
    });

    return NextResponse.json({ poll });
  } catch (error) {
    console.error("Poll create error:", error);
    return NextResponse.json(
      { error: "Failed to create poll" },
      { status: 500 }
    );
  }
}