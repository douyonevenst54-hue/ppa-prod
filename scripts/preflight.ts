/**
 * Mainnet preflight.
 *
 *   npx tsx scripts/preflight.ts
 *
 * Runs every check that can be made from the database and the environment, and
 * prints a go / no-go list. It changes nothing.
 *
 * Exit code is 1 if any BLOCKER fails, so this can gate a deploy if you ever
 * want it to. WARN items are judgement calls, not stop conditions.
 *
 * The things it CANNOT check are listed at the end — those need a human with a
 * browser and an email client.
 */

import { PrismaClient } from "@prisma/client";
import { verifyUserChain } from "../src/lib/ledger";

const prisma = new PrismaClient();

type Level = "BLOCK" | "WARN" | "INFO";
interface Result { level: Level; name: string; detail: string; pass: boolean }

const results: Result[] = [];
const add = (level: Level, name: string, pass: boolean, detail: string) =>
  results.push({ level, name, pass, detail });

async function run() {
  // ── 1. Ledger integrity ────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    select: { piUserId: true, username: true },
  });
  let broken = 0;
  for (const u of users) {
    const c = await verifyUserChain(prisma, u.piUserId);
    if (!c.ok) broken++;
  }
  add("BLOCK", "Ledger chains verify", broken === 0,
    broken === 0 ? `${users.length}/${users.length} verified` : `${broken} broken — run reconcile-drift.ts`);

  // ── 2. Nothing writing outside the gate ────────────────────────────────
  // Any ledger row without a hash was written by a path that bypassed
  // appendLedgerEntry. Recent ones mean a live bypass, not history.
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const unchained = await prisma.pPATransaction.count({
    where: { rowHash: null, createdAt: { gt: since } },
  });
  add("BLOCK", "No unchained writes in 24h", unchained === 0,
    unchained === 0 ? "clean" : `${unchained} rows bypassed the ledger — find the write path`);

  // ── 3. Redemption is actually off ──────────────────────────────────────
  const redeemAttempts = await prisma.redemptionAttempt.count({
    where: { attemptedAt: { gt: since } },
  });
  add("INFO", "Redemption attempts (24h)", true,
    redeemAttempts === 0 ? "none" : `${redeemAttempts} — old clients still calling, all refused`);

  // ── 4. Winners who were paid nothing ───────────────────────────────────
  // The old resolve handler paid `potentialReward`, which is 0 on every row
  // since stakes were removed. These are real users who won and got nothing.
  const unpaidWinners = await prisma.prediction.count({
    where: { isCorrect: true, ppaEarned: 0 },
  });
  add("BLOCK", "No unpaid winners", unpaidWinners === 0,
    unpaidWinners === 0 ? "clean" : `${unpaidWinners} correct predictions paid 0 PPA — see the fix below`);

  // ── 5. Stranded payments ───────────────────────────────────────────────
  const stranded = await prisma.topUp.findMany({
    where: { status: { not: "COMPLETED" }, createdAt: { lt: new Date(Date.now() - 3600 * 1000) } },
    select: { piPaymentId: true, amountPi: true, status: true },
  });
  add("BLOCK", "No stranded top-ups", stranded.length === 0,
    stranded.length === 0 ? "clean"
      : `${stranded.length} payment(s) over an hour old and not completed: ${stranded.map(s => s.piPaymentId.slice(0, 12)).join(", ")}`);

  // ── 6. Predictions carry no stake ───────────────────────────────────────
  const staked = await prisma.prediction.count({ where: { stakeAmount: { gt: 0 } } });
  const recentStaked = await prisma.prediction.count({
    where: { stakeAmount: { gt: 0 }, createdAt: { gt: since } },
  });
  add("BLOCK", "No new staked predictions", recentStaked === 0,
    recentStaked === 0 ? `${staked} historical, 0 in 24h` : `${recentStaked} staked in the last day — a client is still sending stakeAmount`);

  // ── 7. Partner API keys are hashed ─────────────────────────────────────
  const apps = await prisma.pPAApp.findMany({
    select: { name: true, slug: true, apiKeyHash: true, apiKey: true, dailyEmissionCap: true },
  });
  const unhashed = apps.filter((a) => !a.apiKeyHash);
  add("BLOCK", "Partner keys hashed", unhashed.length === 0,
    unhashed.length === 0 ? `${apps.length} app(s) hashed`
      : `${unhashed.map((a) => a.slug).join(", ")} still plaintext — run rotate-app-keys.ts`);

  const notRotated = apps.filter((a) => a.apiKey && !a.apiKey.startsWith("rotated_"));
  add("WARN", "Old plaintext keys retired", notRotated.length === 0,
    notRotated.length === 0 ? "all retired"
      : `${notRotated.map((a) => a.slug).join(", ")} still hold a usable plaintext key`);

  add("WARN", "Plaintext fallback disabled", process.env.PPA_ALLOW_PLAINTEXT_KEYS === "false",
    process.env.PPA_ALLOW_PLAINTEXT_KEYS === "false" ? "off"
      : "still on — turn it off once partner apps use the new keys");

  // ── 8. Emission is bounded ─────────────────────────────────────────────
  const today = new Date();
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayEmission = await prisma.dailyEmission.findUnique({ where: { day } });
  add("INFO", "PPA emitted today", true, `${todayEmission?.emitted ?? 0} PPA`);

  // ── 9. Environment ─────────────────────────────────────────────────────
  const env = (k: string) => process.env[k];
  add("BLOCK", "PI_API_KEY set", Boolean(env("PI_API_KEY")), env("PI_API_KEY") ? "set" : "missing");
  add("WARN", "PPA_ADMIN_USERNAMES set", Boolean(env("PPA_ADMIN_USERNAMES")),
    env("PPA_ADMIN_USERNAMES") ?? "unset — defaults to douyonevenst54");

  const network = env("NEXT_PUBLIC_PI_NETWORK") ?? "testnet";
  add("INFO", "Pi network", true, network);

  // ── 10. Legal surface has content ──────────────────────────────────────
  const attested = await prisma.user.count({ where: { ageAttestedAt: { not: null } } });
  add("INFO", "Age attestations", true, `${attested}/${users.length} users have confirmed`);

  // ── report ─────────────────────────────────────────────────────────────
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log("\nPPA MAINNET PREFLIGHT\n" + "─".repeat(72) + "\n");

  for (const r of results) {
    const mark = r.pass ? "ok  " : r.level === "BLOCK" ? "FAIL" : "warn";
    console.log(`  ${mark}  ${pad(r.name, 32)} ${r.detail}`);
  }

  const blockers = results.filter((r) => r.level === "BLOCK" && !r.pass);
  const warns = results.filter((r) => r.level === "WARN" && !r.pass);

  console.log("\n" + "─".repeat(72));
  console.log(
    blockers.length === 0
      ? `\n  No blockers.${warns.length ? ` ${warns.length} warning(s).` : ""}\n`
      : `\n  ${blockers.length} BLOCKER(S): ${blockers.map((b) => b.name).join(", ")}\n`,
  );

  if (unpaidWinners > 0) {
    console.log(`  To pay the ${unpaidWinners} unpaid winner(s):

    -- reset them to pending; the per-prediction idempotency key means
    -- anything already paid stays paid
    UPDATE "Prediction" SET "isCorrect" = NULL
    WHERE "isCorrect" = true AND "ppaEarned" = 0;

    then POST /api/admin/resolve again with the same contentId and
    correctAnswer for each affected market.
`);
  }

  console.log(`  Cannot be checked from here — verify by hand:

    - support@pappad.app receives mail and reaches you
    - the warning triangle in Pi Browser is resolved in the Developer Portal
    - pi.toml and the validation key both point at your production domain
    - LoPiPo's environment holds the rotated key
    - .ppa-keys-*.txt is deleted from disk
    - /terms and /privacy have been read by a Massachusetts attorney
`);

  process.exit(blockers.length > 0 ? 1 : 0);
}

run().finally(() => prisma.$disconnect());
