/**
 * Pi payment approval — including orphaned payments.
 *
 * ── WHAT WAS WRONG ────────────────────────────────────────────────────────
 *
 * The old handler took a paymentId from the body, with no session and no
 * ownership check, and approved it using PPA's API key. That made this route an
 * unauthenticated proxy to a privileged Pi API call: anyone could hand it any
 * paymentId belonging to this app and have your server approve it.
 *
 * It also recorded nothing, so an approved payment left no trace on our side —
 * which is half of why orphaned payments were hard to trace.
 *
 * Now: session required, the payment must belong to the caller, and a TopUp row
 * is created so completion has something to reconcile against.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PI_TO_PPA_RATE } from "@/lib/ppa/policy";

export const dynamic = "force-dynamic";

const PI_API = "https://api.minepi.com/v2";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { paymentId } = (await req.json()) as { paymentId?: string };
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    console.error("[payments/approve] PI_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Read the payment from Pi before touching it. This is what makes the
  // ownership check possible at all.
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

  // Record it now, keyed on the unique paymentId. If completion later fails,
  // this row is how you find the orphan.
  await prisma.topUp.upsert({
    where: { piPaymentId: paymentId },
    create: {
      piPaymentId: paymentId,
      userId: session.id,
      amountPi: amountPi.toString(),
      ppaAmount: Math.floor(amountPi * PI_TO_PPA_RATE),
      status: "APPROVED",
    },
    update: {},
  });

  const approve = await fetch(`${PI_API}/payments/${paymentId}/approve`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}` },
  });

  if (!approve.ok) {
    const detail = await approve.text().catch(() => "");
    console.error("[payments/approve] Pi returned", approve.status, detail);
    return NextResponse.json({ error: "Failed to approve payment" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
