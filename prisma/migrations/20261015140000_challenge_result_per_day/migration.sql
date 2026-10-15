-- ChallengeResult gains a UTC day.
--
-- Without it, "has this player answered this question?" was an all-time
-- question, which broke two things: the daily route marked a challenge
-- complete because a recycled question had been answered weeks earlier, and
-- `skipDuplicates` did nothing because there was no unique constraint for it
-- to skip against.

ALTER TABLE "ChallengeResult" ADD COLUMN "day" DATE;

-- Existing rows keep the day they were actually answered.
UPDATE "ChallengeResult"
   SET "day" = ("createdAt" AT TIME ZONE 'UTC')::date
 WHERE "day" IS NULL;

ALTER TABLE "ChallengeResult" ALTER COLUMN "day" SET NOT NULL;

-- Deliberately NOT preceded by a de-duplicating DELETE. These rows are a
-- player's record of what they answered and what they were paid for it. If
-- this index fails, there are real duplicates to go and look at — not rows to
-- throw away to make a migration pass.
CREATE UNIQUE INDEX "ChallengeResult_userId_questionId_day_key"
    ON "ChallengeResult"("userId", "questionId", "day");

CREATE INDEX "ChallengeResult_userId_day_idx"
    ON "ChallengeResult"("userId", "day");
