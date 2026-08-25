/**
 * Self-service data export.
 *
 * Returns everything tied to the account as one JSON download. This is the
 * concrete thing the privacy policy points at — a policy promising access with
 * no endpoint behind it is worse than no promise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      piUserId: true,
      username: true,
      createdAt: true,
      ppaBalance: true,
      tier: true,
      accuracyRate: true,
      reputationScore: true,
      streakDays: true,
      longestStreak: true,
      totalPredictions: true,
      correctPredictions: true,
      totalChallenges: true,
      correctChallenges: true,
      ageAttestedAt: true,
      leaderboardOptOut: true,
      transactions: {
        select: {
          amount: true,
          type: true,
          source: true,
          balanceAfter: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      predictions: {
        select: {
          answer: true,
          confidenceLevel: true,
          isCorrect: true,
          ppaEarned: true,
          createdAt: true,
          content: { select: { title: true, category: true } },
        },
      },
      pollVotes: {
        select: {
          createdAt: true,
          pollOption: { select: { text: true } },
        },
      },
      results: {
        select: {
          isCorrect: true,
          timeSeconds: true,
          ppaEarned: true,
          createdAt: true,
          question: { select: { text: true, category: true } },
        },
      },
      createdContent: {
        select: { title: true, type: true, category: true, createdAt: true },
      },
    },
  });

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), account },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="ppa-data-${account.username}.json"`,
    },
  });
}
