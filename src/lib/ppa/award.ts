/**
 * THE EMISSION GATE.
 *
 * ── THIS FILE NO LONGER WRITES BALANCES ───────────────────────────────────
 *
 * The previous version of this file was a second, parallel ledger. That was my
 * mistake — you had already written `src/lib/ledger.ts`, with the same design
 * and better snapshot handling. Two "single entry points" is zero entry points.
 *
 * So this is now a thin gate that sits IN FRONT of your ledger and adds the one
 * thing it doesn't have: emission limits. All hashing, locking, chaining and
 * balance arithmetic still happen in `appendLedgerEntryTx`.
 *
 * The path is: award() -> check caps -> appendLedgerEntryTx() -> bump counters,
 * all inside ONE transaction. If the ledger write fails, the counters roll back
 * with it, so a failed award never eats someone's daily allowance.
 *
 * The import path is unchanged (`@/lib/ppa/award`), so nothing that already
 * imports award/spend/creditTopUp needs editing — but the argument is now
 * `piUserId`, not `userId`, to match the ledger's key.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendLedgerEntryTx, LedgerError } from "@/lib/ledger";
import {
  DAILY_GLOBAL_BUDGET,
  DAILY_SOURCE_CAPS,
  DAILY_USER_TOTAL_CAP,
  EarnSource,
} from "./policy";

export interface MovementResult {
  ok: boolean;
  /** Signed amount actually applied. 0 when refused. */
  applied: number;
  balance: number;
  /** True when this key was already processed; balance is the original outcome. */
  replay: boolean;
  reason?:
    | "capped"
    | "global_budget"
    | "insufficient_balance"
    | "user_not_found";
  /** Per-user headroom left today, after this call. */
  remainingToday?: number;
}

function utcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function currentBalance(piUserId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { piUserId },
    select: { ppaBalance: true },
  });
  return u?.ppaBalance ?? 0;
}

// ---------------------------------------------------------------------------
// award — creates PPA out of nothing. Capped.
// ---------------------------------------------------------------------------

export interface AwardArgs {
  piUserId: string;
  /** Positive integer. Zero or negative is a programming error, not a refusal. */
  amount: number;
  source: EarnSource;
  /**
   * Stable, caller-derived key. Must be deterministic for the same real-world
   * event: `challenge:${setHash}`, `streak:${piUserId}:${utcDate}`,
   * `referral:${referredUserId}`. Never a random uuid — a random key defeats
   * the entire mechanism.
   */
  idempotencyKey: string;
  /**
   * Pay a partial award up to the remaining cap instead of refusing outright.
   * Good for challenge rewards. Bad for referrals, where a half-payment is more
   * confusing than a clear "limit reached".
   */
  allowPartial?: boolean;
  /** Free-form provenance appended to the ledger row's `source`. */
  detail?: string;
}

export async function award(args: AwardArgs): Promise<MovementResult> {
  if (!Number.isInteger(args.amount) || args.amount <= 0) {
    throw new Error(`award() requires a positive integer amount, got ${args.amount}`);
  }

  const day = utcDay();

  try {
    return await prisma.$transaction(async (tx) => {
      // --- per-source and per-user daily caps -------------------------------
      const sourceCap = DAILY_SOURCE_CAPS[args.source];

      const [sourceRow, totals, globalRow] = await Promise.all([
        sourceCap === null
          ? Promise.resolve(null)
          : tx.userDailyEmission.findUnique({
              where: {
                piUserId_day_source: {
                  piUserId: args.piUserId,
                  day,
                  source: args.source,
                },
              },
              select: { emitted: true },
            }),
        tx.userDailyEmission.aggregate({
          where: { piUserId: args.piUserId, day },
          _sum: { emitted: true },
        }),
        tx.dailyEmission.findUnique({ where: { day }, select: { emitted: true } }),
      ]);

      const roomFromSource =
        sourceCap === null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, sourceCap - (sourceRow?.emitted ?? 0));
      const roomFromTotal = Math.max(
        0,
        DAILY_USER_TOTAL_CAP - (totals._sum.emitted ?? 0),
      );
      const roomFromGlobal = Math.max(
        0,
        DAILY_GLOBAL_BUDGET - (globalRow?.emitted ?? 0),
      );

      const allowed = Math.min(
        args.amount,
        roomFromSource,
        roomFromTotal,
        roomFromGlobal,
      );

      if (allowed <= 0) {
        return {
          ok: false,
          applied: 0,
          balance: await currentBalance(args.piUserId),
          replay: false,
          reason: roomFromGlobal <= 0 ? ("global_budget" as const) : ("capped" as const),
          remainingToday: 0,
        };
      }

      if (allowed < args.amount && !args.allowPartial) {
        return {
          ok: false,
          applied: 0,
          balance: await currentBalance(args.piUserId),
          replay: false,
          reason: "capped" as const,
          remainingToday: allowed,
        };
      }

      // --- the actual write, through YOUR ledger ---------------------------
      const entry = await appendLedgerEntryTx(tx, {
        piUserId: args.piUserId,
        delta: allowed,
        type: "earn",
        source: args.detail
          ? `${args.source.toLowerCase()}:${args.detail}`
          : args.source.toLowerCase(),
        idempotencyKey: args.idempotencyKey,
      });

      // A deduplicated entry must not consume the cap a second time.
      if (entry.deduplicated) {
        return {
          ok: true,
          applied: entry.balanceAfter === 0 ? 0 : allowed,
          balance: entry.balanceAfter,
          replay: true,
        };
      }

      await tx.userDailyEmission.upsert({
        where: {
          piUserId_day_source: {
            piUserId: args.piUserId,
            day,
            source: args.source,
          },
        },
        create: { piUserId: args.piUserId, day, source: args.source, emitted: allowed },
        update: { emitted: { increment: allowed } },
      });

      await tx.dailyEmission.upsert({
        where: { day },
        create: { day, emitted: allowed },
        update: { emitted: { increment: allowed } },
      });

      return {
        ok: true,
        applied: allowed,
        balance: entry.balanceAfter,
        replay: false,
        remainingToday: Math.max(0, roomFromTotal - allowed),
      };
    });
  } catch (err) {
    return translateLedgerError(err, await currentBalance(args.piUserId));
  }
}

