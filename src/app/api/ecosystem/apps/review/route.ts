/**
 * Moderating the directory. Admin only.
 *
 *   GET   — everything awaiting review, oldest first
 *   PATCH — { id, status: APPROVED | REJECTED | HIDDEN, note? }
 *   POST  — add a listing directly, already approved
 *
 * Approving a listing grants nothing: no API key, no PPA, no ability to call
 * anything. It makes a name and a link visible. That is deliberate — see the
 * note on /api/ecosystem/apps.
 *
 * The reviewer's username is recorded as text rather than a foreign key, so a
 * deleted account cannot erase who approved what.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isAdminUsername } from "@/lib/admin";
import { validateListing } from "@/lib/ecosystem/listing";

export const dynamic = "force-dynamic";

const DECISIONS = ["APPROVED", "REJECTED", "HIDDEN"] as const;

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session || !isAdminUsername(session.username)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.ecosystemListing.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      url: true,
      category: true,
      submittedAt: true,
      submittedBy: { select: { username: true } },
    },
  });

  const live = await prisma.ecosystemListing.count({ where: { status: "APPROVED" } });

  return NextResponse.json({ pending, pendingCount: pending.length, live });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session || !isAdminUsername(session.username)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const status = String(body?.status ?? "").toUpperCase();

  if (!id || !(DECISIONS as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "id and a status of APPROVED, REJECTED or HIDDEN are required" },
      { status: 400 },
    );
  }

  const listing = await prisma.ecosystemListing.update({
    where: { id },
    data: {
      status: status as never,
      reviewedAt: new Date(),
      reviewedBy: session.username,
      reviewNote: body?.note ? String(body.note).slice(0, 500) : null,
    },
    select: { id: true, name: true, status: true },
  });

  return NextResponse.json({ listing });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session || !isAdminUsername(session.username)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { errors, clean } = validateListing({
    name: body?.name,
    tagline: body?.tagline,
    url: body?.url,
    category: body?.category,
    logoUrl: body?.logoUrl ?? null,
  });

  if (!clean) {
    return NextResponse.json({ error: "invalid_listing", problems: errors }, { status: 400 });
  }

  const clash = await prisma.ecosystemListing.findFirst({
    where: { OR: [{ slug: clean.slug }, { url: clean.url }] },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json({ error: "already_listed" }, { status: 409 });
  }

  const listing = await prisma.ecosystemListing.create({
    data: {
      ...clean,
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: session.username,
    },
    select: { id: true, name: true, slug: true, status: true },
  });

  return NextResponse.json({ listing });
}
