/**
 * Privacy settings.
 *
 * GET   -> current settings
 * PATCH -> { leaderboardOptOut: boolean }
 *
 * Opting out removes the user from every public ranking. Every leaderboard
 * query already filters on it — this is just the switch.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { leaderboardOptOut: true, ageAttestedAt: true },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { leaderboardOptOut } = (await req.json()) as {
    leaderboardOptOut?: boolean;
  };

  if (typeof leaderboardOptOut !== "boolean") {
    return NextResponse.json({ error: "leaderboardOptOut required" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { leaderboardOptOut },
  });

  return NextResponse.json({ ok: true, leaderboardOptOut });
}
