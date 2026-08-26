/**
 * Reward formula for challenges and predictions.
 *
 * ── CONFIDENCE NO LONGER AFFECTS PPA ──────────────────────────────────────
 *
 * This is the change that makes free-entry predictions work as a game.
 *
 * With a stake, "Low 1.2x / Medium 1.8x / High 3.0x" was a real decision: more
 * reward, more of your own PPA at risk. Remove the stake and a wrong call costs
 * nothing — so High becomes strictly better than Low in every situation, the
 * selector stops being a choice, and everyone taps High forever.
 *
 * So confidence now stakes REPUTATION instead of PPA. A confident correct call
 * moves your reputation score up sharply; a confident wrong one moves it down.
 * PPA for a correct call is flat, and only streak, tier and earliness modify it.
 *
 * That keeps the psychology (commit hard, be judged hard), keeps the leaderboard
 * meaningful, and puts nothing of value at risk — which is the whole point.
 */

import { STREAK_MULTIPLIERS, TIER_MULTIPLIERS } from './policy';

export type RewardLine =
  | { kind: 'delta'; label: string; value: number }
  | { kind: 'multiplier'; label: string; factor: number };

export interface RewardBreakdown {
  lines: RewardLine[];
  total: number;
}

export function streakMultiplier(streakDays: number): number {
  for (const [threshold, factor] of STREAK_MULTIPLIERS) {
    if (streakDays >= threshold) return factor;
  }
  return 1.0;
}

export function tierMultiplier(tier: string): number {
  return TIER_MULTIPLIERS[tier] ?? 1.0;
}

// ---------------------------------------------------------------------------
// Confidence -> reputation
// ---------------------------------------------------------------------------

/** UI levels. 1 = Low, 2 = Medium, 3 = High. */
export const CONFIDENCE_LEVELS = [1, 2, 3] as const;
export const CONFIDENCE_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
};

/** How heavily a call at this confidence counts toward reputation. */
export function confidenceWeight(level: number): number {
  if (level >= 3) return 4;
  if (level === 2) return 2;
  return 1;
}

/**
 * Signed reputation change for a settled prediction.
 *
 * A wrong call costs half what a right one earns — enough that a confident miss
 * stings, not so much that one bad week erases a good month.
 */
export function reputationDelta(isCorrect: boolean, confidenceLevel: number): number {
  const weight = confidenceWeight(confidenceLevel);
  return isCorrect ? weight : -weight * 0.5;
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

const BASE_PER_CORRECT = 4;
const MAX_SPEED_BONUS_PER_QUESTION = 3;

/**
 * base     = 4 PPA per correct answer
 * accuracy = (correct/total)^2, so a 3/5 is worth much less than a 5/5
 * speed    = up to 3 PPA per question for answering well inside the timer
 * streak   = 1.0x .. 2.0x on the 3/7/14/30 day ladder
 * tier     = 1.0x .. 1.3x  (all >= 1.0, so no "Tier bonus: -4 PPA")
 */
export function computeChallengeReward(input: {
  correct: number;
  total: number;
  secondsTaken: number;
  secondsAllowed: number;
  streakDays: number;
  tier: string;
}): RewardBreakdown {
  const { correct, total, secondsTaken, secondsAllowed, streakDays, tier } = input;

  if (total <= 0 || correct <= 0) {
    return { lines: [{ kind: 'delta', label: 'Base reward', value: 0 }], total: 0 };
  }

  const accuracy = correct / total;
  const base = Math.round(BASE_PER_CORRECT * correct * accuracy * accuracy);

  const timeRatio = Math.max(0, 1 - secondsTaken / Math.max(1, secondsAllowed));
  const speed = Math.round(MAX_SPEED_BONUS_PER_QUESTION * correct * timeRatio);

  const streakFactor = streakMultiplier(streakDays);
  const tierFactor = tierMultiplier(tier);

  const lines: RewardLine[] = [
    { kind: 'delta', label: `Correct answers (${correct}/${total})`, value: base },
  ];
  if (speed > 0) lines.push({ kind: 'delta', label: 'Speed bonus', value: speed });
  if (streakFactor !== 1) {
    lines.push({ kind: 'multiplier', label: `Daily streak (${streakDays} days)`, factor: streakFactor });
  }
  lines.push({ kind: 'multiplier', label: `Tier (${tier})`, factor: tierFactor });

  return {
    lines,
    total: Math.max(0, Math.round((base + speed) * streakFactor * tierFactor)),
  };
}

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

const PREDICTION_BASE = 10;
const EARLY_BONUS = 5;

/**
 * Prediction reward. Free to enter, nothing debited on a wrong call.
 *
 * `confidenceLevel` is accepted but deliberately NOT used here — see the note
 * at the top of this file. It drives reputationDelta() instead.
 */
export function computePredictionReward(input: {
  isCorrect: boolean;
  confidenceLevel?: number;
  hoursBeforeClose: number;
  streakDays: number;
  tier: string;
}): RewardBreakdown {
  if (!input.isCorrect) {
    return { lines: [{ kind: 'delta', label: 'Incorrect call', value: 0 }], total: 0 };
  }

  const early = input.hoursBeforeClose >= 24 ? EARLY_BONUS : 0;
  const streakFactor = streakMultiplier(input.streakDays);
  const tierFactor = tierMultiplier(input.tier);

  const lines: RewardLine[] = [
    { kind: 'delta', label: 'Correct call', value: PREDICTION_BASE },
  ];
  if (early > 0) lines.push({ kind: 'delta', label: 'Called early', value: early });
  if (streakFactor !== 1) {
    lines.push({ kind: 'multiplier', label: `Daily streak (${input.streakDays} days)`, factor: streakFactor });
  }
  lines.push({ kind: 'multiplier', label: `Tier (${input.tier})`, factor: tierFactor });

  return {
    lines,
    total: Math.max(0, Math.round((PREDICTION_BASE + early) * streakFactor * tierFactor)),
  };
}
