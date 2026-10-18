/**
 * GET /api/staker — the signed-in user's supporter tier and perks.
 *
 * Authenticated like every other route: the Pi access token in the
 * Authorization header. The same token is what Pi's Staking Data API may need,
 * which is why the refresh lives here and not in a cron.
 *
 * ?refresh=1 re-reads Pi now (throttled to once a minute per user), for the
 * "I just staked" button. Otherwise the stored figure is used for up to a day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getStakerView } from '@/lib/ppa/staker-service';
import {
  nextTier,
  perksFor,
  STAKING_DISCLOSURE,
  TIER_LABELS,
  TIER_MEANINGS,
} from '@/lib/ppa/staker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // getSessionUser has already validated this token against Pi's /v2/me.
  const accessToken = req.headers.get('authorization')!.slice(7).trim();
  const force = req.nextUrl.searchParams.get('refresh') === '1';

  const view = await getStakerView({
    userId: user.id,
    piUserId: user.piUserId,
    accessToken,
    force,
  });

  const upcoming = view.enabled ? nextTier(view.effectiveStake) : null;

  return NextResponse.json({
    enabled: view.enabled,
    tier: view.tier,
    tierLabel: TIER_LABELS[view.tier],
    tierMeaning: TIER_MEANINGS[view.tier],
    effectiveStake: view.effectiveStake,
    checkedAt: view.checkedAt?.toISOString() ?? null,
    graceEndsAt: view.graceEndsAt?.toISOString() ?? null,
    refreshError: view.refreshError,
    next: upcoming
      ? { tier: upcoming.tier, label: TIER_LABELS[upcoming.tier], needed: upcoming.needed }
      : null,
    perks: perksFor(view.tier).map(({ id, title, description }) => ({ id, title, description })),
    disclosure: STAKING_DISCLOSURE,
  });
}
