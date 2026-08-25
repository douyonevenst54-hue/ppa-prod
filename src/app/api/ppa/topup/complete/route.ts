/**
 * Pi payment: server-side completion for a PPA top-up.
 *
 * Credits through creditTopUp(), which is idempotent on `topup:{paymentId}` —
 * a double-fired onReadyForServerCompletion pays once. Purchased PPA is backed
 * by a Pi payment, so it bypasses the daily emission caps (it isn't emission),
 * but it still gets a chained ledger row like everything else.
 *
 * ADAPT: getSessionUser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { creditTopUp } from '@/lib/ppa/award';

export const dynamic = 'force-dynamic';

const PI_API = 'https://api.minepi.com/v2';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { paymentId, txid } = (await req.json()) as {
    paymentId?: string;
    txid?: string;
  };
  if (!paymentId || !txid) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const topUp = await prisma.topUp.findUnique({
    where: { piPaymentId: paymentId },
    select: { userId: true, ppaAmount: true, status: true },
  });
  if (!topUp) {
    return NextResponse.json({ error: 'topup_not_found' }, { status: 404 });
  }
  if (topUp.userId !== user.id) {
    return NextResponse.json({ error: 'topup_user_mismatch' }, { status: 403 });
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
    await prisma.topUp.update({
      where: { piPaymentId: paymentId },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ error: 'complete_failed' }, { status: 502 });
  }

  await prisma.topUp.update({
    where: { piPaymentId: paymentId },
    data: { piTxid: txid },
  });

  const result = await creditTopUp({
    piUserId: user.piUserId,
    amount: topUp.ppaAmount,
    piPaymentId: paymentId,
  });

  return NextResponse.json({
    ok: true,
    credited: result.replay ? 0 : result.applied,
    balance: result.balance,
    replay: result.replay,
  });
}
