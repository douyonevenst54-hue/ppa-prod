import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const prediction = await prisma.content.findUnique({
      where: { id },
      include: {
        creator: { select: { username: true } },
        _count: { select: { predictions: true } },
      },
    });

    if (!prediction) {
      return NextResponse.json(
        { error: "Prediction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ prediction });
  } catch (error) {
    console.error("Prediction fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prediction" },
      { status: 500 }
    );
  }
}