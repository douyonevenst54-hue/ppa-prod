/**
 * STAKER PERKS — single source of truth.
 *
 * Pioneers can stake Pi toward PPA through Pi's Ecosystem Directory Staking.
 * That stake raises PPA in the directory; Pi returns it when the period ends
 * and pays no reward for it. Pi's Staking Data API (whitelisted apps only,
 * launched 2026-09-04) tells us a user's *effective* stake for PPA: the amount
 * plus a boost for how long it is locked.
 *
 * This file turns that number into a supporter tier and a fixed list of perks.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 * Staking buys recognition and early access. It never buys value or odds.
 *
 *  - No PPA, Pi, or multiplier is ever granted for staking. If staking paid out,
 *    PPA would be presenting a lock-up as a yield, which Pi explicitly says it
 *    is not, and which reads as an investment product.
 *  - No extra prediction entries or better chances at bonuses. That is paying
 *    for odds.
 *  - No reputation, no tier skips in the quiz ladder. Reputation is earned;
 *    if it can be bought, every leaderboard built on it stops meaning anything.
 *
 * If a future perk would break one of those, it does not go in PERKS — however
 * good it looks for growth.
 */

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/**
 * Off until Pi whitelists PPA for the Staking Data API.
 *
 * With the flag off, nothing calls Pi and every user resolves to NONE — the
 * page still explains staking, it just shows no tier.
 */
export function stakerPerksEnabled(): boolean {
  return process.env.STAKER_PERKS_ENABLED === 'true';
}

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export type StakerTier = 'NONE' | 'ZANMI' | 'GADYEN' | 'POTO_MITAN';

/** Lowest to highest. Index order is rank order. */
export const STAKER_TIERS: readonly StakerTier[] = [
  'NONE',
  'ZANMI',
  'GADYEN',
  'POTO_MITAN',
] as const;

/**
 * Minimum *effective* stake for each tier.
 *
 * PLACEHOLDERS. Pi has not published how the duration boost is computed, so we
 * don't yet know what a typical supporter's effective stake looks like. Retune
 * these once real numbers arrive — the logic below does not care what they are,
 * only that they rise.
 */
export const TIER_THRESHOLDS: Record<Exclude<StakerTier, 'NONE'>, number> = {
  ZANMI: 10,
  GADYEN: 100,
  POTO_MITAN: 1000,
};

export const TIER_LABELS: Record<StakerTier, string> = {
  NONE: 'Not staking',
  ZANMI: 'Zanmi',
  GADYEN: 'Gadyen',
  POTO_MITAN: 'Poto Mitan',
};

/** What each name means, shown under the badge. */
export const TIER_MEANINGS: Record<StakerTier, string> = {
  NONE: '',
  ZANMI: 'Friend — you stand with PPA.',
  GADYEN: 'Guardian — you help keep PPA visible.',
  POTO_MITAN: 'Centre pillar — PPA stands on supporters like you.',
};

export const TIER_COLORS: Record<StakerTier, string> = {
  NONE: '#a0a0b8',
  ZANMI: '#00c9a7',
  GADYEN: '#6c63ff',
  POTO_MITAN: '#ffd700',
};

export function rankOf(tier: StakerTier): number {
  return STAKER_TIERS.indexOf(tier);
}

/** The tier an effective stake qualifies for right now, ignoring grace. */
export function tierForStake(effectiveStake: number): StakerTier {
  if (!Number.isFinite(effectiveStake) || effectiveStake <= 0) return 'NONE';
  if (effectiveStake >= TIER_THRESHOLDS.POTO_MITAN) return 'POTO_MITAN';
  if (effectiveStake >= TIER_THRESHOLDS.GADYEN) return 'GADYEN';
  if (effectiveStake >= TIER_THRESHOLDS.ZANMI) return 'ZANMI';
  return 'NONE';
}

/** The next tier up and how much more effective stake it needs, or null at the top. */
export function nextTier(
  effectiveStake: number,
): { tier: StakerTier; needed: number } | null {
  const current = tierForStake(effectiveStake);
  const next = STAKER_TIERS[rankOf(current) + 1];
  if (!next || next === 'NONE') return null;
  const threshold = TIER_THRESHOLDS[next as Exclude<StakerTier, 'NONE'>];
  return { tier: next, needed: Math.max(0, threshold - Math.max(0, effectiveStake)) };
}

// ---------------------------------------------------------------------------
// Grace period
// ---------------------------------------------------------------------------

/**
 * How long a tier survives after the stake behind it drops.
 *
 * Directory stakes end on a fixed date. Without grace, a supporter who re-stakes
 * a day late loses their badge overnight and gets it back the next morning —
 * which feels like a punishment for exactly the people we want to thank.
 */
export const GRACE_PERIOD_MS = 7 * 24 * 3600 * 1000;

export interface StoredStakerState {
  /** Tier the user currently holds (may be a grace tier). */
  tier: StakerTier;
  /** Last time the stake actually qualified for `tier`. */
  qualifiedAt: Date | null;
}

export interface ResolvedStakerState {
  tier: StakerTier;
  qualifiedAt: Date | null;
  /** When the held tier lapses if the stake doesn't recover. Null if not in grace. */
  graceEndsAt: Date | null;
}

