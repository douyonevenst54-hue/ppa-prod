import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const challenge = await prisma.content.findUnique({
      where: { id },
      include: {
        questions: true,
        creator: { select: { username: true } },
      },
    });

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    let questions = challenge.questions;

    // If challenge has no questions, pull from question bank
    if (questions.length === 0) {
      const bankQuestions = await prisma.question.findMany({
        where: {
          contentId: null,
          category: challenge.category as never,
        },
        orderBy: { qualityScore: "desc" },
        take: 5,
      });

      // If not enough in category, fill with general questions
      if (bankQuestions.length < 5) {
        const generalQuestions = await prisma.question.findMany({
          where: {
            contentId: null,
            category: "GENERAL",
            id: { notIn: bankQuestions.map(q => q.id) },
          },
          orderBy: { qualityScore: "desc" },
          take: 5 - bankQuestions.length,
        });
        questions = [...bankQuestions, ...generalQuestions];
      } else {
        questions = bankQuestions;
      }

      // Shuffle questions
      questions = questions.sort(() => Math.random() - 0.5);
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