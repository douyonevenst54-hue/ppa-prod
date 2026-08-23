/*
  Warnings:

  - A unique constraint covering the columns `[userId,contentId]` on the table `Prediction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_userId_contentId_key" ON "Prediction"("userId", "contentId");
