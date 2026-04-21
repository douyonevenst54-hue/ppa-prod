import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ppaBalance: true },
    });

    const transactions = await prisma.pPATransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTx = transactions.filter(
      t => new Date(t.createdAt) >= today
    );

    const todayEarned = todayTx
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const todaySpent = todayTx
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return NextResponse.json({
      balance: user?.ppaBalance || 0,
      todayEarned,
      todaySpent,
      transactions,
    });
  } catch (error) {
    console.error("Wallet error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}