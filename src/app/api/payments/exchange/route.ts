import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendA2UPayment } from "@/lib/pi-a2u";

// ──────────────────────────────────────────────────────────────────────────
// Exchange rates and rules
// ──────────────────────────────────────────────────────────────────────────

const PI_TO_PPA = 1000;     // 1π buys 1000 PPA
const PPA_TO_PI = 0.0008;   // 1000 PPA redeems for 0.8π (20% spread)
const BURN_RATE = 0.03;     // 3% of redeemed PPA is burned
const MIN_REDEEM = 5000;    // must redeem at least 5000 PPA at a time
const MIN_ACCURACY = 0.65;  // must have at least 65% prediction accuracy

// ──────────────────────────────────────────────────────────────────────────
// Body validation
// ──────────────────────────────────────────────────────────────────────────

type BuyBody = {
  direction: "buy";
  userId: string;
  amount: number;       // Pi amount
  paymentId: string;
  txid: string;
};

type RedeemBody = {
  direction: "redeem";
  userId: string;
  amount: number;       // PPA amount
};

type Body = BuyBody | RedeemBody;

function isBuyBody(b: unknown): b is BuyBody {
  const x = b as Record<string, unknown>;
  return (
    x?.direction === "buy" &&
    typeof x.userId === "string" &&
    typeof x.amount === "number" &&
    typeof x.paymentId === "string" &&
    typeof x.txid === "string"
  );
}

function isRedeemBody(b: unknown): b is RedeemBody {
  const x = b as Record<string, unknown>;
  return (
    x?.direction === "redeem" &&
    typeof x.userId === "string" &&
    typeof x.amount === "number" &&
    x.amount > 0
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.direction === "buy") {
    if (!isBuyBody(body)) {
      return NextResponse.json({ error: "Invalid buy payload" }, { status: 400 });
    }
    return handleBuy(body);
  }

  if (body.direction === "redeem") {
    if (!isRedeemBody(body)) {
      return NextResponse.json({ error: "Invalid redeem payload" }, { status: 400 });
    }
    return handleRedeem(body);
  }

  return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
}

// ──────────────────────────────────────────────────────────────────────────
// BUY: Pi -> PPA
// ──────────────────────────────────────────────────────────────────────────

