-- Separate "how often was this question put in front of players" from
-- "how often did someone answer it".
--
-- Question.timesServed was only ever incremented in the submit route, once
-- per player per answer. So it measured answers, under a name the rotation
-- trusted to mean servings. Two consequences:
--
--   1. A tier nobody played kept its counters at zero, so the round-robin saw
--      every question as unused and the next day's draw was independent of
--      the last. Measured over 30 simulated days: the same question could
--      return the very next day, the average gap between repeats was 7.3 days
--      instead of 14.6, and only 62 of 78 questions were ever used.
--
--   2. With many players the number would climb by one per answer, so a
--      question served once to a hundred people would outrank a question
--      served ten times to nobody.
--
-- timesServed now counts days served and is written when a daily challenge is
-- created. timesAnswered takes over the old meaning, and is what timesCorrect
-- should be divided by.

ALTER TABLE "Question" ADD COLUMN "timesAnswered" INTEGER NOT NULL DEFAULT 0;

-- Every existing increment was an answer, so the old column's value is
-- exactly the new column's history. Copy it rather than starting from zero.
UPDATE "Question" SET "timesAnswered" = "timesServed";

-- timesServed is left as it stands. It understates how often each question
-- has been served, but it is a lower bound rather than a wrong kind of
-- number, and it corrects itself as the rotation runs from here.
