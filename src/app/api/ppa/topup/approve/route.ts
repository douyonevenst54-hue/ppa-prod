/**
 * Pi payment: server-side approval for a PPA top-up.
 *
 * The amount is verified against Pi's own record rather than trusted from the
 * client, and a TopUp row is created up front keyed on piPaymentId (unique), so
 * a replayed approve cannot produce two credits at completion time.
 *
 * ADAPT: getSessionUser. PI_API_KEY must be set in Vercel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { PI_TO_PPA_RATE, TOPUP_TIERS_PI } from '@/lib/ppa/policy';

export const dynamic = 'force-dynamic';

const PI_API = 'https://api.minepi.com/v2';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { paymentId } = (await req.json()) as { paymentId?: string };
  if (!paymentId) {
    return NextResponse.json({ error: 'missing_payment_id' }, { status: 400 });
  }

  const lookup = await fetch(`${PI_API}/payments/${paymentId}`, {
    headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
  });
  if (!lookup.ok) {
    return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
  }
  const payment = await lookup.json();

  const amountPi = Number(payment.amount);
  if (!TOPUP_TIERS_PI.includes(amountPi as (typeof TOPUP_TIERS_PI)[number])) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  // The payment must belong to the session user. User.piUserId is the Pi uid.
  if (payment.user_uid !== user.piUserId) {
    return NextResponse.json({ error: 'payment_user_mismatch' }, { status: 403 });
  }

  await prisma.topUp.upsert({
    where: { piPaymentId: paymentId },
    create: {
      piPaymentId: paymentId,
      userId: user.id,
      amountPi: amountPi.toString(),
      ppaAmount: Math.round(amountPi * PI_TO_PPA_RATE),
      status: 'APPROVED',
    },
    update: {},
  });

  const approve = await fetch(`${PI_API}/payments/${paymentId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
  });
  if (!approve.ok) {
    return NextResponse.json({ error: 'approve_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
