import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isAdminUsername } from "@/lib/admin";


/** Same construction as scripts/rotate-app-keys.ts and /api/external/ppa. */
function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const apps = await prisma.pPAApp.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        url: true,
        logoUrl: true,
        category: true,
        totalEarned: true,
        totalSpent: true,
        userCount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { userCount: "desc" },
    });

    // Global stats
    const totalPPA = await prisma.user.aggregate({
      _sum: { ppaBalance: true },
    });

    const totalTransactions = await prisma.pPATransaction.count();

    return NextResponse.json({
      apps,
      stats: {
        totalApps: apps.length,
        totalPPAInCirculation: totalPPA._sum.ppaBalance || 0,
        totalTransactions,
      },
    });
  } catch (error) {
    console.error("Registry fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch registry" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── THE ADMIN CHECK USED TO COME OUT OF THE REQUEST BODY ───────────────
    //
    // It read `userId` from the JSON, looked that user up, and checked their
    // username against the admin list. The caller supplied the identity it
    // was then checked against, so anyone holding an admin's internal id
    // could register an app — and a successful POST returns an API key that
    // /api/external/ppa accepts to credit PPA. That made this an
    // unauthenticated route to minting, bounded only by the per-app daily
    // budget.
    const admin = await getSessionUser(req);
    if (!admin || !isAdminUsername(admin.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, slug, description, url, category } = await req.json();

    if (!name?.trim() || !slug?.trim() || !url?.trim()) {
      return NextResponse.json(
        { error: "name, slug and url are required" },
        { status: 400 },
      );
    }

    // Slugs end up in API keys and in URLs, so keep them boring.
    const cleanSlug = String(slug).trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(cleanSlug)) {
      return NextResponse.json(
        { error: "slug must be 3-40 characters, lowercase letters, numbers and hyphens" },
        { status: 400 },
      );
    }

    // ── KEY GENERATION ────────────────────────────────────────────────────
    //
    // Was `Math.random().toString(36)` plus a timestamp. Math.random is not a
    // cryptographic generator: its output is predictable from previous
    // outputs, and the timestamp half is simply guessable. This matches
    // scripts/rotate-app-keys.ts so there is one way to mint a key.
    const key = `ppa_${cleanSlug}_${randomBytes(24).toString("base64url")}`;

    const app = await prisma.pPAApp.create({
      data: {
        name: String(name).trim(),
        slug: cleanSlug,
        description: String(description ?? "").trim(),
        url: String(url).trim(),
        category: category || "GENERAL",
        // Only the hash is stored. The plaintext column holds a non-secret
        // placeholder so its unique constraint stays satisfied and nothing
        // can authenticate with what is in the database.
        apiKeyHash: hashKey(key),
        apiKey: `issued_${cleanSlug}_${Date.now()}`,
        status: "ACTIVE",
      },
      select: { id: true, name: true, slug: true, url: true, category: true },
    });

    // Returned once, here, and never recoverable afterwards.
    return NextResponse.json({ app, apiKey: key });
  } catch (error) {
    console.error("Registry create error:", error);
    return NextResponse.json(
      { error: "Failed to register app" },
      { status: 500 },
    );
  }
}
