/**
 * GET /api/challenges/[id] — a creator challenge, ready to play.
 *
 * ── CORRECT ANSWERS NEVER LEAVE THE SERVER ────────────────────────────────
 *
 * The selects below are explicit and omit `correctAnswer`. This route used to
 * do `include: { questions: true }`, which shipped the whole answer key to the
 * browser before the player answered anything — and the play screen graded
 * each tap against it. Server-side grading in /api/challenges/submit is no
 * defence when the client already holds the answers. If you add a field here,
 * add it by name; never spread the question row.
 *
 * ── A NEW SET EVERY DAY ───────────────────────────────────────────────────
 *
 * When a challenge carries no questions of its own, its set comes from
 * contentQuestionSet(), seeded by content id and UTC date. The old query was
 * `orderBy: { qualityScore: "desc" }, take: 5` — and since every hand-checked
 * question scores 100, that was one enormous tie that returned the same five
 * rows on every request for all time. That is what "the same old questions"
 * was. The set now changes daily and prefers the least-served questions, and
 * the submit route recomputes the same set to check a player answered the one
 * they were served.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contentQuestionSet } from "@/lib/ppa/rotation";

export const dynamic = "force-dynamic";

const PLAYABLE_QUESTION_FIELDS = {
  id: true,
  text: true,
  options: true,
  category: true,
  difficulty: true,
  // correctAnswer is NOT selected. See the note at the top of this file.
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const challenge = await prisma.content.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        category: true,
        type: true,
        status: true,
        endsAt: true,
        participantCount: true,
        createdAt: true,
        creator: { select: { username: true } },
        questions: { select: PLAYABLE_QUESTION_FIELDS },
      },
    });

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    let questions = challenge.questions;

    if (questions.length === 0) {
      const ids = await contentQuestionSet(id, challenge.category);

      if (ids.length === 0) {
        return NextResponse.json({
          challenge: { ...challenge, questions: [] },
          error: "not_enough_questions",
        });
      }

      const rows = await prisma.question.findMany({
        where: { id: { in: ids } },
        select: PLAYABLE_QUESTION_FIELDS,
      });

      // findMany does not honour the order of an `in` list, and the order is
      // part of what makes the set reproducible.
      const byId = new Map(rows.map((q) => [q.id, q]));
      questions = ids
        .map((qid) => byId.get(qid))
        .filter((q): q is NonNullable<typeof q> => Boolean(q));
    }

    return NextResponse.json({ challenge: { ...challenge, questions } });
  } catch (error) {
    console.error("Challenge fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenge" },
      { status: 500 }
    );
  }
}
