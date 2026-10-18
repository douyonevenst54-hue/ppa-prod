/**
 * Reads and refreshes a user's supporter tier.
 *
 * The only place that talks to both Pi's Staking Data API and the
 * StakerStatus table. Routes that gate a perk call getStakerTier(); only the
 * /api/staker route refreshes, because only it holds the user's access token.
 */

import { prisma } from '@/lib/prisma';
import { fetchEffectiveStake, type StakeLookup } from '@/lib/pi-staking';
import {
  isStale,
  resolveTier,
  stakerPerksEnabled,
  type StakerTier,
} from '@/lib/ppa/staker';

export interface StakerView {
  enabled: boolean;
  tier: StakerTier;
  effectiveStake: number;
  checkedAt: Date | null;
  graceEndsAt: Date | null;
  /** Set when the last refresh attempt couldn't reach Pi; stored values are shown. */
  refreshError: Exclude<StakeLookup, { ok: true }>['reason'] | null;
}

const DISABLED: StakerView = {
  enabled: false,
  tier: 'NONE',
  effectiveStake: 0,
  checkedAt: null,
  graceEndsAt: null,
  refreshError: null,
};

/** Tier for gating a perk. Never calls Pi; NONE when the feature is off. */
export async function getStakerTier(userId: string): Promise<StakerTier> {
  if (!stakerPerksEnabled()) return 'NONE';
  const row = await prisma.stakerStatus.findUnique({
    where: { userId },
    select: { tier: true },
  });
  return (row?.tier as StakerTier | undefined) ?? 'NONE';
}

/**
 * Current view, refreshing from Pi when the stored read is a day old
 * (or `force` is set — throttled to once a minute to protect Pi's API).
 *
 * If Pi can't be reached, the stored tier stands. A failed read is not a
 * zero stake: demoting supporters because Pi had an outage would be wrong.
 */
export async function getStakerView(args: {
  userId: string;
  piUserId: string;
  accessToken: string;
  force?: boolean;
  now?: Date;
}): Promise<StakerView> {
  if (!stakerPerksEnabled()) return DISABLED;

  const now = args.now ?? new Date();
  const stored = await prisma.stakerStatus.findUnique({
    where: { userId: args.userId },
  });

  const recentlyChecked =
    stored?.checkedAt && now.getTime() - stored.checkedAt.getTime() < 60_000;
  const shouldRefresh =
    !stored || isStale(stored.checkedAt, now) || (args.force && !recentlyChecked);

  if (!shouldRefresh && stored) {
    const resolved = resolveTier(
      stored.effectiveStake,
      { tier: stored.tier as StakerTier, qualifiedAt: stored.qualifiedAt },
      now,
    );
    return {
      enabled: true,
      tier: stored.tier as StakerTier,
      effectiveStake: stored.effectiveStake,
      checkedAt: stored.checkedAt,
      graceEndsAt: resolved.graceEndsAt,
      refreshError: null,
    };
  }

  const lookup = await fetchEffectiveStake({
    accessToken: args.accessToken,
    piUid: args.piUserId,
  });

  if (!lookup.ok) {
    return {
      enabled: true,
      tier: (stored?.tier as StakerTier | undefined) ?? 'NONE',
      effectiveStake: stored?.effectiveStake ?? 0,
      checkedAt: stored?.checkedAt ?? null,
      graceEndsAt: null,
      refreshError: lookup.reason,
    };
  }

  const resolved = resolveTier(
    lookup.effectiveStake,
    stored ? { tier: stored.tier as StakerTier, qualifiedAt: stored.qualifiedAt } : null,
    now,
  );

  const saved = await prisma.stakerStatus.upsert({
    where: { userId: args.userId },
    create: {
      userId: args.userId,
      effectiveStake: lookup.effectiveStake,
      tier: resolved.tier,
      qualifiedAt: resolved.qualifiedAt,
      checkedAt: now,
    },
    update: {
      effectiveStake: lookup.effectiveStake,
      tier: resolved.tier,
      qualifiedAt: resolved.qualifiedAt,
      checkedAt: now,
    },
  });

  return {
    enabled: true,
    tier: saved.tier as StakerTier,
    effectiveStake: saved.effectiveStake,
    checkedAt: saved.checkedAt,
    graceEndsAt: resolved.graceEndsAt,
    refreshError: null,
  };
}
