/**
 * Pi Staking Data API client.
 *
 * Returns a user's *effective* stake toward PPA in Pi's Ecosystem Directory
 * Staking: the amount staked plus a boost for its duration. Pi only ever
 * returns the requesting app's figure, never a user's stakes elsewhere.
 *
 * ── WHY THE ENDPOINT IS CONFIGURATION, NOT CODE ───────────────────────────
 *
 * The API launched 2026-09-04 for whitelisted apps only, and it is not in the
 * public Platform API reference (developers.minepi.com/docs). Pi gives the
 * path, auth method and response shape to whitelisted developers. Rather than
 * hard-code a guess, this client reads them from the environment and fails
 * closed — no URL configured means no call is made.
 *
 * Once Pi sends the details, set:
 *
 *   PI_STAKING_API_URL   full URL; may contain {uid} for the app-specific user id
 *   PI_STAKING_AUTH      "user"   → Authorization: Bearer <user access token>
 *                        "server" → Authorization: Key <PI_API_KEY>
 *   PI_STAKING_FIELD     name of the effective-stake field (default tries
 *                        effective_stake, effectiveStake, then stake)
 *
 * and check parseEffectiveStake() against a real response before turning on
 * STAKER_PERKS_ENABLED.
 */

export type StakeLookup =
  | { ok: true; effectiveStake: number }
  | { ok: false; reason: 'not_configured' | 'not_whitelisted' | 'unauthorized' | 'upstream_error' | 'bad_response' };

const DEFAULT_FIELDS = ['effective_stake', 'effectiveStake', 'stake'] as const;

/**
 * Pulls a non-negative number out of Pi's response.
 *
 * Accepts the field at the top level or under `data`, as a number or numeric
 * string (Pi amounts are sometimes strings to keep precision). Anything else is
 * a bad response — never silently treated as zero, because zero would demote
 * a real supporter.
 */
export function parseEffectiveStake(
  body: unknown,
  field: string | undefined = process.env.PI_STAKING_FIELD,
): number | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const scopes: Record<string, unknown>[] = [record];
  if (record.data && typeof record.data === 'object') {
    scopes.push(record.data as Record<string, unknown>);
  }

  const fields = field ? [field] : DEFAULT_FIELDS;

  for (const scope of scopes) {
    for (const name of fields) {
      const raw = scope[name];
      const value = typeof raw === 'string' ? Number(raw) : raw;
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value;
      }
    }
  }
  return null;
}

export async function fetchEffectiveStake(args: {
  /** The user's Pi access token, from the request's Authorization header. */
  accessToken: string;
  /** App-specific Pi uid (User.piUserId). */
  piUid: string;
}): Promise<StakeLookup> {
  const template = process.env.PI_STAKING_API_URL;
  if (!template) return { ok: false, reason: 'not_configured' };

  const mode = process.env.PI_STAKING_AUTH === 'server' ? 'server' : 'user';
  const serverKey = process.env.PI_API_KEY;
  if (mode === 'server' && !serverKey) return { ok: false, reason: 'not_configured' };

  const url = template.replace('{uid}', encodeURIComponent(args.piUid));
  const authorization =
    mode === 'server' ? `Key ${serverKey}` : `Bearer ${args.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return { ok: false, reason: 'upstream_error' };
  }

  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  // A non-whitelisted app is refused; treat it as "feature unavailable",
  // not as "user has no stake".
  if (res.status === 403) return { ok: false, reason: 'not_whitelisted' };
  if (!res.ok) return { ok: false, reason: 'upstream_error' };

  const body = await res.json().catch(() => null);
  const effectiveStake = parseEffectiveStake(body);
  if (effectiveStake === null) return { ok: false, reason: 'bad_response' };

  return { ok: true, effectiveStake };
}
