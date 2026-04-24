import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_PI_USERIDS = ["douyonevenst54"];

export async function GET(req: NextRequest) {
  try {
    const apps = await prisma.pPAApp.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        url: true,
        logoUrl: true,
        category: true,
        totalEarned: true,
        totalSpent: true,
        userCount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { userCount: "desc" },
    });

    // Global stats
    const totalPPA = await prisma.user.aggregate({
      _sum: { ppaBalance: true },
    });

    const totalTransactions = await prisma.pPATransaction.count();

    return NextResponse.json({
      apps,
      stats: {
        totalApps: apps.length,
        totalPPAInCirculation: totalPPA._sum.ppaBalance || 0,
        totalTransactions,
      },
    });
  } catch (error) {
    console.error("Registry fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch registry" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, name, slug, description, url, category } = await req.json();

    // Verify admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !ADMIN_PI_USERIDS.includes(user.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate API key
    const apiKey = `ppa_${slug}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

    const app = await prisma.pPAApp.create({
      data: {
        name,
        slug,
        description,
        url,
        category: category || "GENERAL",
        apiKey,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ app, apiKey });
  } catch (error) {
    console.error("Registry create error:", error);
    return NextResponse.json(
      { error: "Failed to register app" },
      { status: 500 }
    );
  }
}