/**
 * /api/external/ppa — PPA Ecosystem bridge (LoPiPo and future partner apps)
 *
 * ── WHAT THIS REPLACES ────────────────────────────────────────────────────
 *
 * The previous version let any holder of a partner API key:
 *
 *   1. Mint unlimited PPA. `action: "credit"` took `amount` from the body with
 *      no ceiling of any kind.
 *   2. Mint PPA against Pi that was never paid. `action: "exchange"` credited
 *      `amount * 1000` on the partner's word alone — no paymentId, no txid, no
 *      call to Pi. Combined with the A2U redemption that was live until today,
 *      that was a direct path from "LoPiPo asserts a payment" to real Pi
 *      leaving the treasury.
 *   3. Create arbitrary user accounts. A POST with any `piUserId` string
 *      inserted a User row, unverified against Pi.
 *   4. Double-credit on every retry. No idempotency key anywhere, so a network
 *      hiccup and a client retry paid twice.
 *
 * And the key was matched in plaintext against `PPAApp.apiKey`, while the
 * `apiKeyHash` column sat unused.
 *
 * ── WHAT IT DOES NOW ──────────────────────────────────────────────────────
 *
 *   - `exchange` is gone. Only PPA's own verified Pi payments can mint against
 *     Pi. A partner app cannot assert that money changed hands.
 *   - `credit` is capped per app per UTC day and routed through the emission
 *     gate, so partner rewards draw on a budget you set, not on trust.
 *   - `debit` is routed through the ledger, with the row lock. The old version
 *     read the balance and then decremented it in two statements — a losing
 *     race could overdraw.
 *   - Every mutating call requires an `idempotencyKey` from the partner.
 *   - Users are never created here. The user must have signed into PPA.
 *   - Keys are matched by hash, with a logged plaintext fallback so LoPiPo
 *     keeps working until you rotate.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { award, spend } from "@/lib/ppa/award";

export const dynamic = "force-dynamic";

/** Partner credits are capped per app per day; this is the fallback if unset. */
const DEFAULT_APP_DAILY_CAP = 50_000;

/** Largest single partner credit, regardless of daily headroom. */
const MAX_SINGLE_CREDIT = 5_000;

function utcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

interface ResolvedApp {
  id: string;
  name: string;
  slug: string;
  dailyEmissionCap: number | null;
}

/**
 * Resolve the partner app from the x-ppa-api-key header.
 *
 * Hash lookup first. The plaintext fallback exists only so partners keep
 * working through the rotation window — it logs every time it fires, and you
 * should flip PPA_ALLOW_PLAINTEXT_KEYS to "false" once the logs go quiet.
 */
async function resolveApp(req: NextRequest): Promise<ResolvedApp | null> {
  const presented = req.headers.get("x-ppa-api-key");
  if (!presented) return null;

  const select = {
    id: true,
    name: true,
    slug: true,
    status: true,
    dailyEmissionCap: true,
  } as const;

  const byHash = await prisma.pPAApp.findUnique({
    where: { apiKeyHash: hashKey(presented) },
    select,
  });
  if (byHash) {
    return byHash.status === "ACTIVE" ? byHash : null;
  }

  if (process.env.PPA_ALLOW_PLAINTEXT_KEYS === "false") return null;

  const byPlaintext = await prisma.pPAApp.findUnique({
    where: { apiKey: presented },
    select,
  });
  if (!byPlaintext || byPlaintext.status !== "ACTIVE") return null;

  console.warn(
    `[ecosystem] plaintext API key used by ${byPlaintext.slug} — run scripts/rotate-app-keys.ts`,
  );
  return byPlaintext;
}

// ──────────────────────────────────────────────────────────────────────────
// GET — read a user's ecosystem-visible state
// ──────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const app = await resolveApp(req);
  if (!app) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const piUserId = req.nextUrl.searchParams.get("piUserId");
  if (!piUserId) {
    return NextResponse.json({ error: "piUserId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { piUserId },
    select: {
      piUserId: true,
      username: true,
      ppaBalance: true,
      tier: true,
      streakDays: true,
      deletedAt: true,
    },
  });

  // A deleted account is not found, as far as a partner is concerned.
  if (!user || user.deletedAt) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // accuracyRate is deliberately not exposed. It's a behavioural signal about
  // the user and no partner app needs it to award points.
  const { deletedAt: _omit, ...safe } = user;
  return NextResponse.json({ user: safe, app: app.name });
}

