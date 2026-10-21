/**
 * Server-side session resolution.
 *
 * This is the `@/lib/auth` that every route in the patch imports. It didn't
 * exist in your repo — your routes were resolving the user inline — so here is
 * one implementation, written to match the Path B auth you already do in
 * /api/auth/pi: take the Pi access token from the Authorization header, validate
 * it against Pi's /v2/me, and look up the local User by piUserId.
 *
 * IF YOU ALREADY HAVE A SESSION MECHANISM (a cookie, an iron-session, a JWT),
 * throw this file away and export getSessionUser() from that instead. The only
 * contract the routes depend on is:
 *
 *     getSessionUser(req) -> { id, piUserId, username } | null
 *
 * Nothing else in the patch cares how you got there.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface SessionUser {
  id: string;
  piUserId: string;
  username: string;
}

const PI_API = 'https://api.minepi.com/v2';

/**
 * Short-lived cache of token -> piUserId.
 *
 * Without this, every authenticated request costs a round trip to Pi's API,
 * which on a route like /api/challenges/submit doubles the latency the player
 * feels. 60s is short enough that a revoked token stops working promptly.
 */
const tokenCache = new Map<string, { piUserId: string; verifiedAt: number }>();

/**
 * How long a verified token is trusted without re-asking Pi.
 *
 * Was 60 seconds, which on serverless meant effectively every authenticated
 * request made an outbound call to api.minepi.com — the in-memory Map is per
 * instance and does not survive between invocations. That made the whole app
 * only as available, and as fast, as one external call per request.
 *
 * The cost of a longer window is that a token revoked at Pi stays accepted
 * here until it closes. Five minutes is short enough for that to be a small
 * exposure and long enough to stop hammering Pi during a demo.
 */
const TOKEN_TTL_MS = 5 * 60_000;

/**
 * How long a previously verified token keeps working when Pi cannot be reached.
 *
 * A failure to REACH Pi is not evidence that a token is bad. Treating it as a
 * sign-out would log everyone out of a working app because someone else's
 * service hiccuped, so a token we verified recently keeps working while the
 * outage lasts. Beyond this, we stop guessing and ask them to sign in again.
 */
const STALE_GRACE_MS = 60 * 60_000;

/** Give up on Pi rather than holding the request open until the platform kills it. */
const PI_TIMEOUT_MS = 6_000;

function bearerFrom(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolvePiUserId(accessToken: string): Promise<string | null> {
  const cached = tokenCache.get(accessToken);
  const now = Date.now();

  if (cached && now - cached.verifiedAt < TOKEN_TTL_MS) return cached.piUserId;

  let res: Response;
  try {
    res = await fetch(`${PI_API}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(PI_TIMEOUT_MS),
    });
  } catch {
    // Could not reach Pi: a timeout, a DNS failure, a rate limit that drops
    // the connection. This used to escape the function uncaught, which turned
    // it into a 500 on every authenticated route at once while sign-in kept
    // working from the client's cached token — the app looked broken for
    // reasons that had nothing to do with the app.
    //
    // Not reaching Pi says nothing about whether the token is good, so a
    // recently verified one keeps working for the grace window.
    if (cached && now - cached.verifiedAt < STALE_GRACE_MS) return cached.piUserId;
    return null;
  }

  if (!res.ok) {
    // Pi answered and said no. That IS evidence about the token.
    tokenCache.delete(accessToken);
    return null;
  }

  let me: { uid?: string };
  try {
    me = (await res.json()) as { uid?: string };
  } catch {
    if (cached && now - cached.verifiedAt < STALE_GRACE_MS) return cached.piUserId;
    return null;
  }

  if (!me.uid) return null;

  tokenCache.set(accessToken, { piUserId: me.uid, verifiedAt: now });
  return me.uid;
}

/**
 * Returns the signed-in user, or null.
 *
 * Deleted accounts resolve to null: a scrubbed row must not be able to keep
 * acting through a token that was issued before deletion.
 */
export async function getSessionUser(
  req: NextRequest,
): Promise<SessionUser | null> {
  const token = bearerFrom(req);
  if (!token) return null;

  const piUserId = await resolvePiUserId(token);
  if (!piUserId) return null;

  const user = await prisma.user.findUnique({
    where: { piUserId },
    select: { id: true, piUserId: true, username: true, deletedAt: true },
  });

  if (!user || user.deletedAt) return null;

  return { id: user.id, piUserId: user.piUserId, username: user.username };
}

/** Convenience for routes that should 401 rather than branch. */
export async function requireSessionUser(
  req: NextRequest,
): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new Error('unauthenticated');
  return user;
}
