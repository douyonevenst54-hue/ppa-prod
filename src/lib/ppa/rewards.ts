/**
 * Reward formula for challenges and predictions.
 *
 * Two changes from the version in the recording:
 *
 *  1. Tier multipliers are all >= 1.0, so the results card can never show
 *     "Tier bonus: -4 PPA" to a new player on their first win.
 *  2. The breakdown returns typed lines — DELTA lines add PPA, MULTIPLIER lines
 *     scale the running subtotal. The old card rendered a multiplier's effect as
 *     a signed delta, which is where the `+-4` came from. Render them differently.
 *
 * Scoring inputs come from the SERVER (Question.correctAnswer), never the client.
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

const BASE_PER_CORRECT = 4;
const MAX_SPEED_BONUS_PER_QUESTION = 3;

/**
 * Challenge reward.
 *
 * base       = 4 PPA per correct answer
 * accuracy   = (correct/total)^2, so a 3/5 is worth much less than a 5/5
 * speed      = up to 3 PPA per question for answering well inside the timer
 * streak     = 1.0x .. 2.0x on the 3/7/14/30 day ladder
 * tier       = 1.0x .. 1.3x
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

  const subtotal = base + speed;
  const total_ = Math.max(0, Math.round(subtotal * streakFactor * tierFactor));

  const lines: RewardLine[] = [
    { kind: 'delta', label: `Correct answers (${correct}/${total})`, value: base },
  ];
  if (speed > 0) {
    lines.push({ kind: 'delta', label: 'Speed bonus', value: speed });
  }
  if (streakFactor !== 1) {
    lines.push({
      kind: 'multiplier',
      label: `Daily streak (${streakDays} days)`,
      factor: streakFactor,
    });
  }
  lines.push({ kind: 'multiplier', label: `Tier (${tier})`, factor: tierFactor });

  return { lines, total: total_ };
}

/**
 * Prediction reward.
 *
 * No stake, so nothing is at risk and nothing is debited on a wrong call. A
 * correct call pays a flat amount scaled by how early it was made — rewarding
 * conviction before the outcome is obvious, which is the actual skill.
 */
export function computePredictionReward(input: {
  isCorrect: boolean;
  confidenceLevel: number; // 1..5 as stored on Prediction
  hoursBeforeClose: number;
  streakDays: number;
  tier: string;
}): RewardBreakdown {
  if (!input.isCorrect) {
    return {
      lines: [{ kind: 'delta', label: 'Incorrect call', value: 0 }],
      total: 0,
    };
  }

  const base = 10;
  const conviction = Math.round(base * 0.2 * Math.max(0, Math.min(5, input.confidenceLevel) - 1));
  const earliness = input.hoursBeforeClose >= 24 ? 5 : 0;

  const streakFactor = streakMultiplier(input.streakDays);
  const tierFactor = tierMultiplier(input.tier);
  const subtotal = base + conviction + earliness;

  const lines: RewardLine[] = [
    { kind: 'delta', label: 'Correct call', value: base },
  ];
  if (conviction > 0) {
    lines.push({ kind: 'delta', label: 'Confidence', value: conviction });
  }
  if (earliness > 0) {
    lines.push({ kind: 'delta', label: 'Called early', value: earliness });
  }
  if (streakFactor !== 1) {
    lines.push({
      kind: 'multiplier',
      label: `Daily streak (${input.streakDays} days)`,
      factor: streakFactor,
    });
  }
  lines.push({ kind: 'multiplier', label: `Tier (${input.tier})`, factor: tierFactor });

  return { lines, total: Math.max(0, Math.round(subtotal * streakFactor * tierFactor)) };
}