// ──────────────────────────────────────────────────────────────────────────
// POST — credit / debit
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const app = await resolveApp(req);
  if (!app) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const piUserId = typeof body.piUserId === "string" ? body.piUserId : null;
  const rawAmount = Number(body.amount);
  const partnerKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey : null;
  const source = typeof body.source === "string" ? body.source : "reward";

  if (action === "exchange") {
    return NextResponse.json(
      {
        error: "action_removed",
        message:
          "Partner apps can no longer mint PPA against Pi. Pi payments are credited only through PPA's own verified payment flow.",
      },
      { status: 410 },
    );
  }

  if (action !== "credit" && action !== "debit") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!piUserId) {
    return NextResponse.json({ error: "piUserId required" }, { status: 400 });
  }
  if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive integer" },
      { status: 400 },
    );
  }
  if (!partnerKey) {
    // Required, not optional. Without it a retry pays twice, and partner
    // retries are exactly the traffic this endpoint sees.
    return NextResponse.json(
      {
        error: "idempotencyKey required",
        message:
          "Send a stable idempotencyKey unique to this operation, e.g. your own transaction id.",
      },
      { status: 400 },
    );
  }

  // The partner's key is namespaced by app, so two apps can't collide and one
  // app can't replay another's key.
  const idempotencyKey = `eco:${app.slug}:${partnerKey}`;

  const user = await prisma.user.findUnique({
    where: { piUserId },
    select: { id: true, piUserId: true, username: true, deletedAt: true },
  });

  // Never create users here. A partner asserting a piUserId is not evidence
  // that the Pi account exists — the old handler inserted a row on that word
  // alone. The user signs into PPA once; after that this endpoint finds them.
  if (!user || user.deletedAt) {
    return NextResponse.json(
      {
        error: "User not found",
        message: "The user must sign in to PPA once before receiving ecosystem rewards.",
      },
      { status: 404 },
    );
  }

  if (action === "debit") {
    const result = await spend({
      piUserId,
      amount: rawAmount,
      source: `${app.slug}_${source}`,
      idempotencyKey,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Insufficient PPA balance", newBalance: result.balance },
        { status: 400 },
      );
    }

    if (!result.replay) {
      await recordEcosystemTransaction(app, user, -rawAmount, "spend", source);
    }

    return NextResponse.json({
      success: true,
      newBalance: result.balance,
      idempotent: result.replay,
      app: app.name,
    });
  }

  // --- credit ------------------------------------------------------------
  if (rawAmount > MAX_SINGLE_CREDIT) {
    return NextResponse.json(
      {
        error: "amount_too_large",
        message: `Single credits are capped at ${MAX_SINGLE_CREDIT} PPA.`,
      },
      { status: 400 },
    );
  }

  const cap = app.dailyEmissionCap ?? DEFAULT_APP_DAILY_CAP;
  const day = utcDay();

  // Reserve against the app's daily budget before minting. Done as an atomic
  // upsert-then-check so two concurrent partner calls can't both pass.
  const reserved = await prisma.$transaction(async (tx) => {
    const row = await tx.appDailyEmission.upsert({
      where: { appId_day: { appId: app.id, day } },
      create: { appId: app.id, day, emitted: rawAmount },
      update: { emitted: { increment: rawAmount } },
      select: { emitted: true },
    });
    if (row.emitted > cap) {
      // Over budget — give the reservation back and refuse.
      await tx.appDailyEmission.update({
        where: { appId_day: { appId: app.id, day } },
        data: { emitted: { decrement: rawAmount } },
      });
      return false;
    }
    return true;
  });

  if (!reserved) {
    return NextResponse.json(
      {
        error: "app_daily_cap_reached",
        message: `${app.name} has reached its daily PPA budget of ${cap}. Resets at midnight UTC.`,
      },
      { status: 429 },
    );
  }

  const result = await award({
    piUserId,
    amount: rawAmount,
    source: "ECOSYSTEM",
    detail: `${app.slug}_${source}`,
    idempotencyKey,
  });

  if (!result.ok || result.replay) {
    // Refused by the user/global caps, or a duplicate. Either way the app's
    // budget shouldn't be charged for PPA that wasn't minted.
    await prisma.appDailyEmission
      .update({
        where: { appId_day: { appId: app.id, day } },
        data: { emitted: { decrement: rawAmount } },
      })
      .catch(() => null);
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "credit_refused",
        reason: result.reason,
        message:
          result.reason === "global_budget"
            ? "Platform daily emission budget reached. Try again after midnight UTC."
            : "This user has reached their daily earning limit.",
        newBalance: result.balance,
      },
      { status: 429 },
    );
  }

  if (!result.replay) {
    await recordEcosystemTransaction(app, user, rawAmount, "earn", source);
  }

  return NextResponse.json({
    success: true,
    newBalance: result.balance,
    idempotent: result.replay,
    app: app.name,
  });
}

/**
 * Partner-facing reporting. Deliberately outside the ledger transaction: this
 * is a convenience log for the ecosystem dashboard, and a failure here must not
 * roll back a balance the user has already been told about.
 */
async function recordEcosystemTransaction(
  app: ResolvedApp,
  user: { username: string; piUserId: string },
  amount: number,
  type: string,
  source: string,
) {
  try {
    await prisma.$transaction([
      prisma.ecosystemTransaction.create({
        data: {
          appId: app.id,
          piUserId: user.piUserId,
          username: user.username,
          amount,
          type,
          source,
        },
      }),
      prisma.pPAApp.update({
        where: { id: app.id },
        data:
          amount >= 0
            ? { totalEarned: { increment: amount } }
            : { totalSpent: { increment: Math.abs(amount) } },
      }),
    ]);
  } catch (err) {
    console.error("[ecosystem] reporting write failed", { app: app.slug, err });
  }
}
