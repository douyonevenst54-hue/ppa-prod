// src/app/api/payments/complete/route.ts
//
// Completes a Pi payment that already has a blockchain txid.
// Used by onIncompletePaymentFound when the SDK reports an orphaned
// payment whose transaction went through but was never completed
// server-side (the cause of `ongoing_payment_found` blockers).

import { NextRequest, NextResponse } from "next/server";

const PI_API_BASE = "https://api.minepi.com/v2";

export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "paymentId required" },
        { status: 400 }
      );
    }
    if (!txid || typeof txid !== "string") {
      return NextResponse.json({ error: "txid required" }, { status: 400 });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      console.error("[payments/complete] PI_API_KEY not configured");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const res = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error(
        `[payments/complete] Pi API returned ${res.status}:`,
        data
      );
      return NextResponse.json(
        { error: "Pi completion failed", detail: data },
        { status: res.status }
      );
    }

    console.log(`[payments/complete] Completed payment ${paymentId}`);
    return NextResponse.json({ success: true, payment: data });
  } catch (error) {
    console.error("[payments/complete] error:", error);
    return NextResponse.json(
      { error: "Completion failed" },
      { status: 500 }
    );
  }
}