/**
 * Daily challenge selection + reputation gating.
 *
 * ── WHY A POOL INSTEAD OF GENERATION ──────────────────────────────────────
 *
 * Generated questions fail in ways that are expensive to notice: a wrong
 * "correct" answer looks exactly like a right one until a player gets it wrong
 * and loses reputation they earned. A fixed pool is checked once, by a person,
 * and then it is correct forever. It also costs nothing per request and can't
 * be down.
 *
 * ── WHAT REPUTATION UNLOCKS ───────────────────────────────────────────────
 *
 * Reputation opens harder tiers, and nothing else. That is deliberate and it is
 * the line to hold: an unlock is recognition of what someone has done, and it
 * can't be sold, transferred, or redeemed. The moment reputation becomes a
 * claim on future value — a promised airdrop, an allocation, a distribution —
 * it stops being a game mechanic and starts being an investment someone was
 * induced to work for. Keep it as access.
 *
 * Harder tiers do pay more PPA, because harder questions are worth more. The
 * emission caps in policy.ts still bound the total, so this can't inflate
 * supply no matter how well someone plays.
 */

import { createHash } from "node:crypto";

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CATEGORIES = [
  "GENERAL",
  "TECH",
  "FINANCE",
  "SOCIAL",
  "SPORTS",
  "POLITICS",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Reputation needed to unlock each tier. */
export const TIER_UNLOCKS: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 10,
  HARD: 30,
};

/** Questions per challenge. */
export const QUESTIONS_PER_CHALLENGE = 5;

/** Seconds allowed per question. */
export const SECONDS_PER_QUESTION = 15;

export interface TierStatus {
  difficulty: Difficulty;
  unlocked: boolean;
  requires: number;
  /** Reputation still needed, or 0 when unlocked. */
  remaining: number;
}

export function tierStatus(reputationScore: number): TierStatus[] {
  return DIFFICULTIES.map((difficulty) => {
    const requires = TIER_UNLOCKS[difficulty];
    const unlocked = reputationScore >= requires;
    return {
      difficulty,
      unlocked,
      requires,
      remaining: unlocked ? 0 : Math.ceil(requires - reputationScore),
    };
  });
}

export function unlockedDifficulties(reputationScore: number): Difficulty[] {
  return DIFFICULTIES.filter((d) => reputationScore >= TIER_UNLOCKS[d]);
}

/* ------------------------------------------------------------------ */
/* Deterministic daily selection                                      */
/* ------------------------------------------------------------------ */

/** "2026-10-14" in UTC. One challenge set per UTC day, globally. */
export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * How often a day is themed to a single category rather than mixed.
 *
 * Themed days are the minority on purpose. With six categories and three
 * difficulties, a themed day draws from one small cell of the pool, so running
 * themed every day burns through that cell and repeats within a fortnight.
 * Mixed days draw from every category at that difficulty — six times the
 * candidates — which is what makes the rotation actually cycle.
 *
 * Raise this once each category/difficulty cell holds 20+ questions.
 */
const THEMED_DAY_RATE = 1 / 3;

/**
 * The category featured on a given day, per difficulty, or null for a mixed day.
 *
 * Deterministic from the date, so every player sees the same challenge and the
 * leaderboard compares like with like. Seeding by difficulty as well as date
 * keeps the three tiers on different subjects on any given day.
 */
export function categoryForDay(
  date: string,
  difficulty: Difficulty,
): Category | null {
  const rng = seeded(`ppa-daily:${date}:${difficulty}`);
  if (rng() >= THEMED_DAY_RATE) return null; // mixed
  return CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
}

/**
 * Pick the question ids for a day from a candidate list.
 *
 * Candidates arrive sorted by timesServed ascending, so the least-used
 * questions are preferred — the pool cycles rather than replaying favourites.
 * The shuffle within that is seeded, so the same day always yields the same
 * five, and a re-run of the rotation is idempotent.
 */
export function selectQuestionIds(
  date: string,
  difficulty: Difficulty,
  candidateIds: string[],
  count = QUESTIONS_PER_CHALLENGE,
): string[] {
  if (candidateIds.length <= count) return [...candidateIds];

  // Take the least-served two-thirds, then shuffle deterministically within it.
  const window = Math.max(count, Math.ceil(candidateIds.length * 0.67));
  const pool = candidateIds.slice(0, window);

  const rng = seeded(`ppa-pick:${date}:${difficulty}`);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

/** Short, stable id for a day's challenge in a difficulty. */
export function challengeKey(date: string, difficulty: Difficulty): string {
  return createHash("sha256")
    .update(`ppa-challenge:${date}:${difficulty}`)
    .digest("hex")
    .slice(0, 24);
}

/** Display title for a challenge. A mixed day has no single category. */
export function challengeTitle(
  category: Category | null,
  difficulty: Difficulty,
): string {
  const names: Record<Category, string> = {
    GENERAL: "General Knowledge",
    TECH: "Tech IQ",
    FINANCE: "Money Sense",
    SOCIAL: "Community & Health",
    SPORTS: "Sports Desk",
    POLITICS: "Civics",
  };
  const suffix: Record<Difficulty, string> = {
    EASY: "",
    MEDIUM: " II",
    HARD: " III",
  };
  const base = category ? names[category] : "Daily Mix";
  return base + suffix[difficulty];
}
