/**
 * /api/payments/exchange — REPLACEMENT
 *
 * Same URL, same response shape for `direction: "buy"`, so the existing wallet
 * client keeps working. Two things changed:
 *
 *   1. `direction: "redeem"` is gone. Returns a logged 410. PPA is a one-way,
 *      non-redeemable in-app credit (see src/lib/ppa/policy.ts).
 *
 *   2. The buy path is authenticated and the amount is verified against Pi.
 *      Read the note below before assuming that was already true.
 *
 * ─── WHY THE BUY PATH CHANGED ──────────────────────────────────────────────
 *
 * The previous handler took BOTH `userId` and `amount` from the request body,
 * with no session check, and credited `amount * 1000` PPA. The call to Pi's
 * /complete confirmed that *a* payment settled — it did not confirm how much
 * that payment was for, or that it belonged to the caller.
 *
 * So: anyone who made one real 0.5π payment could replay its paymentId and txid
 * with `amount: 1000000` in the body and mint a billion PPA, into any account
 * they named. No login required. That is not a hypothetical — it's four lines
 * of curl against a public endpoint.
 *
 * The fix, in order:
 *   - resolve the user from the session, never from the body
 *   - GET the payment from Pi and read the amount from Pi's record
 *   - confirm the payment's user_uid matches the session user
 *   - confirm it isn't already credited, then approve, complete, and credit
 *     through the ledger gate
 *
 * ─── CLIENT CHANGE REQUIRED ────────────────────────────────────────────────
 *
 * The buy request must now carry the Pi access token:
 *     headers: { Authorization: `Bearer ${accessToken}` }
 * and `userId` in the body is ignored. `amount` in the body is ignored too —
 * it's read from Pi. Both are accepted without error so old clients don't hard
 * fail, they just no longer control anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { creditTopUp } from '@/lib/ppa/award';
import { PI_TO_PPA_RATE, TOPUP_TIERS_PI, SUPPORT_EMAIL } from '@/lib/ppa/policy';

export const dynamic = 'force-dynamic';

const PI_API = 'https://api.minepi.com/v2';

// ──────────────────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.direction === 'redeem') {
    return handleRedeemGone(req, body);
  }

  if (body.direction === 'buy') {
    return handleBuy(req, body);
  }

  return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
}

// ──────────────────────────────────────────────────────────────────────────
// REDEEM: permanently disabled
// ──────────────────────────────────────────────────────────────────────────

/**
 * Every redeem call is recorded before the 410 goes out.
 *
 * Not for punishment — for evidence. If anyone later asks whether PPA was
 * convertible to Pi after the cutover date, RedemptionAttempt is the table that
 * answers, with timestamps.
 */
async function handleRedeemGone(req: NextRequest, body: Record<string, unknown>) {
  try {
    const user = await getSessionUser(req).catch(() => null);
    await prisma.redemptionAttempt.create({
      data: {
        userId: user?.id ?? (typeof body.userId === 'string' ? body.userId : null),
        userAgent: req.headers.get('user-agent') ?? null,
      },
    });
  } catch {
    // Audit logging must never break the response. The 410 is the contract.
  }

  return NextResponse.json(
    {
      error: 'redemption_disabled',
      message:
        'PPA can no longer be exchanged back into Pi. PPA is a non-refundable in-app credit with no cash value.',
      support: SUPPORT_EMAIL,
    },
    { status: 410 },
  );
}

// ──────────────────────────────────────────────────────────────────────────
// BUY: Pi -> PPA
// ──────────────────────────────────────────────────────────────────────────

async function handleBuy(req: NextRequest, body: Record<string, unknown>) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const paymentId = typeof body.paymentId === 'string' ? body.paymentId : null;
  const txid = typeof body.txid === 'string' ? body.txid : null;
  if (!paymentId || !txid) {
    return NextResponse.json({ error: 'Invalid buy payload' }, { status: 400 });
  }

  // Idempotency first, before anything with a side effect. A retried request
  // must return the original outcome, not a second credit.
  const existing = await prisma.pPATransaction.findUnique({
    where: { idempotencyKey: `topup:${paymentId}` },
    select: { amount: true, balanceAfter: true },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      direction: 'buy',
      ppaReceived: existing.amount,
      newBalance: existing.balanceAfter,
      idempotent: true,
    });
  }

  // ── The amount comes from Pi, not from the caller ────────────────────────
  const lookup = await fetch(`${PI_API}/payments/${paymentId}`, {
    headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
    cache: 'no-store',
  });
  if (!lookup.ok) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }
  const payment = (await lookup.json()) as {
    amount?: number | string;
    user_uid?: string;
    status?: { developer_approved?: boolean; transaction_verified?: boolean };
  };

  const amountPi = Number(payment.amount);
  if (!Number.isFinite(amountPi) || amountPi <= 0) {
    return NextResponse.json({ error: 'Payment has no amount' }, { status: 400 });
  }

  // The payment must belong to the signed-in user. Without this check, a
  // replayed paymentId credits whoever presents it.
  if (payment.user_uid !== user.piUserId) {
    return NextResponse.json({ error: 'Payment belongs to another account' }, { status: 403 });
  }

  // Only the denominations the UI offers. Anything else is a client that has
  // been edited, and there's no reason to serve it.
  if (!TOPUP_TIERS_PI.includes(amountPi as (typeof TOPUP_TIERS_PI)[number])) {
    return NextResponse.json({ error: 'Unsupported amount' }, { status: 400 });
  }

  const ppaAmount = Math.floor(amountPi * PI_TO_PPA_RATE);

  // Record the intent before touching Pi, keyed on the unique paymentId. If
  // anything below fails, this row is how you find the orphan.
  await prisma.topUp.upsert({
    where: { piPaymentId: paymentId },
    create: {
      piPaymentId: paymentId,
      userId: user.id,
      amountPi: amountPi.toString(),
      ppaAmount,
      status: 'APPROVED',
    },
    update: {},
  });

  // Approve is idempotent on Pi's side; calling it on an already-approved
  // payment is harmless and covers the case where the client skipped it.
  if (!payment.status?.developer_approved) {
    await fetch(`${PI_API}/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
    }).catch(() => null);
  }

  const complete = await fetch(`${PI_API}/payments/${paymentId}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.PI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ txid }),
  });
  if (!complete.ok) {
    const detail = await complete.text().catch(() => '');
    console.error('Pi /complete failed for buy:', complete.status, detail);
    await prisma.topUp.update({
      where: { piPaymentId: paymentId },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ error: 'Pi payment completion failed' }, { status: 400 });
  }

  await prisma.topUp.update({
    where: { piPaymentId: paymentId },
    data: { piTxid: txid },
  });

  // Credit through the gate: row lock, chained ledger row, idempotent on
  // `topup:{paymentId}`. Purchased PPA is backed by a Pi payment, so it isn't
  // emission and doesn't consume the daily earn budget.
  const result = await creditTopUp({
    piUserId: user.piUserId,
    amount: ppaAmount,
    piPaymentId: paymentId,
  });

  return NextResponse.json({
    success: true,
    direction: 'buy',
    piSpent: amountPi,
    ppaReceived: result.replay ? 0 : result.applied,
    newBalance: result.balance,
  });
}
