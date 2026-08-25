/**
 * Public leaderboard.
 *
 * Changes from the version in the recording:
 *  - House accounts (PPA_Official) excluded.
 *  - Accuracy board requires MIN_RESOLVED_FOR_RANKING resolved predictions, so
 *    one lucky 100% call can't outrank a long 82% record.
 *  - Ordering uses the Wilson lower bound; the displayed % stays the raw number.
 *  - Users who opted out of public ranking are excluded.
 *  - The eligibility rule is returned to the client, so a short board reads as a
 *    rule rather than a bug.
 *
 * Field names match the live schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rankPredictors, predictionAccuracy } from '@/lib/ppa/ranking';
import { HOUSE_ACCOUNTS, MIN_RESOLVED_FOR_RANKING } from '@/lib/ppa/policy';

export const revalidate = 60; // snapshot for a minute; this is not live data

type Board = 'predictors' | 'players' | 'creators';

export async function GET(req: NextRequest) {
  const board = (req.nextUrl.searchParams.get('board') ?? 'predictors') as Board;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      leaderboardOptOut: false,
      username: { notIn: [...HOUSE_ACCOUNTS] },
    },
    select: {
      username: true,
      tier: true,
      streakDays: true,
      reputationScore: true,
      totalPredictions: true,
      correctPredictions: true,
      totalChallenges: true,
      correctChallenges: true,
      _count: { select: { createdContent: true } },
    },
    take: 500,
  });

  if (board === 'predictors') {
    const entries = rankPredictors(users)
      .slice(0, 50)
      .map((u, i) => ({
        rank: i + 1,
        username: u.username,
        tier: u.tier,
        streak: u.streakDays,
        accuracy: predictionAccuracy(u),
        resolved: u.totalPredictions,
      }));

    return NextResponse.json({
      board,
      entries,
      eligibilityNote: `Ranked after ${MIN_RESOLVED_FOR_RANKING} resolved predictions.`,
    });
  }

  if (board === 'players') {
    const entries = [...users]
      .sort((a, b) => b.reputationScore - a.reputationScore)
      .slice(0, 50)
      .map((u, i) => ({
        rank: i + 1,
        username: u.username,
        tier: u.tier,
        streak: u.streakDays,
        reputation: Number(u.reputationScore.toFixed(1)),
      }));

    return NextResponse.json({
      board,
      entries,
      eligibilityNote:
        'Reputation combines challenge accuracy, how consistently you play, and how much others engage with what you publish.',
    });
  }

  const entries = [...users]
    .sort((a, b) => b._count.createdContent - a._count.createdContent)
    .slice(0, 50)
    .map((u, i) => ({
      rank: i + 1,
      username: u.username,
      tier: u.tier,
      published: u._count.createdContent,
    }));

  return NextResponse.json({
    board: 'creators',
    entries,
    eligibilityNote: 'Ranked by polls, predictions, and challenges published.',
  });
}
