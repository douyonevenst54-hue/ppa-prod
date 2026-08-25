/**
 * Leaderboard ranking.
 *
 * Raw accuracy is not a ranking: 1 correct call out of 1 shows 100% and
 * outranks 82% over 50 calls. The Wilson lower bound asks "what accuracy can we
 * be 95% confident this user is at least at?", which penalises small samples.
 *
 * Field names match the live schema: User.username, totalPredictions,
 * correctPredictions, totalChallenges, correctChallenges.
 */

import {
  HOUSE_ACCOUNTS,
  MIN_CHALLENGES_FOR_RANKING,
  MIN_RESOLVED_FOR_RANKING,
} from './policy';

export function wilsonLowerBound(successes: number, trials: number, z = 1.96): number {
  if (trials <= 0) return 0;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.max(0, (centre - margin) / denominator);
}

export interface RankableUser {
  username: string;
  totalPredictions: number;
  correctPredictions: number;
  totalChallenges: number;
  correctChallenges: number;
  leaderboardOptOut?: boolean;
  deletedAt?: Date | null;
}

function baseEligible(u: RankableUser): boolean {
  if (HOUSE_ACCOUNTS.has(u.username)) return false;
  if (u.leaderboardOptOut) return false;
  if (u.deletedAt) return false;
  return true;
}

export function isPredictorEligible(u: RankableUser): boolean {
  return baseEligible(u) && u.totalPredictions >= MIN_RESOLVED_FOR_RANKING;
}

export function isChallengerEligible(u: RankableUser): boolean {
  return baseEligible(u) && u.totalChallenges >= MIN_CHALLENGES_FOR_RANKING;
}

export function rankPredictors<T extends RankableUser>(users: T[]): T[] {
  return users
    .filter(isPredictorEligible)
    .map((u) => ({ u, score: wilsonLowerBound(u.correctPredictions, u.totalPredictions) }))
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.u.totalPredictions - a.u.totalPredictions,
    )
    .map((e) => e.u);
}

/** Displayed accuracy stays the honest raw number; only the ORDER uses Wilson. */
export function predictionAccuracy(u: RankableUser): number {
  if (u.totalPredictions === 0) return 0;
  return Math.round((u.correctPredictions / u.totalPredictions) * 100);
}

export function challengeAccuracy(u: RankableUser): number {
  if (u.totalChallenges === 0) return 0;
  return Math.round((u.correctChallenges / u.totalChallenges) * 100);
}
