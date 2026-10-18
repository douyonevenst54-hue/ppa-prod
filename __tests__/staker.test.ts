import { describe, expect, it } from 'vitest';
import {
  canAccessEarly,
  EARLY_ACCESS_MS,
  GRACE_PERIOD_MS,
  hasPerk,
  isStale,
  nextTier,
  PERKS,
  perksFor,
  REFRESH_INTERVAL_MS,
  resolveTier,
  STAKER_TIERS,
  tierForStake,
  TIER_THRESHOLDS,
} from '@/lib/ppa/staker';
import { parseEffectiveStake } from '@/lib/pi-staking';

const DAY = 24 * 3600 * 1000;
const t0 = new Date('2026-10-18T12:00:00Z');
const later = (ms: number) => new Date(t0.getTime() + ms);

describe('tierForStake', () => {
  it('maps stake to tier at and around each threshold', () => {
    expect(tierForStake(0)).toBe('NONE');
    expect(tierForStake(TIER_THRESHOLDS.ZANMI - 0.01)).toBe('NONE');
    expect(tierForStake(TIER_THRESHOLDS.ZANMI)).toBe('ZANMI');
    expect(tierForStake(TIER_THRESHOLDS.GADYEN)).toBe('GADYEN');
    expect(tierForStake(TIER_THRESHOLDS.POTO_MITAN)).toBe('POTO_MITAN');
    expect(tierForStake(1e9)).toBe('POTO_MITAN');
  });

  it('treats junk as no stake', () => {
    expect(tierForStake(-5)).toBe('NONE');
    expect(tierForStake(Number.NaN)).toBe('NONE');
    expect(tierForStake(Number.POSITIVE_INFINITY)).toBe('NONE');
  });

  it('thresholds rise with rank', () => {
    expect(TIER_THRESHOLDS.ZANMI).toBeLessThan(TIER_THRESHOLDS.GADYEN);
    expect(TIER_THRESHOLDS.GADYEN).toBeLessThan(TIER_THRESHOLDS.POTO_MITAN);
  });
});

describe('nextTier', () => {
  it('reports the gap to the next tier', () => {
    expect(nextTier(0)).toEqual({ tier: 'ZANMI', needed: TIER_THRESHOLDS.ZANMI });
    expect(nextTier(TIER_THRESHOLDS.ZANMI)).toEqual({
      tier: 'GADYEN',
      needed: TIER_THRESHOLDS.GADYEN - TIER_THRESHOLDS.ZANMI,
    });
  });

  it('is null at the top', () => {
    expect(nextTier(TIER_THRESHOLDS.POTO_MITAN)).toBeNull();
  });
});

describe('resolveTier', () => {
  it('a first read takes the earned tier', () => {
    const r = resolveTier(150, null, t0);
    expect(r.tier).toBe('GADYEN');
    expect(r.qualifiedAt).toEqual(t0);
    expect(r.graceEndsAt).toBeNull();
  });

  it('an upgrade applies immediately', () => {
    const r = resolveTier(2000, { tier: 'ZANMI', qualifiedAt: t0 }, later(DAY));
    expect(r.tier).toBe('POTO_MITAN');
    expect(r.qualifiedAt).toEqual(later(DAY));
  });

  it('holding the same tier resets the grace clock', () => {
    const r = resolveTier(150, { tier: 'GADYEN', qualifiedAt: t0 }, later(3 * DAY));
    expect(r.tier).toBe('GADYEN');
    expect(r.qualifiedAt).toEqual(later(3 * DAY));
  });

  it('a drop inside the grace period keeps the tier', () => {
    const r = resolveTier(0, { tier: 'GADYEN', qualifiedAt: t0 }, later(2 * DAY));
    expect(r.tier).toBe('GADYEN');
    expect(r.qualifiedAt).toEqual(t0);
    expect(r.graceEndsAt).toEqual(later(GRACE_PERIOD_MS));
  });

  it('a drop after the grace period falls to the earned tier', () => {
    const r = resolveTier(20, { tier: 'GADYEN', qualifiedAt: t0 }, later(GRACE_PERIOD_MS));
    expect(r.tier).toBe('ZANMI');
    expect(r.graceEndsAt).toBeNull();
  });

  it('falling to NONE keeps the old qualifiedAt rather than stamping now', () => {
    const r = resolveTier(0, { tier: 'ZANMI', qualifiedAt: t0 }, later(30 * DAY));
    expect(r.tier).toBe('NONE');
    expect(r.qualifiedAt).toEqual(t0);
  });

  it('a held tier with no qualifiedAt gets no grace', () => {
    const r = resolveTier(0, { tier: 'ZANMI', qualifiedAt: null }, t0);
    expect(r.tier).toBe('NONE');
  });
});

