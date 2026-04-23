import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_PI_USERIDS = ["douyonevenst54"]; // Add your Pi username

export async function POST(req: NextRequest) {
  try {
    const { userId, contentId, correctAnswer } = await req.json();

    // Verify admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !ADMIN_PI_USERIDS.includes(user.username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get prediction content
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { predictions: true },
    });

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (content.status === "RESOLVED") {
      return NextResponse.json({ error: "Already resolved" }, { status: 400 });
    }

    // Mark content as resolved
    await prisma.content.update({
      where: { id: contentId },
      data: { status: "RESOLVED" },
    });

    // Process each prediction
    let winnersCount = 0;
    let totalPaid = 0;

    for (const prediction of content.predictions) {
      const isCorrect = prediction.answer === correctAnswer;

      await prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          isCorrect,
          ppaEarned: isCorrect ? prediction.potentialReward : 0,
        },
      });

      if (isCorrect) {
        // Award PPA to winner
        await prisma.user.update({
          where: { id: prediction.userId },
          data: { ppaBalance: { increment: prediction.potentialReward } },
        });

        await prisma.pPATransaction.create({
          data: {
            userId: prediction.userId,
            amount: prediction.potentialReward,
            type: "earn",
            source: `prediction_correct_${contentId}`,
          },
        });

        winnersCount++;
        totalPaid += prediction.potentialReward;
      }

      // Update user accuracy
      const predUser = await prisma.user.findUnique({
        where: { id: prediction.userId },
      });

      if (predUser) {
        const newCorrect = predUser.correctPredictions + (isCorrect ? 1 : 0);
        const newTotal = predUser.totalPredictions + 1;
        await prisma.user.update({
          where: { id: prediction.userId },
          data: {
            correctPredictions: newCorrect,
            totalPredictions: newTotal,
            accuracyRate: newCorrect / newTotal,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      contentId,
      correctAnswer,
      totalPredictions: content.predictions.length,
      winnersCount,
      totalPaid,
    });

  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve prediction" },
      { status: 500 }
    );
  }
}