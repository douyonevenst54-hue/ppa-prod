/**
 * seed-worldcup.ts
 *
 * Seeds 2026 FIFA World Cup predictions into PPA.
 *  - Match-outcome predictions (3 options each: home win / draw / away win)
 *  - Tournament-level predictions (champion, top scorer)
 *
 * Both live on the `Content` model (type: "prediction", category: SPORTS,
 * status: ACTIVE), with `PollOption` rows for the choices. `endsAt` is the
 * kickoff time (matches) or the final date (tournament-level), which is the
 * cutoff for voting.
 *
 * Idempotent: skips any Content whose title already exists, so it is safe to
 * re-run as new fixtures become known.
 *
 * Run:  npx tsx src/lib/seed-worldcup.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CONFIG — set this if you want a specific creator. Leave null to auto-resolve.
// ---------------------------------------------------------------------------
const CREATOR_ID: string | null = "cmpbf89b00000sv3vfw2ae3cy";  // PPA_Official

// All kickoff times are UTC. Sourced from the official June 2026 schedule.
// Group-stage round 1 (June 11–13) is already played and intentionally omitted.
type Match = { home: string; away: string; kickoffUTC: string };

const upcomingMatches: Match[] = [
  // --- June 18 ---
  { home: "Czechia",     away: "South Africa",        kickoffUTC: "2026-06-18T16:00:00Z" },
  { home: "Switzerland", away: "Bosnia and Herzegovina", kickoffUTC: "2026-06-18T19:00:00Z" },
  { home: "Canada",      away: "Qatar",               kickoffUTC: "2026-06-18T22:00:00Z" },
  { home: "Mexico",      away: "South Korea",         kickoffUTC: "2026-06-19T01:00:00Z" },
  // --- June 19 ---
  { home: "United States", away: "Australia",         kickoffUTC: "2026-06-19T19:00:00Z" },
  { home: "Scotland",    away: "Morocco",             kickoffUTC: "2026-06-19T22:00:00Z" },
  { home: "Brazil",      away: "Haiti",               kickoffUTC: "2026-06-20T00:30:00Z" }, // 8:30pm ET Philadelphia 🇭🇹
  // --- June 20 ---
  { home: "Türkiye",     away: "Paraguay",            kickoffUTC: "2026-06-20T03:00:00Z" },
  { home: "Netherlands", away: "Sweden",              kickoffUTC: "2026-06-20T17:00:00Z" },
  { home: "Germany",     away: "Ivory Coast",         kickoffUTC: "2026-06-20T20:00:00Z" },
  { home: "Ecuador",     away: "Curaçao",             kickoffUTC: "2026-06-21T00:00:00Z" },
  // --- June 21 ---
  { home: "Tunisia",     away: "Japan",               kickoffUTC: "2026-06-21T04:00:00Z" },
  { home: "Spain",       away: "Saudi Arabia",        kickoffUTC: "2026-06-21T16:00:00Z" },
  { home: "Belgium",     away: "Iran",                kickoffUTC: "2026-06-21T19:00:00Z" },
  { home: "Uruguay",     away: "Cape Verde",          kickoffUTC: "2026-06-21T22:00:00Z" },
  { home: "New Zealand", away: "Egypt",               kickoffUTC: "2026-06-22T01:00:00Z" },
];

const FINAL_DATE = "2026-07-19T19:00:00Z"; // Final, MetLife Stadium

// Strong contenders — option text must be stable (graded by exact string match).
const championContenders = [
  "Spain", "France", "Argentina", "Brazil", "England",
  "Germany", "Portugal", "Netherlands",
];

const topScorerContenders = [
  "Kylian Mbappé", "Lionel Messi", "Harry Kane", "Vinícius Júnior",
  "Erling Haaland", "Lamine Yamal", "Julián Álvarez", "Other",
];

// ---------------------------------------------------------------------------

async function resolveCreatorId(): Promise<string> {
  if (CREATOR_ID) return CREATOR_ID;

  const first = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) {
    throw new Error("No users found — create a user before seeding, or set CREATOR_ID.");
  }
  console.warn(`⚠️  No CREATOR_ID set; attributing to first user: ${first.id}`);
  return first.id;
}

async function createPrediction(
  creatorId: string,
  title: string,
  options: string[],
  endsAt: string,
) {
  const existing = await prisma.content.findFirst({ where: { title } });
  if (existing) {
    console.log(`↺  Skip (exists): ${title}`);
    return;
  }

  await prisma.content.create({
    data: {
      creatorId,
      title,
      category: "SPORTS",
      status: "ACTIVE",
      type: "prediction",
      endsAt: new Date(endsAt),
      pollOptions: {
        create: options.map((text) => ({ text })),
      },
    },
  });
  console.log(`✓  Created: ${title}  (${options.length} options, ends ${endsAt})`);
}

async function main() {
  const creatorId = await resolveCreatorId();
  console.log(`Seeding World Cup predictions as creator: ${creatorId}\n`);

  // 1) Match-outcome predictions
  for (const m of upcomingMatches) {
    // Skip matches whose kickoff has already passed (safe on re-runs mid-tournament)
    if (new Date(m.kickoffUTC) <= new Date()) {
      console.log(`↺  Skip (kicked off): ${m.home} vs ${m.away}`);
      continue;
    }
    await createPrediction(
      creatorId,
      `${m.home} vs ${m.away} — Who wins?`,
      [`${m.home} win`, "Draw", `${m.away} win`],
      m.kickoffUTC,
    );
  }

  // 2) Tournament-level predictions
  await createPrediction(
    creatorId,
    "Who will win the 2026 World Cup?",
    championContenders,
    FINAL_DATE,
  );
  await createPrediction(
    creatorId,
    "Who will be the 2026 World Cup top scorer?",
    topScorerContenders,
    FINAL_DATE,
  );

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });