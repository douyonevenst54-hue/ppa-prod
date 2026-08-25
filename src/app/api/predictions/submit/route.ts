/**
 * Prediction submission — no stake, no debit.
 *
 * PREDICTION_STAKES_ENABLED is false, so stakeAmount is written as 0 on every
 * new row and nothing is deducted from the user's balance. A user who cannot
 * lose PPA on a wrong call has not risked anything of value, which is the whole
 * point of the redesign.
 *
 * The `@@unique([userId, contentId])` constraint on Prediction is doing real
 * work here: it makes one call per user per market a database guarantee.
 *
 * ADAPT: getSessionUser import path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { PREDICTION_STAKES_ENABLED } from '@/lib/ppa/policy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json()) as {
    contentId?: string;
    answer?: string;
    confidenceLevel?: number;
    stakeAmount?: number;
  };

  if (!body.contentId || !body.answer) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Reject rather than silently zero it: if a client is still sending a stake,
  // that client is out of date and should be told so loudly.
  if (!PREDICTION_STAKES_ENABLED && body.stakeAmount) {
    return NextResponse.json(
      {
        error: 'stakes_disabled',
        message: 'Predictions are free to enter. Update the app to continue.',
      },
      { status: 410 },
    );
  }

  const content = await prisma.content.findUnique({
    where: { id: body.contentId },
    select: { id: true, status: true, endsAt: true },
  });

  if (!content || content.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'market_unavailable' }, { status: 404 });
  }
  if (content.endsAt <= new Date()) {
    return NextResponse.json({ error: 'market_closed' }, { status: 409 });
  }

  const confidenceLevel = Math.max(1, Math.min(5, Math.round(body.confidenceLevel ?? 3)));

  try {
    const prediction = await prisma.$transaction(async (tx) => {
      const created = await tx.prediction.create({
        data: {
          userId: user.id,
          contentId: content.id,
          answer: body.answer!,
          confidenceLevel,
          stakeAmount: 0,
          potentialReward: 0, // computed at resolution, not promised up front
        },
      });

      await tx.content.update({
        where: { id: content.id },
        data: { participantCount: { increment: 1 } },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { totalPredictions: { increment: 1 }, lastActiveDate: new Date() },
      });

      return created;
    });

    return NextResponse.json({ ok: true, predictionId: prediction.id });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'already_predicted', message: 'You already made a call on this one.' },
        { status: 409 },
      );
    }
    throw err;
  }
}
