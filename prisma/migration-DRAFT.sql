-- =============================================================================
-- Migration: add_mandate_layer_and_ledger_chain
--
-- This migration is ADDITIVE and SAFE. It:
--   1. Adds new columns to PPATransaction (all nullable, no defaults required).
--   2. Adds an apiKeyHash column to PPAApp (nullable, transitional).
--   3. Creates four new tables (UserSigningKey, AgentMandate, MandateNonce, AgentAudit).
--   4. Creates two new enums (MandateStatus, AgentAuditEvent).
--
-- It does NOT:
--   - Drop any columns
--   - Make any existing columns NOT NULL
--   - Move or transform any existing data
--   - Touch User, Content, Prediction, PollOption, PollVote, Question,
--     ChallengeResult, EcosystemTransaction
--
-- Snapshot row generation for existing users is performed by a separate
-- script (see ledger-backfill.ts) AFTER this migration is applied. That
-- script is idempotent and safe to run multiple times.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. Augment PPATransaction with ledger fields.
-- ----------------------------------------------------------------------------

ALTER TABLE "PPATransaction"
  ADD COLUMN "balanceAfter"   INTEGER,
  ADD COLUMN "prevHash"       TEXT,
  ADD COLUMN "rowHash"        TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "isSnapshot"     BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "PPATransaction_rowHash_key"        ON "PPATransaction" ("rowHash");
CREATE UNIQUE INDEX "PPATransaction_idempotencyKey_key" ON "PPATransaction" ("idempotencyKey");
CREATE INDEX        "PPATransaction_userId_createdAt_idx"  ON "PPATransaction" ("userId", "createdAt");
CREATE INDEX        "PPATransaction_userId_isSnapshot_idx" ON "PPATransaction" ("userId", "isSnapshot");


-- ----------------------------------------------------------------------------
-- 2. Add apiKeyHash to PPAApp (nullable during transition).
-- ----------------------------------------------------------------------------

ALTER TABLE "PPAApp"
  ADD COLUMN "apiKeyHash" TEXT;

CREATE UNIQUE INDEX "PPAApp_apiKeyHash_key" ON "PPAApp" ("apiKeyHash");


-- ----------------------------------------------------------------------------
-- 3. Enums for mandate lifecycle and audit events.
-- ----------------------------------------------------------------------------

CREATE TYPE "MandateStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED');

CREATE TYPE "AgentAuditEvent" AS ENUM (
  'MANDATE_ISSUED',
  'MANDATE_REVOKED',
  'NONCE_ISSUED',
  'PAYMENT_VERIFIED',
  'PAYMENT_SETTLED',
  'PAYMENT_REJECTED',
  'CAP_HIT',
  'RATE_LIMIT_HIT'
);


-- ----------------------------------------------------------------------------
-- 4. UserSigningKey
-- ----------------------------------------------------------------------------

CREATE TABLE "UserSigningKey" (
  "id"        TEXT PRIMARY KEY,
  "piUserId"  TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "label"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3)
);

CREATE INDEX "UserSigningKey_piUserId_idx"           ON "UserSigningKey" ("piUserId");
CREATE INDEX "UserSigningKey_piUserId_revokedAt_idx" ON "UserSigningKey" ("piUserId", "revokedAt");


-- ----------------------------------------------------------------------------
-- 5. AgentMandate
-- ----------------------------------------------------------------------------

CREATE TABLE "AgentMandate" (
  "id"            TEXT PRIMARY KEY,
  "piUserId"      TEXT NOT NULL,
  "agentId"       TEXT NOT NULL,
  "appId"         TEXT NOT NULL,
  "scope"         JSONB NOT NULL,
  "cap"           INTEGER NOT NULL,
  "spent"         INTEGER NOT NULL DEFAULT 0,
  "perTxCap"      INTEGER,
  "rateLimit"     JSONB,
  "notBefore"     TIMESTAMP(3) NOT NULL,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "status"        "MandateStatus" NOT NULL DEFAULT 'ACTIVE',
  "signature"     TEXT NOT NULL,
  "signingKeyId"  TEXT NOT NULL,
  "nonceSalt"     TEXT NOT NULL,
  "issuedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"     TIMESTAMP(3),
  "revokedReason" TEXT,

  CONSTRAINT "AgentMandate_signingKeyId_fkey"
    FOREIGN KEY ("signingKeyId") REFERENCES "UserSigningKey" ("id"),
  CONSTRAINT "AgentMandate_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "PPAApp" ("id")
);

CREATE INDEX "AgentMandate_piUserId_status_idx" ON "AgentMandate" ("piUserId", "status");
CREATE INDEX "AgentMandate_appId_status_idx"    ON "AgentMandate" ("appId", "status");
CREATE INDEX "AgentMandate_expiresAt_idx"       ON "AgentMandate" ("expiresAt");


-- ----------------------------------------------------------------------------
-- 6. MandateNonce
-- ----------------------------------------------------------------------------

CREATE TABLE "MandateNonce" (
  "id"          TEXT PRIMARY KEY,
  "mandateId"   TEXT NOT NULL,
  "nonce"       TEXT NOT NULL,
  "actionHash"  TEXT NOT NULL,
  "amount"      INTEGER NOT NULL,
  "consumed"    BOOLEAN NOT NULL DEFAULT false,
  "consumedAt"  TIMESTAMP(3),
  "piPaymentId" TEXT,
  "issuedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MandateNonce_mandateId_fkey"
    FOREIGN KEY ("mandateId") REFERENCES "AgentMandate" ("id")
);

CREATE UNIQUE INDEX "MandateNonce_nonce_key"            ON "MandateNonce" ("nonce");
CREATE INDEX        "MandateNonce_mandateId_consumed_idx" ON "MandateNonce" ("mandateId", "consumed");
CREATE INDEX        "MandateNonce_expiresAt_idx"          ON "MandateNonce" ("expiresAt");


-- ----------------------------------------------------------------------------
-- 7. AgentAudit
-- ----------------------------------------------------------------------------

CREATE TABLE "AgentAudit" (
  "id"        TEXT PRIMARY KEY,
  "mandateId" TEXT,
  "piUserId"  TEXT NOT NULL,
  "agentId"   TEXT NOT NULL,
  "appId"     TEXT NOT NULL,
  "eventType" "AgentAuditEvent" NOT NULL,
  "payload"   JSONB NOT NULL,
  "prevHash"  TEXT NOT NULL,
  "rowHash"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgentAudit_mandateId_fkey"
    FOREIGN KEY ("mandateId") REFERENCES "AgentMandate" ("id")
);

CREATE UNIQUE INDEX "AgentAudit_rowHash_key"            ON "AgentAudit" ("rowHash");
CREATE INDEX        "AgentAudit_piUserId_createdAt_idx" ON "AgentAudit" ("piUserId", "createdAt");
CREATE INDEX        "AgentAudit_mandateId_idx"          ON "AgentAudit" ("mandateId");
