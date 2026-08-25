/**
 * Challenge submission — scored on the SERVER.
 *
 * The client sends questionIds, the answers chosen, and elapsed time. It does
 * not send a score, and it never sees correctAnswer before submitting. This is
 * the fix for client-side scoring: with the old flow, anyone who opened devtools
 * could post a perfect result and mint the maximum reward.
 *
 * Reward is paid through award(), so daily caps and the ledger apply
 * automatically. The idempotency key is derived from the user and the question
 * set, so a double-tapped Submit pays once.
 *
 * ADAPT: getSessionUser import path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { award } from '@/lib/ppa/award';
import { computeChallengeReward } from '@/lib/ppa/rewards';

export const dynamic = 'force-dynamic';

const SECONDS_PER_QUESTION = 15;

interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json()) as {
    answers?: SubmittedAnswer[];
    secondsTaken?: number;
  };

  const answers = body.answers ?? [];
  if (answers.length === 0 || answers.length > 20) {
    return NextResponse.json({ error: 'invalid_submission' }, { status: 400 });
  }

  const secondsAllowed = answers.length * SECONDS_PER_QUESTION;
  // Clamp rather than trust: a client claiming 0 seconds shouldn't max the bonus.
  const secondsTaken = Math.min(
    secondsAllowed,
    Math.max(1, Math.round(body.secondsTaken ?? secondsAllowed)),
  );

  const questions = await prisma.question.findMany({
    where: { id: { in: answers.map((a) => a.questionId) } },
    select: { id: true, correctAnswer: true },
  });

  if (questions.length !== answers.length) {
    return NextResponse.json({ error: 'unknown_question' }, { status: 400 });
  }

  const correctById = new Map(questions.map((q) => [q.id, q.correctAnswer]));

  const graded = answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer,
    isCorrect: correctById.get(a.questionId) === a.answer,
  }));
  const correct = graded.filter((g) => g.isCorrect).length;

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { streakDays: true, tier: true },
  });

  const breakdown = computeChallengeReward({
    correct,
    total: graded.length,
    secondsTaken,
    secondsAllowed,
    streakDays: profile.streakDays,
    tier: profile.tier,
  });

  // Deterministic key: same user, same question set, same day => one payout.
  const setHash = createHash('sha256')
    .update(
      [user.id, new Date().toISOString().slice(0, 10), ...graded.map((g) => g.questionId).sort()].join('|'),
    )
    .digest('hex')
    .slice(0, 32);
  const idempotencyKey = `challenge:${setHash}`;

  // Persist the attempt regardless of whether the award clears the cap — the
  // player's record is the player's record, capped or not.
  const perQuestionPpa = breakdown.total > 0 ? Math.floor(breakdown.total / graded.length) : 0;
  await prisma.$transaction([
    prisma.challengeResult.createMany({
      data: graded.map((g) => ({
        userId: user.id,
        questionId: g.questionId,
        isCorrect: g.isCorrect,
        timeSeconds: Math.round(secondsTaken / graded.length),
        ppaEarned: g.isCorrect ? perQuestionPpa : 0,
      })),
      skipDuplicates: true,
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        totalChallenges: { increment: graded.length },
        correctChallenges: { increment: correct },
        lastActiveDate: new Date(),
      },
    }),
    ...graded.map((g) =>
      prisma.question.update({
        where: { id: g.questionId },
        data: {
          timesServed: { increment: 1 },
          timesCorrect: { increment: g.isCorrect ? 1 : 0 },
        },
      }),
    ),
  ]);

  const result =
    breakdown.total > 0
      ? await award({
          piUserId: user.piUserId,
          amount: breakdown.total,
          source: 'CHALLENGE',
          idempotencyKey,
          allowPartial: true,
        })
      : { ok: true, applied: 0, balance: 0, replay: false as const };

  const balance =
    result.balance ||
    (await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { ppaBalance: true },
    })).ppaBalance;

  return NextResponse.json({
    correct,
    total: graded.length,
    secondsTaken,
    breakdown: breakdown.lines,
    earned: result.applied,
    balance,
    // Surfaced so the results card can explain a short payout instead of
    // silently showing a number that doesn't match the breakdown.
    capped: result.applied < breakdown.total,
    cappedReason: result.reason ?? null,
    // Which answers were right, revealed only now that scoring is done.
    graded: graded.map((g) => ({ questionId: g.questionId, isCorrect: g.isCorrect })),
  });
}
