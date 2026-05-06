/**
 * Zod schemas for PPA agentic-payment mandates.
 *
 * Two layers:
 *   1. The Mandate object itself — the signed, scoped permission slip a user
 *      grants to an agent.
 *   2. The Verifier request — what a member app (LoPiPo, future marketplace)
 *      sends to /api/registry/verify before completing a Pi payment.
 *
 * Money: every monetary amount is a decimal STRING. We never carry numbers
 * across the API boundary or into the canonical payload — see
 * canonical.ts for why.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Decimal amount as string. Up to 8 fractional digits to match Prisma Decimal(20,8). */
export const DecimalString = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/, {
    message: "must be a non-negative decimal string with up to 8 fractional digits, no leading zeros",
  });

/** A non-negative decimal that is also strictly greater than zero. */
export const PositiveDecimalString = DecimalString.refine(
  (s) => s !== "0" && !/^0\.0+$/.test(s),
  { message: "must be greater than zero" },
);

/** Hex string of an exact byte length. */
const hexBytes = (bytes: number) =>
  z
    .string()
    .regex(new RegExp(`^[0-9a-f]{${bytes * 2}}$`), {
      message: `must be ${bytes * 2} lowercase hex characters`,
    });

/** 32 bytes = 256 bits, used for nonces and hashes. */
export const Hex32 = hexBytes(32);
/** 16 bytes for client-supplied per-request nonces. */
export const Hex16 = hexBytes(16);

/** ISO-8601 datetime with timezone. We require the timezone to avoid ambiguity. */
export const IsoDateTime = z.iso.datetime({ offset: true });

