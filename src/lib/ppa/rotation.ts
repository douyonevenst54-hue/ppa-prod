/**
 * Daily challenge rotation.
 *
 * Ensures a DailyChallenge row exists for each difficulty on a given UTC day,
 * selecting questions from the pool. Idempotent and safe to call from anywhere
 * — the unique constraint on [day, difficulty] means concurrent callers settle
 * on one row, and the selection is deterministic so they'd pick the same
 * questions anyway.
 *
 * Called lazily by the daily-challenge route (so the app is never waiting on a
 * cron that didn't fire) and eagerly by the cron (so the first player of the
 * day doesn't pay for the selection).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DIFFICULTIES,
  Difficulty,
  categoryForDay,
  selectQuestionIds,
  pickFromCandidates,
  challengeTitle,
  utcDateKey,
  QUESTIONS_PER_CHALLENGE,
} from "./daily-challenge";

export function utcDayStart(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * The question set for a creator challenge that carries no questions of its own.
 *
 * Deterministic from (contentId, UTC date): stable for the whole day, so the
 * submit route can recompute it and confirm a player answered the set they were
 * served, and different tomorrow — which is the actual fix for "the same old
 * questions". The old query was `orderBy: { qualityScore: "desc" }, take: 5`,
 * and since every hand-checked question scores 100 that was one giant tie that
 * returned the same five rows on every request, forever.
 *
 * Returns [] when the category has too few live questions to fill a challenge;
 * the caller decides what to show rather than serving a short set.
 */
export async function contentQuestionSet(
  contentId: string,
  category: string,
  date = new Date(),
): Promise<string[]> {
  const candidates = await prisma.question.findMany({
    where: {
      contentId: null,
      category: category as never,
      qualityScore: { gte: 0 },
    },
    orderBy: [{ timesServed: "asc" }, { id: "asc" }],
    select: { id: true, timesServed: true },
  });

  if (candidates.length < QUESTIONS_PER_CHALLENGE) return [];

  return pickFromCandidates(
    `ppa-content:${contentId}:${utcDateKey(date)}`,
    candidates,
  );
}

export interface DailySet {
  difficulty: Difficulty;
  /** Null on a mixed day. */
  category: string | null;
  title: string;
  questionIds: string[];
}

/**
 * Build (or fetch) today's challenges.
 *
 * Returns one entry per difficulty. A difficulty is skipped only if the pool
 * has no questions for the chosen category at that level — which the seeder
 * prevents, but the rotation shouldn't crash on.
 */
export async function ensureDailyChallenges(
  date = new Date(),
): Promise<DailySet[]> {
  const day = utcDayStart(date);
  const key = utcDateKey(date);

  const existing = await prisma.dailyChallenge.findMany({
    where: { day },
  });

  const byDifficulty = new Map(existing.map((c) => [c.difficulty, c]));
  const out: DailySet[] = [];

  for (const difficulty of DIFFICULTIES) {
    const found = byDifficulty.get(difficulty);
    if (found) {
      out.push({
        difficulty,
        category: found.category,
        title: found.title,
        questionIds: found.questionIds as string[],
      });
      continue;
    }

    const category = categoryForDay(key, difficulty);

    const candidates = await prisma.question.findMany({
      where: {
        // A mixed day (category === null) draws from every category at this
        // difficulty, so the filter is OMITTED rather than set to null.
        // Prisma reads `category: null` as IS NULL, which matches no rows —
        // that silently skipped two days in three.
        ...(category ? { category: category as never } : {}),
        difficulty: difficulty as never,
        // Curated pool only — questions that belong to no Content row.
        //
        // This filter was missing, and contentQuestionSet() two functions up
        // has always had it. Without it the official daily set could draw
        // from any question attached to a Content row: the demo challenges in
        // seed.ts, and anything a player publishes through the creator hub,
        // which POST /api/challenges writes with qualityScore 7. A player
        // could therefore put questions of their own choosing — with answers
        // they already know — into the challenge everyone is ranked on.
        contentId: null,
        // Quarantined questions (qualityScore -1) stay in the table as history
        // but never reach a player. This is what makes the audit's
        // --quarantine flag mean something.
        qualityScore: { gte: 0 },
      },
      orderBy: [{ timesServed: "asc" }, { id: "asc" }],
      select: { id: true, timesServed: true },
    });

    if (candidates.length < QUESTIONS_PER_CHALLENGE) {
      console.warn(
        `[rotation] ${category ?? "mixed"}/${difficulty} has only ${candidates.length} questions — skipping`,
      );
      continue;
    }

    const questionIds = selectQuestionIds(key, difficulty, candidates);
    const title = challengeTitle(category, difficulty);

    try {
      const created = await prisma.dailyChallenge.create({
        data: {
          day,
          difficulty: difficulty as never,
          category: (category ?? null) as never,
          title,
          questionIds: questionIds as Prisma.InputJsonValue,
        },
      });
      // The day's set now exists, so these questions have been served. This is
      // the only place that advances the counter the rotation sorts on, and it
      // runs once per difficulty per day because [day, difficulty] is unique —
      // the P2002 branch below deliberately does NOT increment, since whoever
      // won the race already did.
      //
      // Doing it here rather than on submission is what makes "new questions
      // every day" true for a tier nobody plays.
      await prisma.question.updateMany({
        where: { id: { in: questionIds } },
        data: { timesServed: { increment: 1 } },
      });

      out.push({
        difficulty,
        category: created.category,
        title: created.title,
        questionIds,
      });
    } catch (err) {
      // Another request won the race on [day, difficulty]. Read theirs — the
      // selection is deterministic, so it holds the same questions.
      if ((err as { code?: string })?.code === "P2002") {
        const winner = await prisma.dailyChallenge.findUnique({
          where: { day_difficulty: { day, difficulty: difficulty as never } },
        });
        if (winner) {
          out.push({
            difficulty,
            category: winner.category,
            title: winner.title,
            questionIds: winner.questionIds as string[],
          });
        }
        continue;
      }
      throw err;
    }
  }

  return out;
}
