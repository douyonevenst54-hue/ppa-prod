/**
 * Work out WHY a ledger chain fails to verify.
 *
 *   npx tsx --env-file=.env scripts/diagnose-chain.ts douyonevenst54
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * reconcile-drift.ts repairs balance drift and deliberately refuses a hash
 * mismatch, printing "needs manual review". That refusal is correct — a hash
 * mismatch means a row's stored hash disagrees with the one its own fields
 * produce, and the honest responses are to understand it or to close the
 * chain, never to quietly recompute the hash so it agrees with itself. That
 * would turn a tamper-evident ledger into one that forgives tampering.
 *
 * But "needs manual review" with nothing to review it WITH is a dead end.
 * This prints the failing row's every hash input, the stored hash, the
 * recomputed one, and then tries a set of near-miss variants to find which
 * single input differs. That usually names the cause outright:
 *
 *   - balanceAfter stored NULL while the writer hashed a number
 *   - createdAt rewritten by a later update, changing the timestamp hashed
 *   - idempotencyKey set to "" where the writer hashed null
 *   - a row edited by hand or by a migration
 *
 * It changes nothing. It only reads and reports.
 */

import { PrismaClient } from "@prisma/client";
import { computeRowHash } from "../src/lib/ledger";

const prisma = new PrismaClient();

// argv[0] is node and argv[1] is this script; on Windows those are backslash
// paths, so anything cleverer than slice(2) picks the wrong token.
const username = process.argv.slice(2).find((a) => !a.startsWith("-"));

const ZERO_HASH = "0".repeat(64);

/**
 * The REAL hash function, imported rather than reimplemented.
 *
 * The first draft of this script hand-copied computeRowHash so that variants
 * could change one input at a time — and got canonicalize() wrong, because
 * the real one is a proper canonical serializer in src/lib/crypto/canonical.ts
 * and not JSON.stringify with sorted keys. A diagnostic built on a wrong copy
 * of the hash would have reported every row as a mismatch and sent someone
 * looking for tampering that was not there.
 *
 * computeRowHash already takes every input as an argument, so varying one is
 * a matter of passing a different value. There was never a reason to copy it.
 */
const hashWith = computeRowHash;

async function main() {
  if (!username) {
    console.log(`\n  Usage: scripts/diagnose-chain.ts <username>\n`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, piUserId: true, username: true, ppaBalance: true },
  });
  if (!user) {
    console.log(`\n  No user named ${username}\n`);
    process.exitCode = 1;
    return;
  }

  const rows = await prisma.pPATransaction.findMany({
    where: { userId: user.id, rowHash: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  console.log(`\nCHAIN DIAGNOSIS — ${user.username}`);
  console.log("─".repeat(72));
  console.log(`  ${rows.length} chained row(s), User.ppaBalance = ${user.ppaBalance}\n`);

  let expectedPrev = ZERO_HASH;
  let running = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const createdAtIso = r.createdAt.toISOString();
    const base = {
      prevHash: r.prevHash ?? ZERO_HASH,
      piUserId: user.piUserId,
      amount: r.amount,
      type: String(r.type),
      source: String(r.source),
      balanceAfter: r.balanceAfter ?? 0,
      createdAtIso,
      idempotencyKey: r.idempotencyKey ?? null,
    };

    const linkOk = r.prevHash === expectedPrev;
    const recomputed = hashWith(base);
    const hashOk = recomputed === r.rowHash;
    running = r.isSnapshot ? r.amount : running + r.amount;
    const balOk = (r.balanceAfter ?? 0) === running;

    if (linkOk && hashOk && balOk) {
      expectedPrev = r.rowHash!;
      continue;
    }

    console.log(`  FIRST FAILURE at row ${i} (id ${r.id})`);
    console.log(`    link to previous : ${linkOk ? "ok" : "BROKEN"}`);
    console.log(`    rowHash          : ${hashOk ? "ok" : "MISMATCH"}`);
    console.log(`    balanceAfter     : ${balOk ? "ok" : `drift — chain says ${running}, row says ${r.balanceAfter}`}`);
    console.log(`\n    fields hashed:`);
    console.log(`      amount         : ${r.amount}`);
    console.log(`      type           : ${r.type}`);
    console.log(`      source         : ${r.source}`);
    console.log(`      balanceAfter   : ${r.balanceAfter === null ? "NULL" : r.balanceAfter}`);
    console.log(`      createdAt      : ${createdAtIso}`);
    console.log(`      idempotencyKey : ${r.idempotencyKey === null ? "NULL" : JSON.stringify(r.idempotencyKey)}`);
    console.log(`      isSnapshot     : ${r.isSnapshot}`);
    console.log(`      prevHash       : ${r.prevHash?.slice(0, 16) ?? "null"}…`);
    console.log(`      expected prev  : ${expectedPrev.slice(0, 16)}…`);
    console.log(`\n      stored  rowHash: ${r.rowHash?.slice(0, 24)}…`);
    console.log(`      recomputed     : ${recomputed.slice(0, 24)}…`);

    if (!hashOk) {
      // Which single difference would reproduce the stored hash? Whichever
      // variant matches names the field that drifted after the row was
      // written — that is the whole question, and guessing it is the part a
      // human should not have to do by hand.
      const variants: Array<[string, string]> = [
        ["balanceAfter hashed as NULL→0 when it is not null", hashWith({ ...base, balanceAfter: 0 })],
        ["balanceAfter hashed as the running chain total", hashWith({ ...base, balanceAfter: running })],
        ["idempotencyKey hashed as empty string", hashWith({ ...base, idempotencyKey: "" })],
        ["idempotencyKey hashed as null", hashWith({ ...base, idempotencyKey: null })],
        ["createdAt without milliseconds", hashWith({ ...base, createdAtIso: createdAtIso.replace(/\.\d{3}/, "") })],
        ["createdAt as a plain Date string", hashWith({ ...base, createdAtIso: String(r.createdAt) })],
        ["prevHash hashed as all zeroes (genesis)", hashWith({ ...base, prevHash: ZERO_HASH })],
        ["prevHash hashed as the expected link", hashWith({ ...base, prevHash: expectedPrev })],
        ["amount hashed as balanceAfter", hashWith({ ...base, amount: r.balanceAfter ?? 0 })],
      ];

      const hit = variants.filter(([, h]) => h === r.rowHash);
      console.log("");
      if (hit.length > 0) {
        console.log(`    CAUSE FOUND — the stored hash matches if:`);
        for (const [why] of hit) console.log(`      • ${why}`);
        console.log(`\n    So the row was hashed with that value and the column now holds`);
        console.log(`    something else. The row is not evidence of tampering by a player;`);
        console.log(`    it is a write path and a verifier that disagree.`);
      } else {
        console.log(`    No single-field variant reproduces the stored hash.`);
        console.log(`    That points at more than one field changing, or at a row written`);
        console.log(`    before this chain format existed. Closing the chain and opening a`);
        console.log(`    new one at the true balance is then the honest repair — the rows`);
        console.log(`    stay, only the hashes are re-anchored.`);
      }
    }

    console.log(`\n  Rows after this one are not checked: verification stops at the`);
    console.log(`  first break, so a later row could be fine or could be worse.\n`);
    return;
  }

  console.log(`  Chain verifies cleanly over all ${rows.length} rows.`);
  console.log(`  Chain balance ${running}, User.ppaBalance ${user.ppaBalance}` +
    (running === user.ppaBalance ? " — agree.\n" : " — DRIFT.\n"));
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
