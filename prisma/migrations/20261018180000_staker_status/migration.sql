-- Supporter tiers from Pi Ecosystem Directory Staking.
--
-- One row per user who has opened the Support PPA page with the feature on.
-- A cache of Pi's Staking Data API: nothing here is a balance, and nothing
-- here is ever paid out. See src/lib/ppa/staker.ts for the rules.

CREATE TYPE "StakerTier" AS ENUM ('NONE', 'ZANMI', 'GADYEN', 'POTO_MITAN');

CREATE TABLE "StakerStatus" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "effectiveStake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tier"           "StakerTier" NOT NULL DEFAULT 'NONE',
    "qualifiedAt"    TIMESTAMP(3),
    "checkedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakerStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StakerStatus_userId_key" ON "StakerStatus"("userId");
CREATE INDEX "StakerStatus_tier_idx" ON "StakerStatus"("tier");

-- Account deletion removes the row with the user.
ALTER TABLE "StakerStatus"
    ADD CONSTRAINT "StakerStatus_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
