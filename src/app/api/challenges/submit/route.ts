/**
 * Challenge submission — scored on the SERVER.
 *
 * The client sends questionIds, the answers chosen, and elapsed time. It does
 * not send a score, and it never sees correctAnswer before submitting. This is
 * the fix for client-side scoring: with the old flow, anyone who opened devtools
 * could post a perfect result and mint the maximum reward.
 *
 * ── THE SET HAS TO BE ONE THE APP SERVED ──────────────────────────────────
 *
 * Grading honestly is not enough on its own. Without this check a player could
 * keep five question ids whose answers they already knew and submit them again
 * every day for a fresh payout — the idempotency key includes the date, so each
 * day is a new key. So the submitted ids must match either today's
 * DailyChallenge set for a tier they have unlocked, or the question set of the
 * creator challenge they name. Both are recomputed here from the same functions
 * that served them, so the two cannot drift apart.
 *
 * A creator challenge can still be replayed once a day, which is what the
 * "Try Again" button has always offered. The per-source daily cap in policy.ts
 * is the control for that, and it is the one designed for the job.
 *
 * ── ONE ANSWER PER QUESTION PER DAY ───────────────────────────────────────
 *
 * ChallengeResult is unique on (userId, questionId, day). Per day rather than
 * outright, because the pool recycles and a question can legitimately return
 * weeks later. The insert is the race guard: two taps of Submit land one row.
 *
 * Reward is paid through award(), so daily caps and the ledger apply
 * automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { award } from '@/lib/ppa/award';
import {
  computeChallengeReward,
  challengeReputationDelta,
} from '@/lib/ppa/rewards';
import { contentQuestionSet, utcDayStart } from '@/lib/ppa/rotation';
import { nextTier } from '@/lib/ppa/tiers';
import {
  unlockedDifficulties,
  utcDateKey,
  SECONDS_PER_QUESTION,
} from '@/lib/ppa/daily-challenge';

export const dynamic = 'force-dynamic';

interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((id) => bs.has(id));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json()) as {
    answers?: SubmittedAnswer[];
    secondsTaken?: number;
    contentId?: string | null;
  };

  const answers = body.answers ?? [];
  if (answers.length === 0 || answers.length > 20) {
    return NextResponse.json({ error: 'invalid_submission' }, { status: 400 });
  }

  const submittedIds = answers.map((a) => a.questionId);
  if (new Set(submittedIds).size !== submittedIds.length) {
    return NextResponse.json({ error: 'duplicate_question' }, { status: 400 });
  }

  const secondsAllowed = answers.length * SECONDS_PER_QUESTION;
  // Clamp rather than trust: a client claiming 0 seconds shouldn't max the bonus.
  const secondsTaken = Math.min(
    secondsAllowed,
    Math.max(1, Math.round(body.secondsTaken ?? secondsAllowed)),
  );

  const questions = await prisma.question.findMany({
    where: { id: { in: submittedIds } },
    select: {
      id: true,
      correctAnswer: true,
      difficulty: true,
      qualityScore: true,
    },
  });

  if (questions.length !== answers.length) {
    return NextResponse.json({ error: 'unknown_question' }, { status: 400 });
  }

  // A benched question is one a person decided should not reach a player —
  // a duplicate, a broken one, or one still awaiting review. It must not be
  // scorable through a hand-built request either.
  if (questions.some((q) => q.qualityScore < 0)) {
    return NextResponse.json({ error: 'question_not_in_rotation' }, { status: 400 });
  }

  const now = new Date();
  const day = utcDayStart(now);

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      streakDays: true,
      tier: true,
      reputationScore: true,
      totalChallenges: true,
      correctChallenges: true,
    },
  });

  /* ---- the set must be one the app actually served ---- */

  const contentId = body.contentId || null;
  let served = false;

  if (contentId) {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { category: true, status: true, questions: { select: { id: true } } },
    });

    if (!content) {
      return NextResponse.json({ error: 'unknown_challenge' }, { status: 404 });
    }
    if (content.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'challenge_closed' }, { status: 409 });
    }

    const own = content.questions.map((q) => q.id);
    const expected =
      own.length > 0
        ? own
        : await contentQuestionSet(contentId, content.category, now);

    // Its own questions may number more than one sitting, so a subset is fine
    // there; a bank-drawn set is exactly five and must match.
    served =
      own.length > 0
        ? submittedIds.every((id) => expected.includes(id))
        : sameSet(submittedIds, expected);
  } else {
    const todays = await prisma.dailyChallenge.findMany({ where: { day } });
    const unlocked = new Set(unlockedDifficulties(profile.reputationScore));
    served = todays.some(
      (c) =>
        unlocked.has(c.difficulty as never) &&
        sameSet(submittedIds, c.questionIds as string[]),
    );
  }

  if (!served) {
    return NextResponse.json({ error: 'set_not_served' }, { status: 400 });
  }

  /* ---- grade ---- */

  const byId = new Map(questions.map((q) => [q.id, q]));
  const graded = answers.map((a) => {
    const q = byId.get(a.questionId)!;
    return {
      questionId: a.questionId,
      answer: a.answer,
      isCorrect: q.correctAnswer === a.answer,
      difficulty: String(q.difficulty),
    };
  });
  const correct = graded.filter((g) => g.isCorrect).length;

  const breakdown = computeChallengeReward({
    correct,
    total: graded.length,
    secondsTaken,
    secondsAllowed,
    streakDays: profile.streakDays,
    tier: profile.tier,
  });

  const reputationGain = challengeReputationDelta(graded);
  const perQuestionPpa =
    breakdown.total > 0 ? Math.floor(breakdown.total / graded.length) : 0;

  /* ---- record the attempt; the unique index is the race guard ---- */

  try {
    await prisma.$transaction([
      prisma.challengeResult.createMany({
        data: graded.map((g) => ({
          userId: user.id,
          questionId: g.questionId,
          day,
          isCorrect: g.isCorrect,
          timeSeconds: Math.round(secondsTaken / graded.length),
          ppaEarned: g.isCorrect ? perQuestionPpa : 0,
        })),
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          totalChallenges: { increment: graded.length },
          correctChallenges: { increment: correct },
          reputationScore: { increment: reputationGain },
          lastActiveDate: now,
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
  } catch (err) {
    // P2002 on (userId, questionId, day): already answered today. The whole
    // transaction rolled back, so no reward is owed and no counter moved.
    // Duck-typed to match the idiom in src/lib/ledger.ts rather than importing
    // the error class.
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { error: 'already_submitted_today' },
        { status: 409 },
      );
    }
    throw err;
  }

  /* ---- promote ---- */

  // Recomputed from the totals AFTER this submission, which is why it happens
  // here rather than inside the transaction above. Tier was previously set at
  // signup and never again, so every player sat on the bottom rung of a
  // five-step reward multiplier.
  const answeredTotal = profile.totalChallenges + graded.length;
  const correctTotal = profile.correctChallenges + correct;
  const promotedTo = nextTier(profile.tier, correctTotal, answeredTotal);
  const promoted = promotedTo !== profile.tier;

  if (promoted) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: promotedTo as never },
    });
  }

  /* ---- pay ---- */

  // Deterministic key: same user, same question set, same day => one payout.
  const setHash = createHash('sha256')
    .update([user.id, utcDateKey(now), ...submittedIds.slice().sort()].join('|'))
    .digest('hex')
    .slice(0, 32);

  const result =
    breakdown.total > 0
      ? await award({
          piUserId: user.piUserId,
          amount: breakdown.total,
          source: 'CHALLENGE',
          idempotencyKey: `challenge:${setHash}`,
          allowPartial: true,
        })
      : { ok: true, applied: 0, balance: 0, replay: false as const, reason: undefined };

  const balance =
    result.balance ||
    (
      await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { ppaBalance: true },
      })
    ).ppaBalance;

  return NextResponse.json({
    correct,
    total: graded.length,
    secondsTaken,
    breakdown: breakdown.lines,
    earned: result.applied,
    balance,
    reputationGain,
    reputation: Number((profile.reputationScore + reputationGain).toFixed(1)),
    tier: promotedTo,
    promoted,
    // Surfaced so the results card can explain a short payout instead of
    // silently showing a number that doesn't match the breakdown.
    capped: result.applied < breakdown.total,
    cappedReason: result.reason ?? null,
    // Which answers were right, revealed only now that scoring is done.
    graded: graded.map((g) => ({
      questionId: g.questionId,
      isCorrect: g.isCorrect,
      correctAnswer: byId.get(g.questionId)!.correctAnswer,
    })),
  });
}
