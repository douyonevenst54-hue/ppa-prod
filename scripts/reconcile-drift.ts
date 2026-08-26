/**
 * Find and repair balance drift.
 *
 *   npx tsx scripts/reconcile-drift.ts             # report only
 *   npx tsx scripts/reconcile-drift.ts --apply     # repair
 *
 * ── TWO KINDS OF DRIFT ────────────────────────────────────────────────────
 *
 * 1. FINAL BALANCE DRIFT — "chain says X, User.ppaBalance says Y".
 *    The chain is internally consistent; the balance just moved without it.
 *    Repair: append an `adjust` entry for the difference. Nothing is rewritten,
 *    the gap stays visible as a labelled row.
 *
 * 2. BALANCE-AFTER DRIFT — "chain says X, row says Y" at a specific row.
 *    A gated write landed ON TOP of unreconciled drift. appendLedgerEntry
 *    computes balanceAfter as (current actual balance + delta), so if the
 *    balance was already ahead of the chain, the new row bakes that gap in.
 *    The row is genuine and its hash is valid — it just records a balance the
 *    chain can't derive from its own history.
 *
 *    This cannot be fixed by appending, because verification fails AT that row
 *    and never reaches anything after it. The only honest repair is to close
 *    the old chain and open a new one.
 *
 * ── WHAT "CLOSING A CHAIN" MEANS HERE ─────────────────────────────────────
 *
 * For the affected user we clear `prevHash` and `rowHash` on their existing
 * chained rows and write a fresh genesis snapshot at the true balance.
 *
 * The rows themselves are NOT deleted. Amount, type, source and timestamp all
 * survive — what's dropped is the cryptographic linkage, which was already
 * unverifiable. So the history of what happened stays readable; what changes is
 * that we stop claiming those rows are chain-verified when they aren't.
 *
 * The new snapshot records why, in its `source`, so the break is documented
 * rather than quietly papered over. That's the honest version: a ledger you
 * silently "fix" is worth less than one that says where it lost the thread.
 */

import { PrismaClient } from "@prisma/client";
import { appendLedgerEntry, verifyUserChain, computeRowHash } from "../src/lib/ledger";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const ZERO_HASH = "0".repeat(64);

type Problem =
  | { kind: "final"; piUserId: string; username: string; chain: number; actual: number }
  | { kind: "rowAfter"; piUserId: string; username: string; chain: number; row: number }
  | { kind: "hash"; piUserId: string; username: string; reason: string };

async function classify(): Promise<Problem[]> {
  const users = await prisma.user.findMany({
    select: { piUserId: true, username: true },
    orderBy: { createdAt: "asc" },
  });

  const problems: Problem[] = [];

  for (const u of users) {
    const check = await verifyUserChain(prisma, u.piUserId);
    if (check.ok) continue;

    const final = /final balance drift \(chain says (-?\d+), User\.ppaBalance says (-?\d+)\)/.exec(check.reason);
    if (final) {
      problems.push({
        kind: "final",
        piUserId: u.piUserId,
        username: u.username,
        chain: Number(final[1]),
        actual: Number(final[2]),
      });
      continue;
    }

    const rowAfter = /balanceAfter drift \(chain says (-?\d+), row says (-?\d+)\)/.exec(check.reason);
    if (rowAfter) {
      problems.push({
        kind: "rowAfter",
        piUserId: u.piUserId,
        username: u.username,
        chain: Number(rowAfter[1]),
        row: Number(rowAfter[2]),
      });
      continue;
    }

    // prevHash / rowHash mismatch — the rows themselves were altered. Never
    // repaired automatically; that needs a person looking at the data.
    problems.push({
      kind: "hash",
      piUserId: u.piUserId,
      username: u.username,
      reason: check.reason,
    });
  }

  return problems;
}

/** Close the old chain and open a new one at the true balance. */
async function rebaseline(piUserId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; ppaBalance: number }>>`
      SELECT id, "ppaBalance" FROM "User" WHERE "piUserId" = ${piUserId} FOR UPDATE
    `;
    const user = rows[0];
    if (!user) throw new Error(`user not found: ${piUserId}`);

    // Drop the linkage, keep the rows. Amount, type, source and createdAt all
    // survive — only the hashes go, and they were unverifiable anyway.
    const cleared = await tx.pPATransaction.updateMany({
      where: { userId: user.id, rowHash: { not: null } },
      data: { prevHash: null, rowHash: null, isSnapshot: false },
    });

    const createdAt = new Date();
    const source = `rebaseline:pre_gate_drift`;
    const rowHash = computeRowHash({
      prevHash: ZERO_HASH,
      piUserId,
      amount: user.ppaBalance,
      type: "snapshot",
      source,
      balanceAfter: user.ppaBalance,
      createdAtIso: createdAt.toISOString(),
      idempotencyKey: null,
    });

    await tx.pPATransaction.create({
      data: {
        userId: user.id,
        amount: user.ppaBalance,
        type: "snapshot",
        source,
        balanceAfter: user.ppaBalance,
        prevHash: ZERO_HASH,
        rowHash,
        isSnapshot: true,
        createdAt,
      },
    });

    return cleared.count;
  });
}

async function main() {
  const problems = await classify();

  if (problems.length === 0) {
    console.log("All chains verify. Nothing to reconcile.");
    return;
  }

  console.log(`\n${problems.length} account(s) need attention:\n`);
  for (const p of problems) {
    if (p.kind === "final") {
      const delta = p.actual - p.chain;
      console.log(`  ${p.username.padEnd(18)} final drift    chain ${p.chain}  actual ${p.actual}  ${delta > 0 ? "+" : ""}${delta}`);
    } else if (p.kind === "rowAfter") {
      console.log(`  ${p.username.padEnd(18)} row drift      chain ${p.chain}  row ${p.row}  (needs rebaseline)`);
    } else {
      console.log(`  ${p.username.padEnd(18)} HASH MISMATCH  ${p.reason}  (manual review)`);
    }
  }

  if (!APPLY) {
    console.log(`\nReport only. Re-run with --apply to repair.`);
    console.log(`Deploy first if anything is still writing outside the gate.`);
    return;
  }

  console.log(`\nRepairing:\n`);

  for (const p of problems) {
    try {
      if (p.kind === "final") {
        const delta = p.actual - p.chain;
        const entry = await appendLedgerEntry(prisma, {
          piUserId: p.piUserId,
          delta,
          type: "adjust",
          source: "reconciliation:unchained_write",
          idempotencyKey: `reconcile:${p.piUserId}:${p.chain}:${p.actual}`,
        });
        console.log(`  ${p.username.padEnd(18)} adjust ${delta > 0 ? "+" : ""}${delta} -> ${entry.balanceAfter}`);
      } else if (p.kind === "rowAfter") {
        const cleared = await rebaseline(p.piUserId);
        console.log(`  ${p.username.padEnd(18)} rebaselined (${cleared} row(s) unlinked, kept as history)`);
      } else {
        console.log(`  ${p.username.padEnd(18)} SKIPPED — hash mismatch needs manual review`);
      }
    } catch (err) {
      console.error(`  ${p.username.padEnd(18)} FAILED — ${(err as Error).message}`);
    }
  }

  console.log(`\nRe-verifying:\n`);
  const after = await classify();
  if (after.length === 0) {
    console.log("  All chains verify.");
  } else {
    for (const p of after) console.error(`  STILL BROKEN  ${p.username} (${p.kind})`);
  }

  process.exit(after.length > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());