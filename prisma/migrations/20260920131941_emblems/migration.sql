-- CreateEnum
CREATE TYPE "Realm" AS ENUM ('THINK', 'PREDICT', 'CREATE', 'COMPETE', 'EXPLORE', 'CONNECT', 'LEAD');

-- CreateTable
CREATE TABLE "Emblem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryRealm" "Realm" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "pioneer" BOOLEAN NOT NULL DEFAULT false,
    "realmLevels" JSONB NOT NULL,
    "realmScores" JSONB NOT NULL,
    "traits" JSONB NOT NULL,
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "tokenId" TEXT,
    "mintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmblemMilestone" (
    "id" TEXT NOT NULL,
    "emblemId" TEXT NOT NULL,
    "realm" "Realm" NOT NULL,
    "level" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmblemMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Emblem_userId_key" ON "Emblem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Emblem_tokenId_key" ON "Emblem"("tokenId");

-- CreateIndex
CREATE INDEX "Emblem_primaryRealm_level_idx" ON "Emblem"("primaryRealm", "level");

-- CreateIndex
CREATE INDEX "Emblem_level_idx" ON "Emblem"("level");

-- CreateIndex
CREATE INDEX "EmblemMilestone_achievedAt_idx" ON "EmblemMilestone"("achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmblemMilestone_emblemId_realm_level_key" ON "EmblemMilestone"("emblemId", "realm", "level");

-- AddForeignKey
ALTER TABLE "Emblem" ADD CONSTRAINT "Emblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmblemMilestone" ADD CONSTRAINT "EmblemMilestone_emblemId_fkey" FOREIGN KEY ("emblemId") REFERENCES "Emblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