async function handleBuy(body: BuyBody) {
  const { userId, amount, paymentId, txid } = body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Idempotency: if we've already credited this Pi paymentId, return the
  // existing record instead of double-crediting.
  const existing = await prisma.pPATransaction.findUnique({
    where: { idempotencyKey: `buy:${paymentId}` },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      direction: "buy",
      piSpent: amount,
      ppaReceived: existing.amount,
      newBalance: user.ppaBalance,
      idempotent: true,
    });
  }

  const ppaAmount = Math.floor(amount * PI_TO_PPA);

  // Tell Pi the txid so it marks the payment fully settled.
  const piRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.PI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
  });
  if (!piRes.ok) {
    const detail = await piRes.text().catch(() => "");
    console.error("Pi /complete failed for buy:", piRes.status, detail);
    return NextResponse.json({ error: "Pi payment completion failed" }, { status: 400 });
  }

  // Atomic credit: balance + ledger entry. The transaction guarantees we
  // never end up with a credited balance without a matching ledger row.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: userId },
      data: { ppaBalance: { increment: ppaAmount } },
    });
    await tx.pPATransaction.create({
      data: {
        userId,
        amount: ppaAmount,
        type: "earn",
        source: `pi_exchange_buy_${amount}pi`,
        idempotencyKey: `buy:${paymentId}`,
      },
    });
  });

  return NextResponse.json({
    success: true,
    direction: "buy",
    piSpent: amount,
    ppaReceived: ppaAmount,
    newBalance: user.ppaBalance + ppaAmount,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// REDEEM: PPA -> Pi  (A2U flow)
// ──────────────────────────────────────────────────────────────────────────

async function handleRedeem(body: RedeemBody) {
  const { userId, amount } = body;

  // Server-side eligibility checks (do not trust the client)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.piUserId) {
    return NextResponse.json({ error: "User missing Pi UID" }, { status: 400 });
  }
  // Legacy rows had username stored in piUserId, which breaks A2U. Force
  // those users to re-authenticate so we capture the real Pi uid + the
  // wallet_address scope.
  const looksLikeUuid = /^[a-f0-9-]{36}$/i.test(user.piUserId);
  if (!looksLikeUuid) {
    return NextResponse.json(
      {
        error: "Please sign out and sign back in to enable Pi payouts.",
        code: "REAUTH_REQUIRED",
      },
      { status: 409 },
    );
  }
  if (amount < MIN_REDEEM) {
    return NextResponse.json(
      { error: `Minimum ${MIN_REDEEM} PPA required to redeem` },
      { status: 400 },
    );
  }
  if (user.accuracyRate < MIN_ACCURACY) {
    return NextResponse.json(
      { error: `Minimum ${Math.round(MIN_ACCURACY * 100)}% accuracy required` },
      { status: 400 },
    );
  }
  if (user.ppaBalance < amount) {
    return NextResponse.json({ error: "Insufficient PPA balance" }, { status: 400 });
  }

  const burnAmount = Math.floor(amount * BURN_RATE);
  const netPPA = amount - burnAmount;
  const piAmount = parseFloat((netPPA * PPA_TO_PI).toFixed(6));

  if (piAmount <= 0) {
    return NextResponse.json({ error: "Redeem amount too small" }, { status: 400 });
  }

  // Idempotency key based on user + amount + minute bucket. Prevents
  // double-debit if the client retries the same request quickly.
  const minute = Math.floor(Date.now() / 60000);
  const idempotencyKey = `redeem:${userId}:${amount}:${minute}`;

  // Step 1: atomically debit PPA and write a "pending" ledger row.
  // If the A2U later fails, we refund in step 3.
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-check inside the transaction to avoid TOCTOU races.
      const fresh = await tx.user.findUnique({ where: { id: userId } });
      if (!fresh || fresh.ppaBalance < amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
      await tx.user.update({
        where: { id: userId },
        data: { ppaBalance: { decrement: amount } },
      });
      await tx.pPATransaction.create({
        data: {
          userId,
          amount: -amount,
          type: "redeem_pending",
          source: `pi_redeem:${piAmount}pi`,
          idempotencyKey,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Insufficient PPA balance" }, { status: 400 });
    }
    // Unique constraint violation -> we already processed this request.
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate redeem in progress. Try again in a minute." },
        { status: 409 },
      );
    }
    console.error("Redeem debit failed:", err);
    return NextResponse.json({ error: "Redeem setup failed" }, { status: 500 });
  }

  // Step 2: actually send Pi via A2U. This calls Pi API + signs/submits a
  // Stellar tx. May take 5-15 seconds.
  let a2u;
  try {
    a2u = await sendA2UPayment({
      uid: user.piUserId,
      amount: piAmount,
      memo: `Redeem ${amount} PPA`,
      metadata: {
        type: "ppa_redeem",
        userId: user.id,
        username: user.username,
        ppaAmount: amount,
        ppaBurned: burnAmount,
      },
    });
  } catch (err) {
    // Step 3a (failure path): A2U failed. Refund the PPA so the user is
    // made whole. We update the pending row to "redeem_failed" rather than
    // deleting it, for audit.
    console.error("A2U send failed, refunding PPA:", err);
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          where: { id: userId },
          data: { ppaBalance: { increment: amount } },
        });
        await tx.pPATransaction.updateMany({
          where: { idempotencyKey },
          data: { type: "redeem_refunded", source: `pi_redeem_failed:${piAmount}pi` },
        });
      });
    } catch (refundErr) {
      console.error("CRITICAL: refund failed after A2U failure", {
        userId,
        amount,
        idempotencyKey,
        refundErr,
      });
    }
    return NextResponse.json(
      { error: "Pi payout failed. Your PPA has been refunded." },
      { status: 502 },
    );
  }

  // Step 3b (success path): A2U succeeded. Mark the ledger row "redeem_done"
  // and capture the Pi paymentId + txid for traceability.
  try {
    await prisma.pPATransaction.updateMany({
      where: { idempotencyKey },
      data: {
        type: "redeem_done",
        source: `pi_redeem_done:${a2u.paymentId}:${a2u.txid}`,
      },
    });
  } catch (err) {
    // Pi was paid but our ledger update failed — log loudly, don't fail.
    console.error("Ledger finalization failed after successful A2U:", {
      idempotencyKey,
      paymentId: a2u.paymentId,
      txid: a2u.txid,
      err,
    });
  }

  return NextResponse.json({
    success: true,
    direction: "redeem",
    ppaSpent: amount,
    ppaBurned: burnAmount,
    piReceived: piAmount,
    paymentId: a2u.paymentId,
    txid: a2u.txid,
    newBalance: user.ppaBalance - amount,
  });
}