describe('perks', () => {
  it('NONE has no perks', () => {
    expect(perksFor('NONE')).toEqual([]);
  });

  it('higher tiers inherit every lower perk', () => {
    for (let i = 1; i < STAKER_TIERS.length - 1; i++) {
      const lower = perksFor(STAKER_TIERS[i]).map((p) => p.id);
      const higher = perksFor(STAKER_TIERS[i + 1]).map((p) => p.id);
      expect(higher).toEqual(expect.arrayContaining(lower));
      expect(higher.length).toBeGreaterThan(lower.length);
    }
  });

  it('the top tier has every perk', () => {
    expect(perksFor('POTO_MITAN')).toHaveLength(PERKS.length);
  });

  it('hasPerk respects minimum tier', () => {
    expect(hasPerk('ZANMI', 'SUPPORTER_BADGE')).toBe(true);
    expect(hasPerk('ZANMI', 'EARLY_ACCESS')).toBe(false);
    expect(hasPerk('GADYEN', 'EARLY_ACCESS')).toBe(true);
    expect(hasPerk('GADYEN', 'ROADMAP_VOTE')).toBe(false);
  });

  // The rule in staker.ts: perks are recognition or access, never value or odds.
  it('no perk grants currency, multipliers, entries or reputation', () => {
    const banned = /\b(ppa reward|multiplier|bonus ppa|extra entr|reputation boost|yield|interest|payout)\b/i;
    for (const perk of PERKS) {
      expect(`${perk.title} ${perk.description}`).not.toMatch(banned);
    }
  });
});

describe('canAccessEarly', () => {
  const publicAt = later(10 * DAY);

  it('everyone can open public content', () => {
    expect(canAccessEarly('NONE', publicAt, publicAt)).toBe(true);
  });

  it('non-supporters wait', () => {
    expect(canAccessEarly('ZANMI', publicAt, new Date(publicAt.getTime() - 1000))).toBe(false);
  });

  it('Gadyen opens it inside the window, not before', () => {
    const windowOpens = new Date(publicAt.getTime() - EARLY_ACCESS_MS);
    expect(canAccessEarly('GADYEN', publicAt, windowOpens)).toBe(true);
    expect(canAccessEarly('GADYEN', publicAt, new Date(windowOpens.getTime() - 1))).toBe(false);
  });
});

describe('isStale', () => {
  it('never-read is stale', () => {
    expect(isStale(null, t0)).toBe(true);
  });

  it('stale after the refresh interval', () => {
    expect(isStale(t0, later(REFRESH_INTERVAL_MS - 1))).toBe(false);
    expect(isStale(t0, later(REFRESH_INTERVAL_MS))).toBe(true);
  });
});

describe('parseEffectiveStake', () => {
  it('reads common field names, top level or under data', () => {
    expect(parseEffectiveStake({ effective_stake: 42 }, undefined)).toBe(42);
    expect(parseEffectiveStake({ effectiveStake: 7.5 }, undefined)).toBe(7.5);
    expect(parseEffectiveStake({ data: { stake: 3 } }, undefined)).toBe(3);
  });

  it('accepts numeric strings', () => {
    expect(parseEffectiveStake({ effective_stake: '125.4' }, undefined)).toBe(125.4);
  });

  it('honours a configured field name', () => {
    expect(parseEffectiveStake({ boosted: 9, stake: 1 }, 'boosted')).toBe(9);
  });

  it('rejects missing, negative or non-numeric values instead of returning 0', () => {
    expect(parseEffectiveStake({}, undefined)).toBeNull();
    expect(parseEffectiveStake({ effective_stake: -1 }, undefined)).toBeNull();
    expect(parseEffectiveStake({ effective_stake: 'lots' }, undefined)).toBeNull();
    expect(parseEffectiveStake(null, undefined)).toBeNull();
  });
});
