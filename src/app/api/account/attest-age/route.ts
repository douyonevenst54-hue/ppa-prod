/**
 * Age attestation.
 *
 * Stores the fact and the moment a user confirmed they meet the minimum age.
 * Deliberately no date of birth: the only thing we need to show is that the user
 * was asked and answered, and a stored DOB is a liability with no product use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { MIN_AGE_YEARS } from '@/lib/ppa/policy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { confirmed } = (await req.json()) as { confirmed?: boolean };
  if (!confirmed) {
    return NextResponse.json(
      { error: 'not_confirmed', minAge: MIN_AGE_YEARS },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ageAttestedAt: new Date(), ageAttestedMin: MIN_AGE_YEARS },
  });

  return NextResponse.json({ ok: true });
}