// ---------------------------------------------------------------------------
// spend — removes PPA a user already holds. Not capped, never below zero.
// ---------------------------------------------------------------------------

export async function spend(args: {
  piUserId: string;
  amount: number;
  source: string;
  idempotencyKey: string;
}): Promise<MovementResult> {
  if (!Number.isInteger(args.amount) || args.amount <= 0) {
    throw new Error(`spend() requires a positive integer amount, got ${args.amount}`);
  }

  try {
    const entry = await prisma.$transaction((tx) =>
      appendLedgerEntryTx(tx, {
        piUserId: args.piUserId,
        delta: -args.amount,
        type: "spend",
        source: args.source,
        idempotencyKey: args.idempotencyKey,
      }),
    );

    return {
      ok: true,
      applied: entry.deduplicated ? 0 : -args.amount,
      balance: entry.balanceAfter,
      replay: entry.deduplicated,
    };
  } catch (err) {
    return translateLedgerError(err, await currentBalance(args.piUserId));
  }
}

// ---------------------------------------------------------------------------
// creditTopUp — PPA bought with Pi. Backed by a payment, so no earn cap.
// ---------------------------------------------------------------------------

/**
 * Purchased PPA deliberately bypasses the daily emission caps: it isn't
 * emission. Someone who pays 5π for 5,000 PPA has not minted anything — the
 * supply increase is matched by Pi arriving in the treasury. It still gets a
 * chained ledger row like every other movement.
 */
export async function creditTopUp(args: {
  piUserId: string;
  amount: number;
  /** Always the Pi paymentId. One payment, one credit, forever. */
  piPaymentId: string;
}): Promise<MovementResult> {
  if (!Number.isInteger(args.amount) || args.amount <= 0) {
    throw new Error("creditTopUp() requires a positive integer amount");
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const e = await appendLedgerEntryTx(tx, {
        piUserId: args.piUserId,
        delta: args.amount,
        type: "topup",
        source: `pi_topup:${args.piPaymentId}`,
        idempotencyKey: `topup:${args.piPaymentId}`,
      });

      if (!e.deduplicated) {
        await tx.topUp.update({
          where: { piPaymentId: args.piPaymentId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
      return e;
    });

    return {
      ok: true,
      applied: entry.deduplicated ? 0 : args.amount,
      balance: entry.balanceAfter,
      replay: entry.deduplicated,
    };
  } catch (err) {
    return translateLedgerError(err, await currentBalance(args.piUserId));
  }
}

// ---------------------------------------------------------------------------

/**
 * The ledger throws; the gate returns. Callers of award/spend/creditTopUp get a
 * result object for every expected condition, so a route never has to wrap
 * these in try/catch to handle "not enough balance".
 *
 * Genuinely unexpected errors still propagate.
 */
function translateLedgerError(err: unknown, balance: number): MovementResult {
  if (err instanceof LedgerError) {
    if (err.code === "INSUFFICIENT_BALANCE") {
      return { ok: false, applied: 0, balance, replay: false, reason: "insufficient_balance" };
    }
    if (err.code === "USER_NOT_FOUND") {
      return { ok: false, applied: 0, balance: 0, replay: false, reason: "user_not_found" };
    }
  }
  throw err;
}
