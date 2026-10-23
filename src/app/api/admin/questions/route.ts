import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isAdminUsername } from "@/lib/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";

    // Identity from the bearer token, not from ?userId= — the caller does not
    // get to nominate who it is being checked against.
    const session = await getSessionUser(req);
    if (!session || !isAdminUsername(session.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questions = await prisma.question.findMany({
      where: {
        contentId: null, // standalone questions only
        ...(category !== "ALL" && { category: category as never }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const stats = await prisma.question.groupBy({
      by: ["category"],
      _count: { id: true },
      where: { contentId: null },
    });

    return NextResponse.json({ questions, stats });
  } catch (error) {
    console.error("Questions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");

    const session = await getSessionUser(req);
    if (!session || !isAdminUsername(session.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.question.delete({ where: { id: questionId || "" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}