/**
 * Completes a Pi payment that already has a blockchain txid.
 *
 * Called by onIncompletePaymentFound when the SDK reports an orphaned payment
 * whose transaction went through but was never completed server-side.
 *
 * ── THIS ROUTE WAS COSTING USERS REAL PI ──────────────────────────────────
 *
 * The old handler completed the payment with Pi and returned success — and
 * never credited any PPA. That is not a cosmetic gap. Consider the sequence
 * that actually happens:
 *
 *   1. A user tops up. The Pi transaction settles.
 *   2. Something interrupts before our completion call — closed tab, dropped
 *      connection, a 502. The payment is now orphaned.
 *   3. On next launch the SDK fires onIncompletePaymentFound, which posts here.
 *   4. This route completes the payment on Pi's side. Success.
 *   5. No PPA is credited. And because Pi now considers the payment completed,
 *      /api/ppa/topup/complete can never complete it again — Pi rejects it, our
 *      handler returns 502, and the credit never happens.
 *
 * The user paid real Pi and received nothing, permanently, and the recovery
 * path is what closed the door. Orphan handling has to credit, or it isn't
 * recovery — it's just cleanup of Pi's records at the user's expense.
 *
 * Now: session required, ownership verified, and the credit runs through
 * creditTopUp() which is idempotent on `topup:{paymentId}`. Completing a
 * payment that was already credited pays nothing extra; completing one that
 * wasn't finally pays it.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { creditTopUp } from "@/lib/ppa/award";
import { PI_TO_PPA_RATE } from "@/lib/ppa/policy";

export const dynamic = "force-dynamic";

const PI_API = "https://api.minepi.com/v2";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { paymentId, txid } = (await req.json()) as {
    paymentId?: string;
    txid?: string;
  };

  if (!paymentId || typeof paymentId !== "string") {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }
  if (!txid || typeof txid !== "string") {
    return NextResponse.json({ error: "txid required" }, { status: 400 });
  }

  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    console.error("[payments/complete] PI_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const lookup = await fetch(`${PI_API}/payments/${paymentId}`, {
    headers: { Authorization: `Key ${apiKey}` },
    cache: "no-store",
  });
  if (!lookup.ok) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const payment = (await lookup.json()) as {
    amount?: number | string;
    user_uid?: string;
    status?: { transaction_verified?: boolean; developer_completed?: boolean };
  };

  if (payment.user_uid !== session.piUserId) {
    return NextResponse.json(
      { error: "Payment belongs to another account" },
      { status: 403 },
    );
  }

  const amountPi = Number(payment.amount);
  if (!Number.isFinite(amountPi) || amountPi <= 0) {
    return NextResponse.json({ error: "Payment has no amount" }, { status: 400 });
  }

  const ppaAmount = Math.floor(amountPi * PI_TO_PPA_RATE);

  // An orphan may predate any TopUp row — the interruption could have happened
  // before approval recorded one. Reconstruct it from Pi's own record.
  await prisma.topUp.upsert({
    where: { piPaymentId: paymentId },
    create: {
      piPaymentId: paymentId,
      userId: session.id,
      amountPi: amountPi.toString(),
      ppaAmount,
      status: "APPROVED",
      piTxid: txid,
    },
    update: { piTxid: txid },
  });

  // Tell Pi, unless it already knows. An already-completed payment is not an
  // error here — it's the exact case this route exists to rescue, and refusing
  // it would leave the credit unpaid forever.
  if (!payment.status?.developer_completed) {
    const complete = await fetch(`${PI_API}/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
      cache: "no-store",
    });

    if (!complete.ok) {
      const detail = await complete.text().catch(() => "");
      console.error("[payments/complete] Pi returned", complete.status, detail);
      // Fall through anyway: if the transaction is verified on chain, the user
      // has paid, and withholding their PPA over a completion-call failure is
      // the wrong side to err on. The TopUp row records what happened.
      if (!payment.status?.transaction_verified) {
        await prisma.topUp.update({
          where: { piPaymentId: paymentId },
          data: { status: "FAILED" },
        });
        return NextResponse.json(
          { error: "Pi completion failed", detail },
          { status: 502 },
        );
      }
    }
  }

  // Idempotent on `topup:{paymentId}` — a payment already credited pays nothing
  // extra, one that was never credited finally gets paid.
  const result = await creditTopUp({
    piUserId: session.piUserId,
    amount: ppaAmount,
    piPaymentId: paymentId,
  });

  return NextResponse.json({
    success: true,
    credited: result.replay ? 0 : result.applied,
    balance: result.balance,
    recovered: result.replay ? false : true,
  });
}
