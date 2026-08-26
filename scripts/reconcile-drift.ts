/**
 * Find and repair balance drift.
 *
 *   npx tsx scripts/reconcile-drift.ts           # report only, changes nothing
 *   npx tsx scripts/reconcile-drift.ts --apply   # write reconciliation entries
 *
 * ── WHAT DRIFT MEANS ──────────────────────────────────────────────────────
 *
 * `User.ppaBalance` is higher (or lower) than the sum the hash chain accounts
 * for. That happens exactly one way: something wrote the balance directly
 * instead of going through appendLedgerEntry. The chain isn't corrupt — it's
 * honest about not knowing where the difference came from.
 *
 * ── HOW IT REPAIRS ────────────────────────────────────────────────────────
 *
 * NOT by editing the balance, and NOT by rewriting history. It appends a new
 * `adjust` entry for the difference, so the chain catches up to reality and the
 * gap is permanently visible as a labelled row rather than quietly erased.
 *
 * That is the right instinct for any ledger: you never fix the past, you record
 * a correction. Anyone auditing later can see exactly when the drift happened,
 * how large it was, and that it was reconciled rather than hidden.
 *
 * Run the report first. If the numbers don't match what you expect from the
 * unchained rows it prints, find the write path before reconciling — otherwise
 * you'll be reconciling the same drift again next week.
 */

import { PrismaClient } from "@prisma/client";
import { appendLedgerEntry, verifyUserChain } from "../src/lib/ledger";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, piUserId: true, username: true, ppaBalance: true },
    orderBy: { createdAt: "asc" },
  });

  const drifted: Array<{
    piUserId: string;
    username: string;
    chain: number;
    actual: number;
    delta: number;
  }> = [];

  for (const user of users) {
    const check = await verifyUserChain(prisma, user.piUserId);
    if (check.ok) continue;

    // Only balance drift is auto-repairable. A prevHash or rowHash mismatch
    // means the rows themselves were altered, and that needs a human.
    const match = /chain says (-?\d+), User\.ppaBalance says (-?\d+)/.exec(check.reason);
    if (!match) {
      console.error(`UNREPAIRABLE  ${user.username}: ${check.reason}`);
      continue;
    }

    const chain = Number(match[1]);
    const actual = Number(match[2]);
    drifted.push({
      piUserId: user.piUserId,
      username: user.username,
      chain,
      actual,
      delta: actual - chain,
    });
  }

  if (drifted.length === 0) {
    console.log("No drift. Every chain matches its balance.");
    return;
  }

  console.log(`\n${drifted.length} account(s) drifted:\n`);
  for (const d of drifted) {
    const sign = d.delta > 0 ? "+" : "";
    console.log(
      `  ${d.username.padEnd(18)} chain ${String(d.chain).padStart(7)}  actual ${String(d.actual).padStart(7)}  ${sign}${d.delta}`,
    );
  }

  // Show the unchained rows behind the drift, so the write path is findable.
  console.log(`\nLedger rows written without a hash (these are the culprits):\n`);
  for (const d of drifted) {
    const rows = await prisma.pPATransaction.findMany({
      where: {
        user: { piUserId: d.piUserId },
        rowHash: null,
        createdAt: {
          gt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { amount: true, type: true, source: true, createdAt: true },
    });

    if (rows.length === 0) {
      console.log(`  ${d.username}: no unchained rows — the balance was changed with no ledger row at all`);
      continue;
    }
    for (const r of rows) {
      console.log(
        `  ${d.username.padEnd(18)} ${String(r.amount).padStart(6)}  ${r.type.padEnd(8)} ${r.source}  ${r.createdAt.toISOString()}`,
      );
    }
  }

  if (!APPLY) {
    console.log(`\nReport only. Re-run with --apply to append reconciliation entries.`);
    console.log(`Find the write path first — otherwise this drift comes back.`);
    return;
  }

  console.log(`\nAppending reconciliation entries:\n`);

  for (const d of drifted) {
    try {
      const entry = await appendLedgerEntry(prisma, {
        piUserId: d.piUserId,
        delta: d.delta,
        type: "adjust",
        source: `reconciliation:unchained_write`,
        // Stable per user per drift amount, so a re-run can't double-adjust.
        idempotencyKey: `reconcile:${d.piUserId}:${d.chain}:${d.actual}`,
      });

      // appendLedgerEntry SETS the balance to chain + delta, which equals the
      // balance we already observed — so nothing actually moves. The point is
      // the row, not the arithmetic.
      console.log(
        `  ${d.username.padEnd(18)} ${d.delta > 0 ? "+" : ""}${d.delta}  ->  ${entry.balanceAfter}  ${entry.deduplicated ? "(already reconciled)" : ""}`,
      );
    } catch (err) {
      console.error(`  ${d.username}: FAILED — ${(err as Error).message}`);
    }
  }

  console.log(`\nRe-verifying:\n`);
  let broken = 0;
  for (const d of drifted) {
    const check = await verifyUserChain(prisma, d.piUserId);
    if (check.ok) {
      console.log(`  ok      ${d.username}`);
    } else {
      broken++;
      console.error(`  BROKEN  ${d.username}: ${check.reason}`);
    }
  }

  process.exit(broken > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
