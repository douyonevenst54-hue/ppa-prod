/**
 * PPA Balance Ledger
 *
 * Single entry point for any balance mutation. Wraps the User.ppaBalance
 * update and the PPATransaction (ledger row) write into one atomic
 * `prisma.$transaction`, computes the hash chain, and returns the new state.
 *
 * ── CHANGES FROM THE ORIGINAL (2026-08) ───────────────────────────────────
 *
 * The design is unchanged. Four things were fixed or added:
 *
 *   1. COMPOSABLE. `appendLedgerEntry` now accepts either a PrismaClient or an
 *      existing Prisma.TransactionClient. Passing a client opens its own
 *      transaction as before; passing a tx joins the caller's. This is what
 *      lets the emission gate check daily caps and write the ledger row in ONE
 *      transaction — previously impossible, because this function always
 *      opened its own and Prisma won't nest.
 *
 *   2. CHAIN TAIL TIEBREAK. `orderBy: { createdAt: "desc" }` alone is not
 *      deterministic: two rows written in the same millisecond can return in
 *      either order, and the chain silently forks. Now ordered by
 *      [createdAt desc, id desc].
 *
 *   3. IDEMPOTENCY ACTUALLY DEDUPLICATES UNDER RACE. The fast-path check
 *      outside the transaction was correct but the comment claimed the unique
 *      constraint would "catch duplicates inside the transaction too" — it
 *      caught them by throwing P2002, not by returning the existing row. Two
 *      concurrent callers with the same key got one success and one crash.
 *      Now P2002 is caught and resolved to the existing row.
 *
 *   4. SNAPSHOT ON DEMAND. `MISSING_SNAPSHOT` was a hard throw, which is why
 *      no chained rows existed anywhere: every write path hit it and fell back
 *      to direct balance mutation. The snapshot is now created inline on first
 *      append if absent. `ensureUserSnapshot` still exists for the backfill.
 *
 * The hash chain works as follows:
 *   row 0 (snapshot):  prevHash = "0".repeat(64)
 *                      rowHash  = sha256(prevHash || canonical(payload) || createdAt.toISOString())
 *   row N:             prevHash = row(N-1).rowHash
 *                      rowHash  = sha256(prevHash || canonical(payload) || createdAt.toISOString())
 *
 * Tampering with row K invalidates rowHash for K and prevHash for K+1
 * onward, so the chain becomes detectably broken at the point of edit.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { canonicalize } from "@/lib/crypto/canonical";
import { createHash } from "node:crypto";

const ZERO_HASH = "0".repeat(64);

export type LedgerEntryType =
  | "earn"
  | "spend"
  | "exchange"
  | "snapshot"
  | "mandate"
  | "topup"
  | "adjust"
  /// A correction appended when a balance was changed outside the ledger.
  /// Never used by normal write paths — only by scripts/reconcile-drift.ts.
  | "adjust";

export type LedgerClient = PrismaClient | Prisma.TransactionClient;

export interface AppendOptions {
  /** Pi user identifier. The user MUST exist. */
  piUserId: string;
  /** Signed delta. Positive = credit, negative = debit. Cannot be zero. */
  delta: number;
  /** Coarse category for queries / reporting. */
  type: LedgerEntryType;
  /** Free-form provenance string. Examples: "poll", "mandate:cmxyz...", "pi_payment:abc". */
  source: string;
  /** Optional retry-safety key. If a row with this key already exists, the
   *  call is a no-op and returns the existing row. Use for idempotent
   *  Pi payment callbacks etc. */
  idempotencyKey?: string;
}

export interface LedgerAppendResult {
  transactionId: string;
  balanceAfter: number;
  rowHash: string;
  deduplicated: boolean;
}

export class LedgerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "LedgerError";
  }
}

/** True when the client can open a transaction (i.e. it isn't already inside one). */
function canTransact(client: LedgerClient): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === "function";
}

/**
 * Compute the deterministic hash for a ledger row.
 * Exported so tests and reconciliation jobs can recompute and compare.
 */
export function computeRowHash(input: {
  prevHash: string;
  piUserId: string;
  amount: number;
  type: string;
  source: string;
  balanceAfter: number;
  createdAtIso: string;
  idempotencyKey: string | null;
}): string {
  const payload = canonicalize({
    piUserId: input.piUserId,
    amount: String(input.amount),
    type: input.type,
    source: input.source,
    balanceAfter: String(input.balanceAfter),
    idempotencyKey: input.idempotencyKey,
  });
  return createHash("sha256")
    .update(input.prevHash)
    .update(payload)
    .update(input.createdAtIso)
    .digest("hex");
}

/**
 * Create the genesis snapshot row inside an existing transaction.
 *
 * Assumes the caller already holds the row lock on the user.
 */