/**
 * Combines a fresh effective stake with what we stored last time.
 *
 *  - Stake qualifies for the held tier or higher → take the new tier, reset the clock.
 *  - Stake dropped below the held tier, inside grace → keep the held tier.
 *  - Grace expired → fall to whatever the stake qualifies for now.
 */
export function resolveTier(
  effectiveStake: number,
  previous: StoredStakerState | null,
  now: Date = new Date(),
): ResolvedStakerState {
  const earned = tierForStake(effectiveStake);

  if (!previous || rankOf(earned) >= rankOf(previous.tier)) {
    return {
      tier: earned,
      qualifiedAt: earned === 'NONE' ? previous?.qualifiedAt ?? null : now,
      graceEndsAt: null,
    };
  }

  // Stake fell below the tier the user holds.
  const lastQualified = previous.qualifiedAt?.getTime() ?? 0;
  const graceEnds = lastQualified + GRACE_PERIOD_MS;

  if (now.getTime() < graceEnds) {
    return {
      tier: previous.tier,
      qualifiedAt: previous.qualifiedAt,
      graceEndsAt: new Date(graceEnds),
    };
  }

  return {
    tier: earned,
    qualifiedAt: earned === 'NONE' ? previous.qualifiedAt : now,
    graceEndsAt: null,
  };
}

// ---------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------

export type PerkId =
  | 'SUPPORTER_BADGE'
  | 'LEADERBOARD_FLAIR'
  | 'EMBLEM_FRAME'
  | 'EARLY_ACCESS'
  | 'SUGGEST_POLLS'
  | 'CREATOR_SPOTLIGHT'
  | 'ROADMAP_VOTE'
  | 'EXCLUSIVE_EMBLEM_ART';

export interface Perk {
  id: PerkId;
  /** Lowest tier that unlocks it; every tier above inherits it. */
  minTier: Exclude<StakerTier, 'NONE'>;
  title: string;
  description: string;
}

/**
 * Every perk is recognition or access. Read THE RULE at the top before adding one.
 */
export const PERKS: readonly Perk[] = [
  {
    id: 'SUPPORTER_BADGE',
    minTier: 'ZANMI',
    title: 'Supporter badge',
    description: 'A badge on your profile showing your supporter tier.',
  },
  {
    id: 'LEADERBOARD_FLAIR',
    minTier: 'ZANMI',
    title: 'Leaderboard flair',
    description: 'A mark beside your name on the leaderboards. It never changes your rank.',
  },
  {
    id: 'EMBLEM_FRAME',
    minTier: 'ZANMI',
    title: 'Emblem frame',
    description: 'A supporter frame around your Emblem.',
  },
  {
    id: 'EARLY_ACCESS',
    minTier: 'GADYEN',
    title: 'Early access',
    description: 'New quiz packs and polls open to you 48 hours before everyone else. Rewards are the same.',
  },
  {
    id: 'SUGGEST_POLLS',
    minTier: 'GADYEN',
    title: 'Suggest poll topics',
    description: 'Send poll ideas straight to the team.',
  },
  {
    id: 'CREATOR_SPOTLIGHT',
    minTier: 'POTO_MITAN',
    title: 'Creator Hub spotlight',
    description: 'Your content joins the featured rotation in the Creator Hub.',
  },
  {
    id: 'ROADMAP_VOTE',
    minTier: 'POTO_MITAN',
    title: 'Roadmap vote',
    description: 'A vote on which features PPA builds next.',
  },
  {
    id: 'EXCLUSIVE_EMBLEM_ART',
    minTier: 'POTO_MITAN',
    title: 'Exclusive Emblem art',
    description: 'A supporter-only Emblem design.',
  },
] as const;

export function perksFor(tier: StakerTier): Perk[] {
  const rank = rankOf(tier);
  return PERKS.filter((p) => rankOf(p.minTier) <= rank);
}

export function hasPerk(tier: StakerTier, perk: PerkId): boolean {
  return perksFor(tier).some((p) => p.id === perk);
}

/** Early access window for supporters with EARLY_ACCESS. */
export const EARLY_ACCESS_MS = 48 * 3600 * 1000;

/**
 * Can this user open content that goes public at `publicAt`?
 *
 * Use this when gating new quiz packs or polls, so the window is defined once.
 */
export function canAccessEarly(
  tier: StakerTier,
  publicAt: Date,
  now: Date = new Date(),
): boolean {
  if (now >= publicAt) return true;
  if (!hasPerk(tier, 'EARLY_ACCESS')) return false;
  return now.getTime() >= publicAt.getTime() - EARLY_ACCESS_MS;
}

// ---------------------------------------------------------------------------
// Refresh cadence
// ---------------------------------------------------------------------------

/** How often a stored stake is re-checked against Pi. */
export const REFRESH_INTERVAL_MS = 24 * 3600 * 1000;

export function isStale(checkedAt: Date | null, now: Date = new Date()): boolean {
  if (!checkedAt) return true;
  return now.getTime() - checkedAt.getTime() >= REFRESH_INTERVAL_MS;
}

/** Shown on the Support PPA page and anywhere staking is mentioned. */
export const STAKING_DISCLOSURE =
  'Staking is optional. Your Pi stays locked for the period you choose and is returned when it ends. Neither Pi Network nor PPA pays any reward, interest or PPA for staking — supporter perks are recognition and early access only.';
