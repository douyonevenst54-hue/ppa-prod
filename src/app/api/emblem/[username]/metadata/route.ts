/**
 * GET /api/emblem/{username}/metadata — NFT-standard metadata.
 *
 * ── WHY THIS EXISTS NOW ───────────────────────────────────────────────────
 *
 * Nothing is minted and nothing is transferable. This endpoint exists so that
 * IF an on-chain version is ever approved, the contract has a tokenURI target
 * that already works, already renders, and already carries the right
 * attributes — and so the shape of the data is decided now, while it's free to
 * change, rather than under deadline pressure later.
 *
 * `transferable: false` is stated in the payload deliberately. Anyone reading
 * this metadata, human or machine, should be able to see that these are
 * soulbound without having to ask.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmblem } from "@/lib/emblem/engine";
import { traitsToAttributes } from "@/lib/emblem/traits";
import { REALM_DEFS } from "@/lib/emblem/realms";

export const revalidate = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, deletedAt: true, leaderboardOptOut: true },
  });

  if (!user || user.deletedAt || user.leaderboardOptOut) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const emblem = await getEmblem(user.id, 5 * 60_000);
  const def = REALM_DEFS[emblem.primary];
  const origin = req.nextUrl.origin;

  return NextResponse.json(
    {
      name: `${def.name} — ${user.username}`,
      description:
        `A Pap Pad App Emblem. Earned, not bought: every trait is derived from this player's record of challenges answered, calls made, and content published. Emblems are soulbound and cannot be transferred or sold.`,
      image: `${origin}/api/emblem/${encodeURIComponent(user.username)}/image`,
      external_url: `${origin}/profile/${encodeURIComponent(user.username)}`,
      attributes: traitsToAttributes(emblem.traits, emblem.standings),
      properties: { transferable: false, soulbound: true },
    },
      { headers: {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300",
} },
  );
}
