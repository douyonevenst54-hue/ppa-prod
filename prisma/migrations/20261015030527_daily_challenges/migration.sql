-- CreateTable
CREATE TABLE "DailyChallenge" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "category" "Category" NOT NULL,
    "title" TEXT NOT NULL,
    "questionIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyChallenge_day_idx" ON "DailyChallenge"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallenge_day_difficulty_key" ON "DailyChallenge"("day", "difficulty");
