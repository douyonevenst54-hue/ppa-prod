import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Exchange rates
const PI_TO_PPA = 1000;      // 1π = 1000 PPA (buying)
// Redemption constants (PPA_TO_PI, BURN_RATE, MIN_REDEEM, MIN_ACCURACY) are
// disabled along with the redeem path. They will be reintroduced when A2U
// payouts ship.

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
    // TEMPORARILY DISABLED: A2U (App-to-User) Pi payments are under
    // development. The previous implementation burned PPA without sending
    // Pi. Redemption is disabled at the API layer until A2U ships.
    if (direction === "redeem") {
      return NextResponse.json({
        error: "Redemption is temporarily disabled while we build proper Pi payouts. Coming soon!",
        code: "REDEEM_DISABLED",
      }, { status: 503 });
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