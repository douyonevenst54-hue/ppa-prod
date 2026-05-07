/**
 * PPA Balance Ledger
 *
 * Single entry point for any balance mutation. Wraps the User.ppaBalance
 * update and the PPATransaction (ledger row) write into one atomic
 * `prisma.$transaction`, computes the hash chain, and returns the new state.
 *
 * Use this for ALL new balance writes. Existing code paths in this codebase
 * continue to mutate ppaBalance directly until they are migrated stage by
 * stage (see PPA_MANDATE_SPEC.md). After migration is complete, direct
 * `prisma.user.update({ data: { ppaBalance: ... }})` calls should not exist.
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

export type LedgerEntryType = "earn" | "spend" | "exchange" | "snapshot" | "mandate";

export interface AppendOptions {
  /** Pi user identifier (e.g. "douyonevenst54"). The user MUST exist. */
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
  /** The PPATransaction row id. */
  transactionId: string;
  /** The user's new balance after this entry. */
  balanceAfter: number;
  /** The hash of this row, useful for the caller to log/return. */
  rowHash: string;
  /** True if this call was a duplicate (idempotency match). */
  deduplicated: boolean;
}

export class LedgerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "LedgerError";
  }
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
 * Append a ledger entry. Atomic w.r.t. the user's balance and ledger row.
 *
 * Throws LedgerError on:
 *   - delta of zero
 *   - user not found
 *   - insufficient balance for a debit
 *   - missing snapshot row (call ensureSnapshot first or run the migration)
 */
export async function appendLedgerEntry(
  prisma: PrismaClient,
  opts: AppendOptions,
): Promise<LedgerAppendResult> {
  if (opts.delta === 0) {
    throw new LedgerError("delta cannot be zero", "ZERO_DELTA");
  }
  if (!Number.isInteger(opts.delta)) {
    throw new LedgerError("delta must be an integer", "NON_INTEGER_DELTA");
  }

  // Idempotency fast-path: check outside the transaction. Race condition is
  // benign — the unique constraint on idempotencyKey will catch duplicates
  // inside the transaction too.
  if (opts.idempotencyKey) {
    const existing = await prisma.pPATransaction.findUnique({
      where: { idempotencyKey: opts.idempotencyKey },
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

  return prisma.$transaction(async (tx) => {
    // 1. Look up the user via piUserId. Lock the row to prevent races on
    //    concurrent writes to the same user.
    const users = await tx.$queryRaw<Array<{ id: string; ppaBalance: number }>>`
      SELECT id, "ppaBalance" FROM "User" WHERE "piUserId" = ${opts.piUserId} FOR UPDATE
    `;
    const user = users[0];
    if (!user) {
      throw new LedgerError(`user not found: ${opts.piUserId}`, "USER_NOT_FOUND");
    }

    const currentBalance = user.ppaBalance;
    const newBalance = currentBalance + opts.delta;

    if (newBalance < 0) {
      throw new LedgerError(
        `insufficient balance: have ${currentBalance}, would become ${newBalance}`,
        "INSUFFICIENT_BALANCE",
      );
    }

    // 2. Find the most recent ledger row for this user to chain from. Use
    //    PPATransaction with a hash (i.e., post-snapshot rows) plus the
    //    snapshot itself.
    const prevRow = await tx.pPATransaction.findFirst({
      where: { userId: user.id, rowHash: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { rowHash: true },
    });

    if (!prevRow) {
      throw new LedgerError(
        `no snapshot row for user ${opts.piUserId} — run snapshot generation first`,
        "MISSING_SNAPSHOT",
      );
    }

    const prevHash = prevRow.rowHash!;
    const createdAt = new Date();

    // 3. Compute this row's hash.
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

    // 4. Update the user's balance.
    await tx.user.update({
      where: { id: user.id },
      data: { ppaBalance: newBalance },
    });

    // 5. Insert the ledger row.
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
  });
}

/**
 * Create the genesis snapshot row for a user. Idempotent — calling it on a
 * user who already has a snapshot is a no-op.
 *
 * The snapshot row asserts: "as of this moment, this user has X PPA, and
 * everything that follows is hash-chained from this point."
 *
 * Run this once per user as part of the migration. New user creation paths
 * (auth/pi signup, seed) should call this immediately after creating the User
 * row.
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
        amount: user.ppaBalance,                         // record initial balance as the snapshot delta
        type: "snapshot",
        source: "snapshot",
        balanceAfter: user.ppaBalance,
        prevHash: ZERO_HASH,
        rowHash,
        isSnapshot: true,
        createdAt,
      },
    });

    return { created: true, rowHash };
  });
}

/**
 * Verify the hash chain for a single user. Returns the index of the first
 * broken row, or null if the chain is intact. Used by the reconciliation
 * cron in stage 7.
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
    orderBy: { createdAt: "asc" },
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
      return { ok: false, brokenAt: i, reason: `prevHash mismatch (expected ${expectedPrev.slice(0, 8)}…, got ${r.prevHash?.slice(0, 8) ?? "null"}…)` };
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
      return { ok: false, brokenAt: i, reason: `balanceAfter drift (chain says ${runningBalance}, row says ${r.balanceAfter})` };
    }
    expectedPrev = r.rowHash!;
  }

  if (runningBalance !== user.ppaBalance) {
    return { ok: false, brokenAt: rows.length, reason: `final balance drift (chain says ${runningBalance}, User.ppaBalance says ${user.ppaBalance})` };
  }

  return { ok: true, rowCount: rows.length };
}
