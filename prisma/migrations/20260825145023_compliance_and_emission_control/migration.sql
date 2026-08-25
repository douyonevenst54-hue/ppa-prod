-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageAttestedAt" TIMESTAMP(3),
ADD COLUMN     "ageAttestedMin" INTEGER,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "leaderboardOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TopUp" (
    "id" TEXT NOT NULL,
    "piPaymentId" TEXT NOT NULL,
    "piTxid" TEXT,
    "userId" TEXT NOT NULL,
    "amountPi" DECIMAL(18,8) NOT NULL,
    "ppaAmount" INTEGER NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDailyEmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "emitted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserDailyEmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEmission" (
    "day" DATE NOT NULL,
    "emitted" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyEmission_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "RedemptionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userAgent" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedemptionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopUp_piPaymentId_key" ON "TopUp"("piPaymentId");

-- CreateIndex
CREATE INDEX "TopUp_userId_createdAt_idx" ON "TopUp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TopUp_status_idx" ON "TopUp"("status");

-- CreateIndex
CREATE INDEX "UserDailyEmission_day_idx" ON "UserDailyEmission"("day");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyEmission_userId_day_source_key" ON "UserDailyEmission"("userId", "day", "source");

-- CreateIndex
CREATE INDEX "RedemptionAttempt_attemptedAt_idx" ON "RedemptionAttempt"("attemptedAt");

-- CreateIndex
CREATE INDEX "User_deletedAt_leaderboardOptOut_idx" ON "User"("deletedAt", "leaderboardOptOut");

-- CreateIndex
CREATE INDEX "User_totalPredictions_idx" ON "User"("totalPredictions");

-- CreateIndex
CREATE INDEX "User_reputationScore_idx" ON "User"("reputationScore");

-- AddForeignKey
ALTER TABLE "TopUp" ADD CONSTRAINT "TopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailyEmission" ADD CONSTRAINT "UserDailyEmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionAttempt" ADD CONSTRAINT "RedemptionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
