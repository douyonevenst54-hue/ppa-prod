/**
 * REDEMPTION IS PERMANENTLY DISABLED.
 *
 * Replaces the old PPA -> Pi handler. Kept rather than deleted so that old
 * clients get an explanation instead of a 404, and so attempts are logged: if
 * anyone asks whether redemption ran after the cutover, RedemptionAttempt
 * answers.
 *
 * Bringing redemption back is a legal decision before it is an engineering one.
 * See src/lib/ppa/policy.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { SUPPORT_EMAIL } from '@/lib/ppa/policy';

export const dynamic = 'force-dynamic';

const GONE = {
  error: 'redemption_disabled',
  message:
    'PPA can no longer be exchanged back into Pi. PPA is a non-refundable in-app credit with no cash value.',
  support: SUPPORT_EMAIL,
};

async function record(req: NextRequest) {
  try {
    const user = await getSessionUser(req).catch(() => null);
    await prisma.redemptionAttempt.create({
      data: {
        userId: user?.id ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      },
    });
  } catch {
    // Audit logging must never break the response. The 410 is the contract.
  }
}

export async function POST(req: NextRequest) {
  await record(req);
  return NextResponse.json(GONE, { status: 410 });
}

export async function GET(req: NextRequest) {
  await record(req);
  return NextResponse.json(GONE, { status: 410 });
}
