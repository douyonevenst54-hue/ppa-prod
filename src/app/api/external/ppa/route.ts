import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function validateApiKey(req: NextRequest): Promise<{ valid: boolean; app?: { id: string; name: string; slug: string } }> {
  const apiKey = req.headers.get("x-ppa-api-key");
  if (!apiKey) return { valid: false };

  const app = await prisma.pPAApp.findUnique({
    where: { apiKey },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (!app || app.status !== "ACTIVE") return { valid: false };
  return { valid: true, app };
}

export async function GET(req: NextRequest) {
  const { valid, app } = await validateApiKey(req);
  if (!valid || !app) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const piUserId = searchParams.get("piUserId");

  if (!piUserId) {
    return NextResponse.json({ error: "piUserId required" }, { status: 400 });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { piUserId },
      select: {
        id: true,
        piUserId: true,
        username: true,
        ppaBalance: true,
        tier: true,
        streakDays: true,
        accuracyRate: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user, app: app.name });
  } catch (error) {
    console.error("PPA external fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { valid, app } = await validateApiKey(req);
  if (!valid || !app) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, piUserId, username, amount, source } = await req.json();

    // Find or create user
    let user = await prisma.user.findUnique({ where: { piUserId } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          piUserId,
          username: username || piUserId,
          ppaBalance: 0,
          tier: "NEWCOMER",
          accuracyRate: 0,
          reputationScore: 0,
          streakDays: 0,
          totalPredictions: 0,
          correctPredictions: 0,
        },
      });

      // Increment app user count
      await prisma.pPAApp.update({
        where: { id: app.id },
        data: { userCount: { increment: 1 } },
      });
    }

    if (action === "credit") {
      const updated = await prisma.user.update({
        where: { piUserId },
        data: { ppaBalance: { increment: amount } },
      });

      await prisma.pPATransaction.create({
        data: {
          userId: user.id,
          amount,
          type: "earn",
          source: `${app.slug}_${source || "reward"}`,
        },
      });

      await prisma.pPAApp.update({
        where: { id: app.id },
        data: { totalEarned: { increment: amount } },
      });

      // Log ecosystem transaction
      await prisma.ecosystemTransaction.create({
        data: {
          appId: app.id,
          piUserId,
          username: username || piUserId,
          amount,
          type: "earn",
          source: source || "reward",
        },
      });

      return NextResponse.json({
        success: true,
        newBalance: updated.ppaBalance,
        app: app.name,
      });

    } else if (action === "debit") {
      if (user.ppaBalance < amount) {
        return NextResponse.json(
          { error: "Insufficient PPA balance" },
          { status: 400 }
        );
      }

      const updated = await prisma.user.update({
        where: { piUserId },
        data: { ppaBalance: { decrement: amount } },
      });

      await prisma.pPATransaction.create({
        data: {
          userId: user.id,
          amount: -amount,
          type: "spend",
          source: `${app.slug}_${source || "spend"}`,
        },
      });

      await prisma.pPAApp.update({
        where: { id: app.id },
        data: { totalSpent: { increment: amount } },
      });

      await prisma.ecosystemTransaction.create({
        data: {
          appId: app.id,
          piUserId,
          username: username || piUserId,
          amount: -amount,
          type: "spend",
          source: source || "spend",
        },
      });

      return NextResponse.json({
        success: true,
        newBalance: updated.ppaBalance,
        app: app.name,
      });

    } else if (action === "exchange") {
      const ppaAmount = Math.floor(amount * 1000);

      const updated = await prisma.user.update({
        where: { piUserId },
        data: { ppaBalance: { increment: ppaAmount } },
      });

      await prisma.pPATransaction.create({
        data: {
          userId: user.id,
          amount: ppaAmount,
          type: "earn",
          source: `${app.slug}_pi_exchange_${amount}pi`,
        },
      });

      await prisma.pPAApp.update({
        where: { id: app.id },
        data: { totalEarned: { increment: ppaAmount } },
      });

      await prisma.ecosystemTransaction.create({
        data: {
          appId: app.id,
          piUserId,
          username: username || piUserId,
          amount: ppaAmount,
          type: "exchange",
          source: `pi_exchange_${amount}pi`,
        },
      });

      return NextResponse.json({
        success: true,
        ppaReceived: ppaAmount,
        newBalance: updated.ppaBalance,
        app: app.name,
      });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error("PPA external action error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}