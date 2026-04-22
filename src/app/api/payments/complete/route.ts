import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid, userId, ppaReward } = await req.json();

    if (!paymentId || !txid) {
      return NextResponse.json(
        { error: "paymentId and txid required" },
        { status: 400 }
      );
    }

    // Complete payment with Pi Network
    const res = await fetch(
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

    const data = await res.json();

    if (!res.ok) {
      console.error("Pi complete error:", data);
      return NextResponse.json(
        { error: "Failed to complete payment" },
        { status: 400 }
      );
    }

    // Award PPA if applicable
    if (userId && ppaReward) {
      await prisma.user.update({
        where: { id: userId },
        data: { ppaBalance: { increment: ppaReward } },
      });

      await prisma.pPATransaction.create({
        data: {
          userId,
          amount: ppaReward,
          type: "earn",
          source: "pi_payment_reward",
        },
      });
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (error) {
    console.error("Complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete payment" },
      { status: 500 }
    );
  }
}