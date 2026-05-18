-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('NEWCOMER', 'MEMBER', 'TRUSTED', 'EXPERT', 'ELITE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'ACTIVE', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SPORTS', 'FINANCE', 'TECH', 'POLITICS', 'SOCIAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentAuditEvent" AS ENUM ('MANDATE_ISSUED', 'MANDATE_REVOKED', 'NONCE_ISSUED', 'PAYMENT_VERIFIED', 'PAYMENT_SETTLED', 'PAYMENT_REJECTED', 'CAP_HIT', 'RATE_LIMIT_HIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "piUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ppaBalance" INTEGER NOT NULL DEFAULT 100,
    "accuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "lastStreakDate" TIMESTAMP(3),
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "tier" "UserTier" NOT NULL DEFAULT 'NEWCOMER',
    "totalPredictions" INTEGER NOT NULL DEFAULT 0,
    "correctPredictions" INTEGER NOT NULL DEFAULT 0,
    "totalChallenges" INTEGER NOT NULL DEFAULT 0,
    "correctChallenges" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "rewardPool" INTEGER NOT NULL DEFAULT 0,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidenceLevel" INTEGER NOT NULL,
    "stakeAmount" INTEGER NOT NULL,
    "potentialReward" INTEGER NOT NULL,
    "isCorrect" BOOLEAN,
    "ppaEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pollOptionId" TEXT NOT NULL,
    "ppaWeight" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "contentId" TEXT,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "timesServed" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSeconds" INTEGER NOT NULL,
    "ppaEarned" INTEGER NOT NULL DEFAULT 0,
    "streakBonus" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PPATransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balanceAfter" INTEGER,
    "prevHash" TEXT,
    "rowHash" TEXT,
    "idempotencyKey" TEXT,
    "isSnapshot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PPATransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PPAApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "logoUrl" TEXT,
    "apiKey" TEXT NOT NULL,
    "apiKeyHash" TEXT,
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PPAApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcosystemTransaction" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "piUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcosystemTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSigningKey" (
    "id" TEXT NOT NULL,
    "piUserId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMandate" (
    "id" TEXT NOT NULL,
    "piUserId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "cap" INTEGER NOT NULL,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "perTxCap" INTEGER,
    "rateLimit" JSONB,
    "notBefore" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'ACTIVE',
    "signature" TEXT NOT NULL,
    "signingKeyId" TEXT NOT NULL,
    "nonceSalt" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "AgentMandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandateNonce" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "actionHash" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "piPaymentId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MandateNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAudit" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT,
    "piUserId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "eventType" "AgentAuditEvent" NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_piUserId_key" ON "User"("piUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_userId_pollOptionId_key" ON "PollVote"("userId", "pollOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PPATransaction_rowHash_key" ON "PPATransaction"("rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "PPATransaction_idempotencyKey_key" ON "PPATransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PPATransaction_userId_createdAt_idx" ON "PPATransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PPATransaction_userId_isSnapshot_idx" ON "PPATransaction"("userId", "isSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "PPAApp_slug_key" ON "PPAApp"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PPAApp_apiKey_key" ON "PPAApp"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "PPAApp_apiKeyHash_key" ON "PPAApp"("apiKeyHash");

-- CreateIndex
CREATE INDEX "UserSigningKey_piUserId_idx" ON "UserSigningKey"("piUserId");

-- CreateIndex
CREATE INDEX "UserSigningKey_piUserId_revokedAt_idx" ON "UserSigningKey"("piUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "AgentMandate_piUserId_status_idx" ON "AgentMandate"("piUserId", "status");

-- CreateIndex
CREATE INDEX "AgentMandate_appId_status_idx" ON "AgentMandate"("appId", "status");

-- CreateIndex
CREATE INDEX "AgentMandate_expiresAt_idx" ON "AgentMandate"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MandateNonce_nonce_key" ON "MandateNonce"("nonce");

-- CreateIndex
CREATE INDEX "MandateNonce_mandateId_consumed_idx" ON "MandateNonce"("mandateId", "consumed");

-- CreateIndex
CREATE INDEX "MandateNonce_expiresAt_idx" ON "MandateNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAudit_rowHash_key" ON "AgentAudit"("rowHash");

-- CreateIndex
CREATE INDEX "AgentAudit_piUserId_createdAt_idx" ON "AgentAudit"("piUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAudit_mandateId_idx" ON "AgentAudit"("mandateId");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollOptionId_fkey" FOREIGN KEY ("pollOptionId") REFERENCES "PollOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PPATransaction" ADD CONSTRAINT "PPATransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemTransaction" ADD CONSTRAINT "EcosystemTransaction_appId_fkey" FOREIGN KEY ("appId") REFERENCES "PPAApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_signingKeyId_fkey" FOREIGN KEY ("signingKeyId") REFERENCES "UserSigningKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_appId_fkey" FOREIGN KEY ("appId") REFERENCES "PPAApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateNonce" ADD CONSTRAINT "MandateNonce_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "AgentMandate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAudit" ADD CONSTRAINT "AgentAudit_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "AgentMandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
