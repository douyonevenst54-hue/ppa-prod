/**
 * Admin: resolve a prediction market.
 *
 * ── WHAT CHANGED ──────────────────────────────────────────────────────────
 *
 *  1. IT PAID NOTHING. The old handler credited `prediction.potentialReward`.
 *     Since stakes were removed, that column is 0 on every new row — so every
 *     winner was being paid zero and marked correct. Rewards are now computed
 *     at resolution time by computePredictionReward(), which is the only place
 *     that can know the streak and tier the user actually had.
 *
 *  2. AUTHENTICATED. Admin was checked by looking up a `userId` taken from the
 *     request body and comparing that row's username to a hardcoded list. No
 *     session at all — anyone holding an admin's internal id (they appear in
 *     /api/user/[id] responses) could settle any market to any outcome and mint
 *     the payouts. Now: session user, and the allowlist moved to an env var.
 *
 *  3. RESUMABLE, NOT ONE-SHOT. Status was set to RESOLVED *before* the payout
 *     loop. A timeout partway through left the market closed, half the winners
 *     unpaid, and no way to retry — the next call returned "Already resolved".
 *     Now the claim records the outcome, each payout is idempotent on the
 *     prediction id, and re-running finishes the job instead of refusing.
 *
 *  4. IT DIDN'T RECORD THE ANSWER. `Content.outcome` and `Content.settledAt`
 *     exist in your schema and were never written. The winning answer only
 *     survived as a per-prediction boolean. Now it's stored on the market.
 *
 *  5. BATCHED. Four sequential queries per prediction, unbounded — a market
 *     with a few thousand entries would exceed the function timeout partway
 *     through, which is exactly the failure (3) made unrecoverable. Now it
 *     works in batches and reports what's left.
 *
 *  6. accuracyRate is updated in one SQL statement from the counter columns,
 *     rather than read-modify-write per user. This route is the only writer of
 *     that field, and the old version could drift under concurrent resolves.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { award } from "@/lib/ppa/award";
import { computePredictionReward } from "@/lib/ppa/rewards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Comma-separated Pi usernames. Set PPA_ADMIN_USERNAMES in Vercel. */
const ADMIN_USERNAMES = new Set(
  (process.env.PPA_ADMIN_USERNAMES ?? "douyonevenst54")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** Predictions settled per invocation. Keeps us inside the function timeout. */
const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session || !ADMIN_USERNAMES.has(session.username)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentId, correctAnswer } = (await req.json()) as {
    contentId?: string;
    correctAnswer?: string;
  };

  if (!contentId || typeof correctAnswer !== "string" || !correctAnswer) {
    return NextResponse.json({ error: "contentId and correctAnswer required" }, { status: 400 });
  }

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { id: true, status: true, endsAt: true, outcome: true },
  });
  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  // Claim the market atomically, recording the outcome as part of the claim.
  // updateMany's WHERE means two concurrent resolves can't both proceed.
  const claim = await prisma.content.updateMany({
    where: { id: contentId, status: { not: "RESOLVED" } },
    data: { status: "RESOLVED", outcome: correctAnswer, settledAt: new Date() },
  });

  if (claim.count === 0) {
    // Already resolved. That's fine as long as it was resolved to the SAME
    // answer — then this is a resumed run and we carry on paying. A different
    // answer is a mistake, and silently re-settling would be worse than a 409.
    if (content.outcome && content.outcome !== correctAnswer) {
      return NextResponse.json(
        {
          error: "already_resolved_differently",
          message: `This market was already settled to "${content.outcome}".`,
        },
        { status: 409 },
      );
    }
    if (!content.outcome) {
      // Resolved by the old code, which never stored the answer. Record it now
      // so a resumed run has something to check against.
      await prisma.content.update({
        where: { id: contentId },
        data: { outcome: correctAnswer, settledAt: new Date() },
      });
    }
  }

  // Only predictions not yet settled. This is what makes a re-run resume
  // rather than double-pay, alongside the per-prediction idempotency key.
  const pending = await prisma.prediction.findMany({
    where: { contentId, isCorrect: null },
    take: BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      answer: true,
      confidenceLevel: true,
      createdAt: true,
      user: { select: { piUserId: true, streakDays: true, tier: true } },
    },
  });

  let winners = 0;
  let totalPaid = 0;
  let capped = 0;

  for (const prediction of pending) {
    const isCorrect = prediction.answer === correctAnswer;

    const hoursBeforeClose = Math.max(
      0,
      (content.endsAt.getTime() - prediction.createdAt.getTime()) / 3_600_000,
    );

    const reward = computePredictionReward({
      isCorrect,
      confidenceLevel: prediction.confidenceLevel,
      hoursBeforeClose,
      streakDays: prediction.user.streakDays,
      tier: prediction.user.tier,
    });

    let paid = 0;

    if (isCorrect && reward.total > 0) {
      const result = await award({
        piUserId: prediction.user.piUserId,
        amount: reward.total,
        source: "PREDICTION",
        // Keyed on the prediction, so a resumed run pays exactly once.
        idempotencyKey: `prediction:${prediction.id}`,
        allowPartial: true,
        detail: contentId,
      });
      paid = Math.max(0, result.applied);
      if (paid < reward.total) capped++;
      if (paid > 0) totalPaid += paid;
      winners++;
    }

    // Mark the prediction settled only AFTER the payout, so a crash between
    // the two leaves it pending and the next run retries it.
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { isCorrect, ppaEarned: paid },
    });

    // Counters and accuracy in one statement, computed from the columns
    // themselves rather than from a value read a moment ago.
    await prisma.$executeRaw`
      UPDATE "User"
      SET "totalPredictions"   = "totalPredictions" + 1,
          "correctPredictions" = "correctPredictions" + ${isCorrect ? 1 : 0},
          "accuracyRate"       = ("correctPredictions" + ${isCorrect ? 1 : 0})::float
                                 / NULLIF("totalPredictions" + 1, 0)
      WHERE id = ${prediction.userId}
    `;
  }

  const remaining = await prisma.prediction.count({
    where: { contentId, isCorrect: null },
  });

  return NextResponse.json({
    success: true,
    contentId,
    correctAnswer,
    settledThisRun: pending.length,
    winners,
    totalPaid,
    capped,
    remaining,
    // The admin UI should call again while this is true.
    complete: remaining === 0,
  });
}
