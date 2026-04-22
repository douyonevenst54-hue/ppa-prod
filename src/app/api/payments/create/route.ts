import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, amount, memo, metadata } = await req.json();

    if (!userId || !amount || !memo) {
      return NextResponse.json(
        { error: "userId, amount and memo required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Log pending transaction
    const transaction = await prisma.pPATransaction.create({
      data: {
        userId,
        amount: Math.floor(amount * 1000), // store in millipis
        type: "pi_payment",
        source: memo,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      amount,
      memo,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("Payment create error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}