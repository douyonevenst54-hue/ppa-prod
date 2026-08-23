import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_PI_USERIDS = ["douyonevenst54"];

async function requireAdmin(userId: string | null) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !ADMIN_PI_USERIDS.includes(user.username)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const admin = await requireAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const predictions = await prisma.content.findMany({
      where: { type: "prediction" },
      include: {
        _count: { select: { predictions: true } },
        creator: { select: { username: true } },
        pollOptions: { select: { id: true, text: true } },
      },
      orderBy: { endsAt: "asc" },
    });

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error("Admin predictions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}

// POST — create a match for people to predict on.
// Body: { userId, sport, team1, team2, startsAt (ISO), allowDraw, rewardPool }
export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      sport,
      team1,
      team2,
      startsAt,
      allowDraw = true,
      rewardPool = 0,
    } = await req.json();

    const admin = await requireAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!team1?.trim() || !team2?.trim() || !startsAt) {
      return NextResponse.json(
        { error: "team1, team2 and startsAt are required" },
        { status: 400 }
      );
    }

    // Absolute kickoff time — a match starts when it starts, not N days out.
    const endsAt = new Date(startsAt);
    if (Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Invalid startsAt" }, { status: 400 });
    }
    if (endsAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Kickoff time must be in the future" },
        { status: 400 }
      );
    }

    const t1 = team1.trim();
    const t2 = team2.trim();
    if (t1.toLowerCase() === t2.toLowerCase()) {
      return NextResponse.json(
        { error: "Teams must be different" },
        { status: 400 }
      );
    }

    const title = `${t1} vs ${t2}`;

    // Options are what users pick and what resolve compares against, so the
    // stored text is the answer value. Draw is optional (basketball has none).
    const optionTexts = allowDraw ? [t1, "Draw", t2] : [t1, t2];

    const content = await prisma.$transaction(async (tx) => {
      const created = await tx.content.create({
        data: {
          creatorId: admin.id,
          title,
          category: "SPORTS",
          type: "prediction",
          status: "ACTIVE",
          rewardPool: Number(rewardPool) || 0,
          endsAt,
        },
      });

      await tx.pollOption.createMany({
        data: optionTexts.map((text) => ({ contentId: created.id, text })),
      });

      return created;
    });

    return NextResponse.json(
      { prediction: { ...content, sport, options: optionTexts } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin create prediction error:", error);
    return NextResponse.json(
      { error: "Failed to create prediction" },
      { status: 500 }
    );
  }
}