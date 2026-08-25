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
const tokenCache = new Map<string, { piUserId: string; expiresAt: number }>();
const TOKEN_TTL_MS = 60_000;

function bearerFrom(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolvePiUserId(accessToken: string): Promise<string | null> {
  const cached = tokenCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) return cached.piUserId;

  const res = await fetch(`${PI_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    tokenCache.delete(accessToken);
    return null;
  }

  const me = (await res.json()) as { uid?: string };
  if (!me.uid) return null;

  tokenCache.set(accessToken, {
    piUserId: me.uid,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
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
