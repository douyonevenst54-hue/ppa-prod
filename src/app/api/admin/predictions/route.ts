import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_PI_USERIDS = ["douyonevenst54"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const user = await prisma.user.findUnique({ where: { id: userId || "" } });
    if (!user || !ADMIN_PI_USERIDS.includes(user.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const predictions = await prisma.content.findMany({
      where: { type: "prediction" },
      include: {
        _count: { select: { predictions: true } },
        creator: { select: { username: true } },
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