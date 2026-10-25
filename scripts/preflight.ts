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
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { verifyUserChain } from "../src/lib/ledger";
import { ensureDailyChallenges } from "../src/lib/ppa/rotation";
import { QUESTIONS_PER_CHALLENGE } from "../src/lib/ppa/daily-challenge";

const prisma = new PrismaClient();

type Level = "BLOCK" | "WARN" | "INFO";
interface Result { level: Level; name: string; detail: string; pass: boolean }

const results: Result[] = [];
const add = (level: Level, name: string, pass: boolean, detail: string) =>
  results.push({ level, name, pass, detail });

async function run() {
  // ── 0. Schema matches the code ─────────────────────────────────────────
  //
  // The failure this catches: `git pull` and a Vercel deploy ship code that
  // reads a new column, while `prisma migrate deploy` is never run against
  // the database. Nothing fails at build time — Prisma generates the client
  // from schema.prisma, which is correct — and nothing fails on most pages.
  // It fails on the one write that touches the new column, and if that write
  // is inside a transaction the whole operation rolls back.
  //
  // That is exactly what happened with Question.timesAnswered: the daily
  // challenge submission wrote to it, the column did not exist, and every
  // submission errored with no PPA awarded and no answer recorded, while the
  // rest of the app looked healthy.
  //
  // Comparing the migration folders on disk against the ones the database
  // says it has applied catches the whole class, not just that column.
  try {
    const onDisk = readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    interface MigrationRow { migration_name: string; finished_at: Date | null }
    // Annotated rather than relying on the $queryRaw generic: without a
    // generated Prisma client that generic resolves to {} and the callbacks
    // below become implicit any.
    const applied = (await prisma.$queryRaw`
      SELECT migration_name, finished_at FROM "_prisma_migrations"
    `) as MigrationRow[];
    const done = new Set(
      applied
        .filter((m: MigrationRow) => m.finished_at !== null)
        .map((m: MigrationRow) => m.migration_name),
    );

    const pending = onDisk.filter((m) => !done.has(m));
    add(
      "BLOCK",
      "Migrations applied",
      pending.length === 0,
      pending.length === 0
        ? `${onDisk.length} migration(s), all applied`
        : `${pending.length} NOT applied — run: npx prisma migrate deploy\n` +
          pending.map((p) => `              ${p}`).join("\n"),
    );
  } catch (err) {
    // No _prisma_migrations table means migrations have never been run here,
    // which on a database that is supposed to be serving players is worse
    // than a pending migration, not better.
    add(
      "BLOCK",
      "Migrations applied",
      false,
      `could not read migration history — ${err instanceof Error ? err.message.split("\n")[0] : err}`,
    );
  }

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
  //
  // A ledger row without a hash was written by a path that bypassed
  // appendLedgerEntry — OR it is an older row that a rebaseline deliberately
  // unlinked, which is not the same thing at all.
  //
  // This check counted both, and the first time a rebaseline ran it turned
  // the repair into a blocker: 27 rows were unlinked, two of them earned
  // that same day, and preflight reported "2 rows bypassed the ledger — find
  // the write path" for a write path that had behaved perfectly.
  //
  // The distinction is the current genesis snapshot. A rebaseline writes its
  // snapshot at the moment it runs, so everything it unlinked is OLDER than
  // that snapshot. A row that genuinely skipped the gate is NEWER. Rows
  // before the current genesis are history; rows after it are a live bypass.
  interface UnhashedRow { id: string; userId: string; createdAt: Date }
  interface SnapshotRow { userId: string; createdAt: Date }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recentUnhashed = (await prisma.pPATransaction.findMany({
    where: { rowHash: null, createdAt: { gt: since } },
    select: { id: true, userId: true, createdAt: true },
  })) as UnhashedRow[];

  const genesisAt = new Map<string, Date>();
  if (recentUnhashed.length > 0) {
    const snapshots = (await prisma.pPATransaction.findMany({
      where: {
        isSnapshot: true,
        userId: { in: [...new Set(recentUnhashed.map((r: UnhashedRow) => r.userId))] },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })) as SnapshotRow[];
    for (const s of snapshots) {
      if (!genesisAt.has(s.userId)) genesisAt.set(s.userId, s.createdAt);
    }
  }

  // No snapshot at all and no hash is a bypass: nothing ever anchored it.
  const bypassed = recentUnhashed.filter((r: UnhashedRow) => {
    const g = genesisAt.get(r.userId);
    return !g || r.createdAt > g;
  });
  const unlinkedByRepair = recentUnhashed.length - bypassed.length;

  add("BLOCK", "No unchained writes in 24h", bypassed.length === 0,
    bypassed.length === 0
      ? unlinkedByRepair > 0
        ? `clean (${unlinkedByRepair} older row(s) unlinked by a rebaseline, kept as history)`
        : "clean"
      : `${bypassed.length} row(s) bypassed the ledger — find the write path`);

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

  // ── 11. The daily loop can actually run ────────────────────────────────
  //
  // None of this existed when preflight was written, and it is now the core
  // of the app: if the pool is thin or the rotation cannot build a set, the
  // thing a new Pioneer opens the app to do is missing.

  const liveQuestions = await prisma.question.groupBy({
    by: ["category", "difficulty"],
    where: { qualityScore: { gte: 0 } },
    _count: { id: true },
  });

  const totalLive = liveQuestions.reduce((n, c) => n + c._count.id, 0);
  add("BLOCK", "Question pool is live", totalLive >= 90,
    `${totalLive} questions in rotation`);

  // A themed day draws from ONE category/difficulty cell, so a thin cell is
  // a day with no challenge at that tier rather than a slightly worse one.
  const thinCells = liveQuestions.filter((c) => c._count.id < QUESTIONS_PER_CHALLENGE);
  add("BLOCK", "Every category can fill a day", thinCells.length === 0,
    thinCells.length === 0
      ? "all cells hold 5+"
      : thinCells.map((c) => `${c.category}/${c.difficulty}=${c._count.id}`).join(" "));

  const perDifficulty = ["EASY", "MEDIUM", "HARD"].map((d) => ({
    d,
    n: liveQuestions.filter((c) => c.difficulty === d).reduce((n, c) => n + c._count.id, 0),
  }));
  const thinnestTier = perDifficulty.reduce((min, t) => (t.n < min.n ? t : min));
  const runwayDays = Math.floor(thinnestTier.n / QUESTIONS_PER_CHALLENGE);
  add("WARN", "Two weeks before repeats", runwayDays >= 14,
    `${runwayDays} days at the thinnest tier (${thinnestTier.d})`);

  const unreviewed = await prisma.question.count({
    where: { qualityScore: { gte: 0, lt: 100 } },
  });
  add("WARN", "Nothing unreviewed is served", unreviewed === 0,
    unreviewed === 0
      ? "every live question is hand-checked"
      : `${unreviewed} generated question(s) in rotation — scripts/review-pool.ts`);

  let todaysTiers = 0;
  try {
    todaysTiers = (await ensureDailyChallenges()).length;
  } catch {
    todaysTiers = 0;
  }
  add("BLOCK", "Today's challenges build", todaysTiers === 3,
    `${todaysTiers}/3 tiers available today`);

  // ── 12. The rotation does not depend on the first visitor ──────────────
  const vercelJson = existsSync("vercel.json")
    ? readFileSync("vercel.json", "utf8")
    : "";
  const cronConfigured = vercelJson.includes("/api/cron/daily-challenge");
  add("WARN", "Daily rotation cron set", cronConfigured,
    cronConfigured
      ? "scheduled in vercel.json"
      : "not in vercel.json — the first visitor each day pays to build the set");
  add("WARN", "CRON_SECRET set", Boolean(process.env.CRON_SECRET),
    process.env.CRON_SECRET ? "set" : "missing — the cron route stays closed without it");

  // ── 13. Tiers are reachable ────────────────────────────────────────────
  const played = await prisma.user.count({ where: { totalChallenges: { gte: 25 } } });
  const promoted = await prisma.user.count({ where: { tier: { not: "NEWCOMER" } } });
  // The detail line used to end with "run scripts/backfill-tiers.ts" in every
  // case, including the passing one — so a healthy check printed an
  // instruction to go and fix something that was not wrong. Only say it when
  // there is actually someone eligible who has not been promoted.
  //
  // `promoted` can exceed `played` legitimately: it counts anyone above
  // NEWCOMER, and tier also moves on prediction history, while `played`
  // counts challenge questions only. More promoted than eligible is not a
  // fault, which is the other reason this should not have read as one.
  const behind = Math.max(0, played - promoted);
  add("WARN", "Tiers have been awarded", played === 0 || promoted > 0,
    played === 0
      ? "nobody has played 25 questions yet"
      : behind > 0
        ? `${promoted} promoted, ${played} eligible — run scripts/backfill-tiers.ts`
        : `${promoted} promoted, ${played} eligible on challenges alone`);

  // ── 14. Secrets that should no longer exist ────────────────────────────
  //
  // Each of these belonged to something removed. A credential outliving its
  // feature is a credential nobody is watching.
  const retired = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "WALLET_PRIVATE_SEED",
    "APP_WALLET_ADDRESS",
  ].filter((k) => Boolean(process.env[k]));
  add("WARN", "Retired secrets removed", retired.length === 0,
    retired.length === 0 ? "none present" : `still set: ${retired.join(", ")}`);

  const keyFiles = existsSync(".")
    ? readdirSync(".").filter((f) => f.startsWith(".ppa-keys-"))
    : [];
  add("BLOCK", "No key files on disk", keyFiles.length === 0,
    keyFiles.length === 0 ? "none" : `delete: ${keyFiles.join(", ")}`);

  // ── 15. Ecosystem directory ────────────────────────────────────────────
  const liveListings = await prisma.ecosystemListing.count({ where: { status: "APPROVED" } });
  const waiting = await prisma.ecosystemListing.count({ where: { status: "PENDING" } });
  add("INFO", "Directory listings", true, `${liveListings} live, ${waiting} waiting`);
  add("WARN", "Review queue is current", waiting === 0,
    waiting === 0 ? "nothing waiting" : `${waiting} waiting — scripts/listings.ts pending`);

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
    - /terms, /privacy and /support-ppa read by a Massachusetts attorney
    - the Pi directory description matches what the app actually does
    - one full challenge played end to end in Pi Browser by a person
`);

  if (network !== "mainnet") {
    console.log(`  Still on ${network}. Mainnet is a SECOND Developer Portal project,
  not a setting — the network is fixed when a project is registered. See
  MAINNET.md for the order. The Testnet project's verified domain is
  ppa-prod.vercel.app — Pi says so when you offer it any other redirect host
  — so give the Mainnet project a DIFFERENT domain rather than releasing
  that one. Nothing has to be given up for Mainnet to exist.

    - Mainnet Developer Portal project created (network chosen at registration,
      and permanent for that project)
    - hosting step done, which unlocks the app wallet step
    - Mainnet API key generated — a testnet key makes payments fail
    - separate Neon database, migrated, seeded with content but no balances
    - pappad.app moved from the testnet Vercel project to the mainnet one
      (a domain lives on one project at a time — short gap in service)
    - production URL verified on the MAINNET project
`);
  }

  process.exit(blockers.length > 0 ? 1 : 0);
}

run().finally(() => prisma.$disconnect());
