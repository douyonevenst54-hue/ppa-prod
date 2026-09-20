/**
 * GET /api/emblem — the signed-in user's Emblem, recomputed if stale.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { recomputeEmblem } from "@/lib/emblem/engine";
import { REALM_DEFS, nextThreshold } from "@/lib/emblem/realms";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Always fresh for the owner: this is the screen where someone checks
  // whether the thing they just did moved the needle.
  const emblem = await recomputeEmblem(session.id);

  return NextResponse.json({
    username: emblem.username,
    realm: emblem.primary,
    realmName: REALM_DEFS[emblem.primary].name,
    level: emblem.level,
    pioneer: emblem.pioneer,
    imageUrl: `/api/emblem/${encodeURIComponent(emblem.username)}/image`,
    standings: emblem.standings.map((s) => ({
      realm: s.realm,
      name: REALM_DEFS[s.realm].name,
      blurb: REALM_DEFS[s.realm].blurb,
      score: s.score,
      level: s.level,
      next: nextThreshold(s.realm, s.score),
    })),
  });
}
