import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const apps = await prisma.pPAApp.findMany({
      orderBy: { userCount: "desc" },
    });

    const totalUsers = await prisma.user.count();
    const totalPPA = await prisma.user.aggregate({
      _sum: { ppaBalance: true },
    });
    const totalTransactions = await prisma.pPATransaction.count();
    const totalEarned = await prisma.pPATransaction.aggregate({
      where: { type: "earn" },
      _sum: { amount: true },
    });
    const totalSpent = await prisma.pPATransaction.aggregate({
      where: { type: "spend" },
      _sum: { amount: true },
    });

    return NextResponse.json({
      ecosystem: {
        totalApps: apps.length,
        totalUsers,
        totalPPAInCirculation: totalPPA._sum.ppaBalance || 0,
        totalTransactions,
        totalEarned: totalEarned._sum.amount || 0,
        totalSpent: Math.abs(totalSpent._sum.amount || 0),
      },
      apps,
    });
  } catch (error) {
    console.error("Ecosystem stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}