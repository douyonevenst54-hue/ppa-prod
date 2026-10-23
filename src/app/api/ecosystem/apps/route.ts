/**
 * The ecosystem directory.
 *
 *   GET  — approved listings, public, no session needed
 *   POST — submit an app for review (signed in); lands as PENDING
 *
 * ── A LISTING HAS NO POWERS ───────────────────────────────────────────────
 *
 * This is not /api/ecosystem/registry. That one creates a PPAApp, which holds
 * an API key /api/external/ppa accepts to credit PPA. A listing here is a
 * name, a line of text and a link. Approving one grants nothing. Keeping the
 * two apart is the point: otherwise moderating a directory would mean handing
 * out minting keys.
 *
 * ── NO PPA CHANGES HANDS ──────────────────────────────────────────────────
 *
 * Nobody earns for submitting, for being listed, or for tapping through. PPA
 * cannot verify what happens inside someone else's app — that assumption is
 * what made the partner bridge dangerous — and paying for visits would make
 * this advertising, which is a different thing with different obligations.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  validateListing,
  LISTING_CATEGORIES,
} from "@/lib/ecosystem/listing";

export const dynamic = "force-dynamic";

/** One person cannot fill the review queue on their own. */
const MAX_PENDING_PER_USER = 3;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") ?? "ALL").toUpperCase();

  const where = {
    status: "APPROVED" as const,
    ...(category !== "ALL" &&
    (LISTING_CATEGORIES as readonly string[]).includes(category)
      ? { category }
      : {}),
  };

  const listings = await prisma.ecosystemListing.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      url: true,
      logoUrl: true,
      category: true,
    },
  });

  const counts = await prisma.ecosystemListing.groupBy({
    by: ["category"],
    where: { status: "APPROVED" },
    _count: { id: true },
  });

  return NextResponse.json({
    listings,
    counts: Object.fromEntries(counts.map((c) => [c.category, c._count.id])),
    total: listings.length,
    // Said in the payload as well as on the page, so anything that consumes
    // this API carries the caveat with the data.
    notice:
      "Listings are submitted by their developers and checked only for the basics. Being listed here is not an endorsement by Pap Pad App.",
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { errors, clean } = validateListing({
    name: body.name,
    tagline: body.tagline,
    url: body.url,
    category: body.category,
    logoUrl: body.logoUrl ?? null,
  });

  if (!clean) {
    return NextResponse.json({ error: "invalid_listing", problems: errors }, { status: 400 });
  }

  const pending = await prisma.ecosystemListing.count({
    where: { submittedById: session.id, status: "PENDING" },
  });
  if (pending >= MAX_PENDING_PER_USER) {
    return NextResponse.json(
      {
        error: "too_many_pending",
        message: `You already have ${pending} apps waiting for review.`,
      },
      { status: 429 },
    );
  }

  // Same app, submitted twice — by slug or by where it points. Checked before
  // insert so the answer is "it's already here", not a constraint violation.
  const existing = await prisma.ecosystemListing.findFirst({
    where: { OR: [{ slug: clean.slug }, { url: clean.url }] },
    select: { status: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "already_listed",
        message:
          existing.status === "APPROVED"
            ? "That app is already in the directory."
            : "That app has already been submitted and is waiting for review.",
      },
      { status: 409 },
    );
  }

  const listing = await prisma.ecosystemListing.create({
    data: { ...clean, submittedById: session.id, status: "PENDING" },
    select: { id: true, name: true, slug: true, status: true },
  });

  return NextResponse.json({
    listing,
    message: "Submitted. It appears in the directory once it has been reviewed.",
  });
}
