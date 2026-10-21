/**
 * Player tiers.
 *
 * ── WHY THIS FILE DID NOT EXIST ───────────────────────────────────────────
 *
 * `tier` was set to NEWCOMER at signup and never touched again. It is read on
 * the home screen, the profile, both leaderboards, the emblem engine and the
 * reward formula — and written nowhere. Every player who has ever used PPA is
 * a Newcomer, permanently, including one with 110 questions answered at 86%.
 *
 * TIER_MULTIPLIERS runs 1.0 to 1.3, so the whole ladder was unreachable and
 * everyone sat on the bottom rung of a reward scale that appeared to have five.
 *
 * ── WHAT A TIER MEANS ─────────────────────────────────────────────────────
 *
 * Sustained, accurate play. Volume alone cannot carry anyone past MEMBER,
 * because an accuracy floor applies from TRUSTED upward — otherwise the top
 * multiplier would go to whoever tapped through the most questions, which is
 * the opposite of what it should reward.
 *
 * Tier is deliberately NOT reputation. Reputation decides which difficulties
 * you can open; tier is a long-run standing that nudges the reward. Two
 * different jobs, two different numbers, so neither has to compromise.
 *
 * ── ACCURACY HERE MEANS CHALLENGE ACCURACY ────────────────────────────────
 *
 * Computed from correctChallenges / totalChallenges, not from the stored
 * `accuracyRate` column — that column is maintained only by prediction
 * settlement and holds prediction accuracy. Mixing the two would promote
 * someone for being a good forecaster and call it quiz skill.
 */

export const TIER_ORDER = ["NEWCOMER", "MEMBER", "TRUSTED", "EXPERT", "ELITE"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface TierRule {
  tier: Tier;
  /** Challenge questions answered. */
  answered: number;
  /** Minimum share of them correct, 0–1. */
  accuracy: number;
  label: string;
}

/** Ordered from highest to lowest; the first rule a player meets is their tier. */
export const TIER_RULES: readonly TierRule[] = [
  { tier: "ELITE", answered: 750, accuracy: 0.8, label: "750 answered at 80%" },
  { tier: "EXPERT", answered: 300, accuracy: 0.7, label: "300 answered at 70%" },
  { tier: "TRUSTED", answered: 100, accuracy: 0.6, label: "100 answered at 60%" },
  { tier: "MEMBER", answered: 25, accuracy: 0, label: "25 answered" },
  { tier: "NEWCOMER", answered: 0, accuracy: 0, label: "Welcome" },
];

export function rankOf(tier: string): number {
  const i = TIER_ORDER.indexOf(tier as Tier);
  return i < 0 ? 0 : i;
}

export function challengeAccuracy(correct: number, answered: number): number {
  return answered > 0 ? correct / answered : 0;
}

/** The tier these numbers earn, ignoring whatever is currently stored. */
export function tierFor(correct: number, answered: number): Tier {
  const accuracy = challengeAccuracy(correct, answered);
  for (const rule of TIER_RULES) {
    if (answered >= rule.answered && accuracy >= rule.accuracy) return rule.tier;
  }
  return "NEWCOMER";
}

/**
 * The tier to store: the better of what they have and what they just earned.
 *
 * Tiers do not fall. A player who reached EXPERT genuinely met the bar at the
 * time, and taking it back over a bad week would cut their earning rate for
 * answering questions — which is the behaviour the tier is supposed to
 * encourage. The accuracy floors still stop anyone climbing on volume alone.
 */
export function nextTier(current: string, correct: number, answered: number): Tier {
  const earned = tierFor(correct, answered);
  return rankOf(earned) > rankOf(current) ? earned : (current as Tier);
}

/** What the player is working toward, or null at the top. */
export function tierProgress(
  current: string,
  correct: number,
  answered: number,
): { next: Tier; answeredToGo: number; accuracyNeeded: number; label: string } | null {
  const rank = rankOf(current);
  if (rank >= TIER_ORDER.length - 1) return null;

  const next = TIER_ORDER[rank + 1];
  const rule = TIER_RULES.find((r) => r.tier === next);
  if (!rule) return null;

  return {
    next,
    answeredToGo: Math.max(0, rule.answered - answered),
    accuracyNeeded: rule.accuracy,
    label: rule.label,
  };
}
