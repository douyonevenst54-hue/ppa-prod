/*
  Warnings:

  - You are about to drop the column `userId` on the `UserDailyEmission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[piUserId,day,source]` on the table `UserDailyEmission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `piUserId` to the `UserDailyEmission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserDailyEmission" DROP CONSTRAINT "UserDailyEmission_userId_fkey";

-- DropIndex
DROP INDEX "UserDailyEmission_userId_day_source_key";

-- AlterTable
ALTER TABLE "PPAApp" ADD COLUMN     "dailyEmissionCap" INTEGER;

-- AlterTable
ALTER TABLE "UserDailyEmission" DROP COLUMN "userId",
ADD COLUMN     "piUserId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AppDailyEmission" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "emitted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppDailyEmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppDailyEmission_day_idx" ON "AppDailyEmission"("day");

-- CreateIndex
CREATE UNIQUE INDEX "AppDailyEmission_appId_day_key" ON "AppDailyEmission"("appId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyEmission_piUserId_day_source_key" ON "UserDailyEmission"("piUserId", "day", "source");

-- AddForeignKey
ALTER TABLE "AppDailyEmission" ADD CONSTRAINT "AppDailyEmission_appId_fkey" FOREIGN KEY ("appId") REFERENCES "PPAApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
