/**
 * Poll voting.
 *
 * Two changes:
 *
 *  1. Voting pays no PPA. In the old flow the vote path minted tokens, which
 *     made polls the cheapest farm in the app — create a poll, vote on it, repeat.
 *     Votes are their own reward; the value is seeing where the community lands.
 *  2. `ppaWeight` is recorded from the voter's balance at vote time for display
 *     ("weighted by holdings"), but no balance is debited and no balance is
 *     required. It is a label, not a stake.
 *
 * The `@@unique([userId, pollOptionId])` constraint prevents double-voting an
 * option; the check below prevents voting twice on the same poll.
 *
 * ADAPT: getSessionUser import path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { pollOptionId } = (await req.json()) as { pollOptionId?: string };
  if (!pollOptionId) {
    return NextResponse.json({ error: 'missing_option' }, { status: 400 });
  }

  const option = await prisma.pollOption.findUnique({
    where: { id: pollOptionId },
    select: { id: true, contentId: true, content: { select: { status: true, endsAt: true } } },
  });

  if (!option || option.content.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'poll_unavailable' }, { status: 404 });
  }
  if (option.content.endsAt <= new Date()) {
    return NextResponse.json({ error: 'poll_closed' }, { status: 409 });
  }

  // One vote per poll, not per option.
  const existing = await prisma.pollVote.findFirst({
    where: { userId: user.id, pollOption: { contentId: option.contentId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'already_voted', message: 'You already voted in this poll.' },
      { status: 409 },
    );
  }

  const voter = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { ppaBalance: true },
  });

  await prisma.$transaction([
    prisma.pollVote.create({
      data: {
        userId: user.id,
        pollOptionId: option.id,
        // Snapshot for display only. Nothing is debited.
        ppaWeight: voter.ppaBalance,
      },
    }),
    prisma.pollOption.update({
      where: { id: option.id },
      data: { voteCount: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastActiveDate: new Date() },
    }),
  ]);

  const results = await prisma.pollOption.findMany({
    where: { contentId: option.contentId },
    select: { id: true, text: true, voteCount: true },
    orderBy: { voteCount: 'desc' },
  });

  return NextResponse.json({ ok: true, results });
}
