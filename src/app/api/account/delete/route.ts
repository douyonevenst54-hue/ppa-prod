/**
 * Self-service account deletion.
 *
 * Two-step by design: the client must send the user's own Pi username, so a
 * stray fetch or a mis-tapped button cannot erase an account.
 *
 * ── ORDER MATTERS HERE ────────────────────────────────────────────────────
 *
 * The balance is zeroed through the ledger BEFORE identifiers are scrubbed, for
 * two reasons:
 *
 *   1. Setting `ppaBalance: 0` directly would leave the hash chain claiming a
 *      balance the User row no longer has — `verifyUserChain` reports that as
 *      "final balance drift" and the chain looks tampered with. Zeroing through
 *      spend() writes a proper closing row instead.
 *   2. The ledger finds users by piUserId. Once that column holds the anonymised
 *      value, the ledger can't find them, so the write has to happen first.
 *
 * PPATransaction rows survive deletion but are de-identified along with the User
 * row. Removing them would break the chain, and the integrity of that chain is
 * the reason it exists. The privacy policy says exactly this, in these words.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { spend } from '@/lib/ppa/award';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { confirmUsername } = (await req.json()) as { confirmUsername?: string };

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true, piUserId: true, ppaBalance: true },
  });

  if (confirmUsername !== current.username) {
    return NextResponse.json(
      {
        error: 'confirmation_mismatch',
        message: 'Type your Pi username exactly to confirm.',
      },
      { status: 400 },
    );
  }

  // 1. Close the balance out on the chain.
  if (current.ppaBalance > 0) {
    const closed = await spend({
      piUserId: current.piUserId,
      amount: current.ppaBalance,
      source: 'account_deleted',
      idempotencyKey: `delete:${user.id}`,
    });

    if (!closed.ok) {
      // Don't scrub a user whose balance we couldn't close — that would leave
      // an unverifiable chain and an account in a half-deleted state.
      console.error('[account/delete] balance close failed', {
        userId: user.id,
        reason: closed.reason,
      });
      return NextResponse.json(
        {
          error: 'delete_failed',
          message: 'We couldn\u2019t close your account just now. Try again in a minute.',
        },
        { status: 500 },
      );
    }
  }

  // 2. Scrub identifiers. Note piUserId and username are both @unique, so the
  //    replacements have to be unique too — both derive from the row id.
  const anon = `deleted_${user.id.slice(0, 12)}`;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      piUserId: anon,
      username: anon,
      leaderboardOptOut: true,
    },
  });

  return NextResponse.json({
    ok: true,
    message:
      'Your account is deleted. Your PPA balance is gone and cannot be restored.',
  });
}