/** CUID-shaped IDs (Prisma cuid()). */
export const CuidId = z.string().regex(/^c[a-z0-9]{20,}$/, {
  message: "must be a cuid",
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/**
 * The set of actions an agent can perform under a mandate.
 * Adding a new action type is a breaking change to existing mandates — bump
 * MANDATE_VERSION when you do.
 */
export const ActionType = z.enum([
  "POLL_ENTRY",
  "CHALLENGE_ENTRY",
  "PREDICTION",
  "SPIN_WHEEL",
  "MARKETPLACE_PURCHASE",
]);
export type ActionType = z.infer<typeof ActionType>;

export const Scope = z
  .object({
    appIds: z.array(z.string().min(1)).min(1, "at least one appId required"),
    actions: z.array(ActionType).min(1, "at least one action required"),
    targetWhitelist: z.array(z.string()).optional(),
    targetBlacklist: z.array(z.string()).optional(),
  })
  .refine(
    (s) => {
      // Whitelist and blacklist are mutually exclusive — having both is almost
      // always a logic bug and makes verifier behavior ambiguous.
      return !(s.targetWhitelist && s.targetBlacklist);
    },
    { message: "targetWhitelist and targetBlacklist are mutually exclusive" },
  )
  .refine(
    (s) => new Set(s.appIds).size === s.appIds.length,
    { message: "appIds must be unique" },
  )
  .refine(
    (s) => new Set(s.actions).size === s.actions.length,
    { message: "actions must be unique" },
  );

export type Scope = z.infer<typeof Scope>;

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

export const RateLimit = z.object({
  windowSeconds: z.int().positive().max(86_400 * 7, "max window is 7 days"),
  maxTx: z.int().positive().max(100_000),
});
export type RateLimit = z.infer<typeof RateLimit>;

// ---------------------------------------------------------------------------
// Mandate version
// ---------------------------------------------------------------------------

/**
 * Bump this when the canonical signing payload structure changes.
 * Verifiers must reject mandates with versions they do not understand.
 */
export const MANDATE_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Mandate body — the canonical signing payload
// ---------------------------------------------------------------------------

/**
 * The exact object that gets canonicalized and signed. Field names and types
 * here are part of the wire format. Do not change without bumping
 * MANDATE_VERSION.
 *
 * NOTE: every monetary field is a string (DecimalString) and every timestamp
 * is an ISO string. This is intentional — see canonical.ts.
 */
export const MandateBody = z.object({
  v: z.literal(MANDATE_VERSION),
  userId: z.string().min(1),
  agentId: z.string().min(1),
  scope: Scope,
  cap: PositiveDecimalString,
  perTxCap: PositiveDecimalString.nullable(),
  rateLimit: RateLimit.nullable(),
  notBefore: IsoDateTime,
  expiresAt: IsoDateTime,
  nonceSalt: Hex32,
}).refine(
  (m) => new Date(m.notBefore).getTime() < new Date(m.expiresAt).getTime(),
  { message: "expiresAt must be strictly after notBefore" },
).refine(
  (m) => {
    if (!m.perTxCap) return true;
    return cmpDecimal(m.perTxCap, m.cap) <= 0;
  },
  { message: "perTxCap cannot exceed cap" },
);

export type MandateBody = z.infer<typeof MandateBody>;

// ---------------------------------------------------------------------------
// Signed mandate envelope — what gets POSTed to /api/registry/mandates
// ---------------------------------------------------------------------------

export const SignedMandate = z.object({
  body: MandateBody,
  signature: z.string().regex(/^[A-Za-z0-9+/]+=*$/, "must be base64"),
  signingKeyId: CuidId,
});
export type SignedMandate = z.infer<typeof SignedMandate>;

// ---------------------------------------------------------------------------
// Verifier request — sent by member apps before settlement
// ---------------------------------------------------------------------------

export const VerifyRequest = z.object({
  mandateId: CuidId,
  appApiKey: z.string().min(32, "api key must be at least 32 chars"),
  agentId: z.string().min(1),
  action: ActionType,
  amount: PositiveDecimalString,
  targetId: z.string().min(1),
  clientNonce: Hex16,
});
export type VerifyRequest = z.infer<typeof VerifyRequest>;

export const VerifyResponseOk = z.object({
  ok: z.literal(true),
  nonce: Hex32,
  actionHash: Hex32,
  expiresAt: IsoDateTime,
  latencyMs: z.int().nonnegative(),
});

/** Stable, machine-readable rejection codes. Order them by check sequence. */
export const RejectCode = z.enum([
  "APP_AUTH_FAILED",
  "MANDATE_NOT_FOUND",
  "MANDATE_INACTIVE",
  "NOT_YET_VALID",
  "EXPIRED",
  "SIGNING_KEY_REVOKED",
  "BAD_SIGNATURE",
  "AGENT_MISMATCH",
  "APP_NOT_IN_SCOPE",
  "ACTION_NOT_ALLOWED",
  "TARGET_BLACKLISTED",
  "TARGET_NOT_WHITELISTED",
  "PER_TX_CAP_EXCEEDED",
  "CAP_EXCEEDED",
  "RATE_LIMITED",
  "VERSION_UNSUPPORTED",
]);
export type RejectCode = z.infer<typeof RejectCode>;

export const VerifyResponseRejected = z.object({
  ok: z.literal(false),
  code: RejectCode,
});

export const VerifyResponse = z.discriminatedUnion("ok", [
  VerifyResponseOk,
  VerifyResponseRejected,
]);
export type VerifyResponse = z.infer<typeof VerifyResponse>;

// ---------------------------------------------------------------------------
// Consume request — sent by member apps after Pi settlement
// ---------------------------------------------------------------------------

export const ConsumeRequest = z.object({
  nonce: Hex32,
  appApiKey: z.string().min(32),
  piPaymentId: z.string().min(1),
});
export type ConsumeRequest = z.infer<typeof ConsumeRequest>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compare two non-negative decimal strings without floating-point conversion.
 * Returns -1 if a<b, 0 if a==b, 1 if a>b.
 */
export function cmpDecimal(a: string, b: string): -1 | 0 | 1 {
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  // Strip leading zeros from integer parts (already validated as non-leading
  // by DecimalString, but be defensive).
  const an = ai.replace(/^0+(?=\d)/, "");
  const bn = bi.replace(/^0+(?=\d)/, "");

  if (an.length !== bn.length) return an.length < bn.length ? -1 : 1;
  if (an !== bn) return an < bn ? -1 : 1;

  // Pad fractional parts to equal length and compare lexically.
  const len = Math.max(af.length, bf.length);
  const ap = af.padEnd(len, "0");
  const bp = bf.padEnd(len, "0");
  if (ap === bp) return 0;
  return ap < bp ? -1 : 1;
}

/** Add two non-negative decimal strings exactly. Up to 8 fractional digits. */
export function addDecimal(a: string, b: string): string {
  // Scale to 8-decimal integer math. Both inputs are pre-validated.
  const scale = (s: string) => {
    const [i, f = ""] = s.split(".");
    return BigInt(i + f.padEnd(8, "0"));
  };
  const sum = scale(a) + scale(b);
  const s = sum.toString().padStart(9, "0"); // ensure at least 1 int digit
  const intPart = s.slice(0, -8).replace(/^0+(?=\d)/, "") || "0";
  const fracPart = s.slice(-8).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
