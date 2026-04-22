import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Exchange rates
const PI_TO_PPA = 1000;      // 1π = 1000 PPA (buying)
const PPA_TO_PI = 0.0008;    // 1000 PPA = 0.8π (selling — 20% spread)
const BURN_RATE = 0.03;      // 3% burned on redemption
const MIN_REDEEM = 5000;     // Minimum PPA to redeem
const MIN_ACCURACY = 0.65;   // 65% accuracy required

export async function POST(req: NextRequest) {
  try {
    const { userId, direction, amount, paymentId, txid } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── BUY: $Pi → PPA ──────────────────────────────
    if (direction === "buy") {
      const ppaAmount = Math.floor(amount * PI_TO_PPA);

      // Complete Pi payment
      const piRes = await fetch(
        `https://api.minepi.com/v2/payments/${paymentId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.PI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ txid }),
        }
      );

      if (!piRes.ok) {
        return NextResponse.json(
          { error: "Pi payment completion failed" },
          { status: 400 }
        );
      }

      // Award PPA
      await prisma.user.update({
        where: { id: userId },
        data: { ppaBalance: { increment: ppaAmount } },
      });

      await prisma.pPATransaction.create({
        data: {
          userId,
          amount: ppaAmount,
          type: "earn",
          source: `pi_exchange_buy_${amount}pi`,
        },
      });

      return NextResponse.json({
        success: true,
        direction: "buy",
        piSpent: amount,
        ppaReceived: ppaAmount,
        newBalance: user.ppaBalance + ppaAmount,
      });
    }

    // ── REDEEM: PPA → $Pi ───────────────────────────
    if (direction === "redeem") {
      // Eligibility checks
      if (user.ppaBalance < MIN_REDEEM) {
        return NextResponse.json({
          error: `Minimum ${MIN_REDEEM} PPA required to redeem`,
        }, { status: 400 });
      }

      if (user.accuracyRate < MIN_ACCURACY) {
        return NextResponse.json({
          error: `Minimum ${MIN_ACCURACY * 100}% accuracy required to redeem`,
        }, { status: 400 });
      }

      const burnAmount = Math.floor(amount * BURN_RATE);
      const netAmount = amount - burnAmount;
      const piAmount = parseFloat((netAmount * PPA_TO_PI).toFixed(6));

      // Deduct PPA + burn
      await prisma.user.update({
        where: { id: userId },
        data: { ppaBalance: { decrement: amount } },
      });

      await prisma.pPATransaction.create({
        data: {
          userId,
          amount: -amount,
          type: "burn",
          source: `pi_exchange_redeem_${piAmount}pi`,
        },
      });

      // NOTE: Actual $Pi payout requires server-side Pi wallet
      // This logs the redemption request for manual/automated processing
      return NextResponse.json({
        success: true,
        direction: "redeem",
        ppaSpent: amount,
        ppaBurned: burnAmount,
        piToReceive: piAmount,
        status: "pending",
        message: "Redemption queued. Pi will be sent within 24 hours.",
      });
    }

    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });

  } catch (error) {
    console.error("Exchange error:", error);
    return NextResponse.json(
      { error: "Exchange failed" },
      { status: 500 }
    );
  }
}