/**
 * Age attestation.
 *
 * GET  -> { attested: boolean }   so the gate knows whether to show
 * POST -> records the confirmation with a timestamp
 *
 * No date of birth is stored. The only thing that needs to exist is a record
 * that the user was asked and answered; a stored DOB is a liability with no
 * product use.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { MIN_AGE_YEARS } from "@/lib/ppa/policy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { ageAttestedAt: true },
  });

  return NextResponse.json({ attested: user.ageAttestedAt !== null });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { confirmed } = (await req.json()) as { confirmed?: boolean };
  if (!confirmed) {
    return NextResponse.json(
      { error: "not_confirmed", minAge: MIN_AGE_YEARS },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { ageAttestedAt: new Date(), ageAttestedMin: MIN_AGE_YEARS },
  });

  return NextResponse.json({ ok: true });
}
