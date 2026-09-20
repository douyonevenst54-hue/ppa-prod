/**
 * GET /api/emblem/{username}/image — the Emblem as SVG.
 *
 * Public, cacheable, and generated on the fly. No file is ever stored, which
 * is what makes this immune to the failure mode that killed a large share of
 * 2021-era collections: metadata pointing at servers that stopped paying their
 * bills. Here the image is a pure function of the record.
 *
 * Respects leaderboardOptOut — a user who left the public rankings should not
 * have a public Emblem either.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmblem } from "@/lib/emblem/engine";
import { renderEmblemSVG } from "@/lib/emblem/render";

export const revalidate = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, deletedAt: true, leaderboardOptOut: true },
  });

  if (!user || user.deletedAt || user.leaderboardOptOut) {
    return new NextResponse("Not found", { status: 404 });
  }

  const emblem = await getEmblem(user.id, 5 * 60_000);

  const svg = renderEmblemSVG({
    traits: emblem.traits,
    standings: emblem.standings,
    username: user.username,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
