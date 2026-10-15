/**
 * GET /api/challenges/daily
 *
 * Today's challenges, with the tiers this user has unlocked.
 *
 * ── CORRECT ANSWERS NEVER LEAVE THE SERVER ────────────────────────────────
 *
 * The select below is explicit and deliberately omits `correctAnswer`. Sending
 * it would put the answers in the player's network tab before they submit,
 * which would make the server-side scoring in /api/challenges/submit
 * decorative. If you ever add a field here, add it by name — never spread the
 * whole question row.
 *
 * ── REPUTATION GATES ACCESS, NOTHING ELSE ─────────────────────────────────
 *
 * Locked tiers are returned too, with what they require, because a visible
 * locked door is the point — it tells a player what the next thing to earn is.
 * The questions for a locked tier are not included.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureDailyChallenges } from "@/lib/ppa/rotation";
import {
  tierStatus,
  unlockedDifficulties,
  SECONDS_PER_QUESTION,
  utcDateKey,
} from "@/lib/ppa/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { reputationScore: true },
  });

  const reputation = user.reputationScore;
  const unlocked = new Set(unlockedDifficulties(reputation));
  const sets = await ensureDailyChallenges();

  // Which of today's challenges has this user already completed? A completed
  // challenge is one where they have a result for every question in it.
  const allIds = sets.flatMap((s) => s.questionIds);
  const answered = await prisma.challengeResult.findMany({
    where: { userId: session.id, questionId: { in: allIds } },
    select: { questionId: true },
  });
  const answeredIds = new Set(answered.map((a) => a.questionId));

  const questions = await prisma.question.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      text: true,
      options: true,
      category: true,
      difficulty: true,
      // correctAnswer is NOT selected. See the note at the top of this file.
    },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  const challenges = sets.map((set) => {
    const isUnlocked = unlocked.has(set.difficulty);
    const completed = set.questionIds.every((id) => answeredIds.has(id));

    return {
      difficulty: set.difficulty,
      category: set.category,
      title: set.title,
      questionCount: set.questionIds.length,
      secondsPerQuestion: SECONDS_PER_QUESTION,
      unlocked: isUnlocked,
      completed: isUnlocked ? completed : false,
      // Questions only for unlocked tiers.
      questions: isUnlocked
        ? set.questionIds
            .map((id) => byId.get(id))
            .filter((q): q is NonNullable<typeof q> => Boolean(q))
        : [],
    };
  });

  return NextResponse.json({
    date: utcDateKey(),
    reputation: Number(reputation.toFixed(1)),
    tiers: tierStatus(reputation),
    challenges,
  });
}
