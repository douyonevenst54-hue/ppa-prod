/**
 * PPA TOKEN POLICY — single source of truth.
 *
 * Legal posture, emission limits, and ranking rules live here so that every
 * surface reads the same numbers. If a reviewer asks "is PPA redeemable?" or
 * "what stops someone farming a million PPA?", the answers are in this file.
 *
 * Written against the live schema (prisma db pull 2026-05-22).
 */

// ---------------------------------------------------------------------------
// Token posture
// ---------------------------------------------------------------------------

/**
 * PPA is a one-way, non-redeemable in-app credit.
 *
 * Keep this comment — it is the paper trail:
 *  - No cash-out means no "prize" in the gambling sense, which collapses the
 *    consideration + chance + prize analysis for staked predictions.
 *  - No redeemable stored value materially weakens the argument that the app
 *    transmits monetary value under MGL c. 169B (effective 2026-01-01).
 */
export const TOKEN_REDEEMABLE = false as const;

/**
 * Predictions carry no stake.
 *
 * Your Prediction model still has `stakeAmount` and `potentialReward` columns.
 * They stay in the schema for historical rows, but every new Prediction must be
 * written with stakeAmount = 0. Debiting a user for a wrong call is the exact
 * mechanic that makes this look like wagering — a user who can lose PPA they
 * bought with Pi has risked something of value.
 */
export const PREDICTION_STAKES_ENABLED = false as const;

/** Purchase rate. One-way only: Pi buys PPA, PPA never buys Pi. */
export const PI_TO_PPA_RATE = 1000;

/** Top-up denominations offered in the UI, in Pi. */
export const TOPUP_TIERS_PI = [0.5, 1, 2, 5] as const;

export const MIN_AGE_YEARS = 18;

export const TOKEN_DISCLOSURE =
  'PPA is a non-refundable in-app credit. It has no cash value and cannot be exchanged back into Pi or any other currency.';

export const SUPPORT_EMAIL = 'support@pappad.app';

/** True while the app points at Pi Testnet. Drives the TESTNET badge. */
export const IS_TESTNET = process.env.NEXT_PUBLIC_PI_NETWORK !== 'mainnet';

// ---------------------------------------------------------------------------
// Emission control
// ---------------------------------------------------------------------------

/**
 * Every reason PPA can be created out of nothing. `source` on PPATransaction.
 *
 * TOPUP is deliberately absent: purchased PPA is not emission. It is backed by
 * a Pi payment, so it doesn't count against any earn cap.
 */
export const EARN_SOURCES = [
  'CHALLENGE',
  'PREDICTION',
  'STREAK',
  'REFERRAL',
  'CREATOR',
  'ECOSYSTEM',
  'TOURNAMENT',
  'ADMIN',
] as const;

export type EarnSource = (typeof EARN_SOURCES)[number];

/**
 * Per-user, per-source daily emission caps (UTC days).
 *
 * These are the numbers that turn "farmable" into "bounded". Pick them so that
 * a dedicated player hits the total cap in roughly an hour of real play — the
 * cap should bite on scripts, not on enthusiasm.
 *
 * TOURNAMENT and ADMIN are uncapped per-source because they are treasury-funded
 * and issued deliberately; they still count against the global daily budget.
 */
export const DAILY_SOURCE_CAPS: Record<EarnSource, number | null> = {
  CHALLENGE: 250,
  PREDICTION: 200,
  STREAK: 120,
  REFERRAL: 300,
  CREATOR: 200,
  /// Per USER per day, on top of the per-APP budget in AppDailyEmission.
  /// Two ceilings on purpose: the app budget limits what a partner can mint in
  /// total, this limits how much of it can land in one account.
  ECOSYSTEM: 300,
  TOURNAMENT: null,
  ADMIN: null,
};

/** Per-user ceiling across all sources for one UTC day. */
export const DAILY_USER_TOTAL_CAP = 600;

/**
 * Global emission ceiling for one UTC day, across all users.
 *
 * This is the circuit breaker. If an exploit gets past the per-user caps —
 * thousands of fresh accounts, say — the whole platform stops minting for the
 * day rather than inflating the supply while you sleep.
 */
export const DAILY_GLOBAL_BUDGET = 2_000_000;

/**
 * Tier multipliers applied to challenge rewards.
 *
 * All values are >= 1.0 on purpose. The old formula gave NEWCOMER a multiplier
 * below 1, which surfaced on the results card as "Tier bonus: -4 PPA" — a
 * penalty for being new, labelled as a bonus, on a player's first win.
 */
export const TIER_MULTIPLIERS: Record<string, number> = {
  NEWCOMER: 1.0,
  MEMBER: 1.05,
  TRUSTED: 1.1,
  EXPERT: 1.2,
  ELITE: 1.3,
};

/** Streak multipliers, matching the 3d/7d/14d/30d ladder shown in the app. */
export const STREAK_MULTIPLIERS: ReadonlyArray<[number, number]> = [
  [30, 2.0],
  [14, 1.8],
  [7, 1.5],
  [3, 1.2],
  [0, 1.0],
];

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/** Platform-operated accounts. Excluded from every public ranking. */
export const HOUSE_ACCOUNTS = new Set(['PPA_Official', 'PPA_Treasury']);

/** Resolved predictions required before a user appears on the accuracy board. */
export const MIN_RESOLVED_FOR_RANKING = 10;

/** Challenges answered before a user appears on the challenge accuracy board. */
export const MIN_CHALLENGES_FOR_RANKING = 20;
