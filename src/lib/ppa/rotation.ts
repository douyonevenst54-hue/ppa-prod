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
  challengeTitle,
  utcDateKey,
  QUESTIONS_PER_CHALLENGE,
} from "./daily-challenge";

function utcDayStart(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export interface DailySet {
  difficulty: Difficulty;
  category: string;
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
        category: category as never,
        difficulty: difficulty as never,
        // Quarantined questions (qualityScore -1) stay in the table as history
        // but never reach a player. This is what makes the audit's
        // --quarantine flag mean something.
        qualityScore: { gte: 0 },
      },
      orderBy: [{ timesServed: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    if (candidates.length < QUESTIONS_PER_CHALLENGE) {
      console.warn(
        `[rotation] ${category}/${difficulty} has only ${candidates.length} questions — skipping`,
      );
      continue;
    }

    const questionIds = selectQuestionIds(
      key,
      difficulty,
      candidates.map((c) => c.id),
    );
    const title = challengeTitle(category as never, difficulty);

    try {
      const created = await prisma.dailyChallenge.create({
        data: {
          day,
          difficulty: difficulty as never,
          category: category as never,
          title,
          questionIds: questionIds as Prisma.InputJsonValue,
        },
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