async function createSnapshotTx(
  tx: Prisma.TransactionClient,
  user: { id: string; ppaBalance: number },
  piUserId: string,
): Promise<string> {
  const createdAt = new Date();
  const rowHash = computeRowHash({
    prevHash: ZERO_HASH,
    piUserId,
    amount: user.ppaBalance,
    type: "snapshot",
    source: "snapshot",
    balanceAfter: user.ppaBalance,
    createdAtIso: createdAt.toISOString(),
    idempotencyKey: null,
  });

  await tx.pPATransaction.create({
    data: {
      userId: user.id,
      amount: user.ppaBalance, // record initial balance as the snapshot delta
      type: "snapshot",
      source: "snapshot",
      balanceAfter: user.ppaBalance,
      prevHash: ZERO_HASH,
      rowHash,
      isSnapshot: true,
      createdAt,
    },
  });

  return rowHash;
}

/**
 * The append, inside a transaction the caller controls.
 *
 * Exported so the emission gate can run cap accounting and the balance write
 * in one atomic unit. Most callers want `appendLedgerEntry` instead.
 */
export async function appendLedgerEntryTx(
  tx: Prisma.TransactionClient,
  opts: AppendOptions,
): Promise<LedgerAppendResult> {
  // 1. Look up the user via piUserId. Lock the row to prevent races on
  //    concurrent writes to the same user.
  const users = await tx.$queryRaw<Array<{ id: string; ppaBalance: number }>>`
    SELECT id, "ppaBalance" FROM "User" WHERE "piUserId" = ${opts.piUserId} FOR UPDATE
  `;
  const user = users[0];
  if (!user) {
    throw new LedgerError(`user not found: ${opts.piUserId}`, "USER_NOT_FOUND");
  }

  // 2. Idempotency, re-checked under the lock. The outer fast path can miss a
  //    concurrent writer; this cannot.
  if (opts.idempotencyKey) {
    const existing = await tx.pPATransaction.findUnique({
      where: { idempotencyKey: opts.idempotencyKey },
      select: { id: true, balanceAfter: true, rowHash: true },
    });
    if (existing) {
      return {
        transactionId: existing.id,
        balanceAfter: existing.balanceAfter ?? 0,
        rowHash: existing.rowHash ?? "",
        deduplicated: true,
      };
    }
  }

  const currentBalance = user.ppaBalance;
  const newBalance = currentBalance + opts.delta;

  if (newBalance < 0) {
    throw new LedgerError(
      `insufficient balance: have ${currentBalance}, would become ${newBalance}`,
      "INSUFFICIENT_BALANCE",
    );
  }

  // 3. Find the chain tail. The id tiebreak matters: without it, two rows
  //    written in the same millisecond can be returned in either order and the
  //    chain forks silently.
  const prevRow = await tx.pPATransaction.findFirst({
    where: { userId: user.id, rowHash: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { rowHash: true },
  });

  // 4. No chain yet: lay the genesis snapshot now rather than refusing. The
  //    old hard throw here is why no user had a chain — every caller hit it
  //    and fell back to mutating ppaBalance directly.
  const prevHash =
    prevRow?.rowHash ?? (await createSnapshotTx(tx, user, opts.piUserId));

  const createdAt = new Date();

  const rowHash = computeRowHash({
    prevHash,
    piUserId: opts.piUserId,
    amount: opts.delta,
    type: opts.type,
    source: opts.source,
    balanceAfter: newBalance,
    createdAtIso: createdAt.toISOString(),
    idempotencyKey: opts.idempotencyKey ?? null,
  });

  await tx.user.update({
    where: { id: user.id },
    data: { ppaBalance: newBalance },
  });

  const ledgerRow = await tx.pPATransaction.create({
    data: {
      userId: user.id,
      amount: opts.delta,
      type: opts.type,
      source: opts.source,
      balanceAfter: newBalance,
      prevHash,
      rowHash,
      idempotencyKey: opts.idempotencyKey ?? null,
      createdAt,
      isSnapshot: false,
    },
  });

  return {
    transactionId: ledgerRow.id,
    balanceAfter: newBalance,
    rowHash,
    deduplicated: false,
  };
}

/**
 * Append a ledger entry. Atomic w.r.t. the user's balance and ledger row.
 *
 * Pass a PrismaClient to run in its own transaction, or an existing
 * TransactionClient to join the caller's.
 *
 * Throws LedgerError on:
 *   - delta of zero / non-integer
 *   - user not found
 *   - insufficient balance for a debit
 */
export async function appendLedgerEntry(
  client: LedgerClient,
  opts: AppendOptions,
): Promise<LedgerAppendResult> {
  if (opts.delta === 0) {
    throw new LedgerError("delta cannot be zero", "ZERO_DELTA");
  }
  if (!Number.isInteger(opts.delta)) {
    throw new LedgerError("delta must be an integer", "NON_INTEGER_DELTA");
  }

  // Already inside someone else's transaction — join it.
  if (!canTransact(client)) {
    return appendLedgerEntryTx(client as Prisma.TransactionClient, opts);
  }

  const prisma = client as PrismaClient;

  // Fast path: avoid opening a transaction for a known duplicate.
  if (opts.idempotencyKey) {
    const existing = await prisma.pPATransaction.findUnique({
      where: { idempotencyKey: opts.idempotencyKey },
      select: { id: true, balanceAfter: true, rowHash: true },
    });
    if (existing) {
      return {
        transactionId: existing.id,
        balanceAfter: existing.balanceAfter ?? 0,
        rowHash: existing.rowHash ?? "",
        deduplicated: true,
      };
    }
  }

  try {
    return await prisma.$transaction((tx) => appendLedgerEntryTx(tx, opts));
  } catch (err) {
    // Two callers raced on the same idempotency key and the unique constraint
    // rejected the loser. That's a duplicate, not a failure — resolve it to the
    // winner's row instead of throwing at the caller.
    const code = (err as { code?: string })?.code;
    if (code === "P2002" && opts.idempotencyKey) {
      const winner = await prisma.pPATransaction.findUnique({
        where: { idempotencyKey: opts.idempotencyKey },
        select: { id: true, balanceAfter: true, rowHash: true },
      });
      if (winner) {
        return {
          transactionId: winner.id,
          balanceAfter: winner.balanceAfter ?? 0,
          rowHash: winner.rowHash ?? "",
          deduplicated: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Create the genesis snapshot row for a user. Idempotent — calling it on a
 * user who already has a snapshot is a no-op.
 *
 * Still used by scripts/backfill-snapshots.ts to establish chains for existing
 * users in one pass, so that `verifyUserChain` is meaningful immediately rather
 * than only after each user's first transaction.
 */
export async function ensureUserSnapshot(
  prisma: PrismaClient,
  piUserId: string,
): Promise<{ created: boolean; rowHash: string }> {
  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<Array<{ id: string; ppaBalance: number }>>`
      SELECT id, "ppaBalance" FROM "User" WHERE "piUserId" = ${piUserId} FOR UPDATE
    `;
    const user = users[0];
    if (!user) {
      throw new LedgerError(`user not found: ${piUserId}`, "USER_NOT_FOUND");
    }

    const existing = await tx.pPATransaction.findFirst({
      where: { userId: user.id, isSnapshot: true },
      select: { rowHash: true },
    });

    if (existing && existing.rowHash) {
      return { created: false, rowHash: existing.rowHash };
    }

    const rowHash = await createSnapshotTx(tx, user, piUserId);
    return { created: true, rowHash };
  });
}

/**
 * Verify the hash chain for a single user. Returns the index of the first
 * broken row, or null if the chain is intact.
 */
export async function verifyUserChain(
  prisma: PrismaClient,
  piUserId: string,
): Promise<{ ok: true; rowCount: number } | { ok: false; brokenAt: number; reason: string }> {
  const user = await prisma.user.findUnique({
    where: { piUserId },
    select: { id: true, ppaBalance: true },
  });
  if (!user) return { ok: false, brokenAt: -1, reason: "user not found" };

  const rows = await prisma.pPATransaction.findMany({
    where: { userId: user.id, rowHash: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      amount: true,
      type: true,
      source: true,
      balanceAfter: true,
      prevHash: true,
      rowHash: true,
      idempotencyKey: true,
      createdAt: true,
      isSnapshot: true,
    },
  });

  let expectedPrev = ZERO_HASH;
  let runningBalance = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.prevHash !== expectedPrev) {
      return {
        ok: false,
        brokenAt: i,
        reason: `prevHash mismatch (expected ${expectedPrev.slice(0, 8)}…, got ${r.prevHash?.slice(0, 8) ?? "null"}…)`,
      };
    }
    const computed = computeRowHash({
      prevHash: r.prevHash,
      piUserId,
      amount: r.amount,
      type: r.type,
      source: r.source,
      balanceAfter: r.balanceAfter ?? 0,
      createdAtIso: r.createdAt.toISOString(),
      idempotencyKey: r.idempotencyKey ?? null,
    });
    if (computed !== r.rowHash) {
      return { ok: false, brokenAt: i, reason: "rowHash does not match recomputed value" };
    }
    runningBalance = r.isSnapshot ? r.amount : runningBalance + r.amount;
    if ((r.balanceAfter ?? 0) !== runningBalance) {
      return {
        ok: false,
        brokenAt: i,
        reason: `balanceAfter drift (chain says ${runningBalance}, row says ${r.balanceAfter})`,
      };
    }
    expectedPrev = r.rowHash!;
  }

  if (runningBalance !== user.ppaBalance) {
    return {
      ok: false,
      brokenAt: rows.length,
      reason: `final balance drift (chain says ${runningBalance}, User.ppaBalance says ${user.ppaBalance})`,
    };
  }

  return { ok: true, rowCount: rows.length };
}
