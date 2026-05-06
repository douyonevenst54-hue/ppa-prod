import { describe, it, expect } from "vitest";
import {
  DecimalString,
  PositiveDecimalString,
  Hex32,
  Hex16,
  IsoDateTime,
  CuidId,
  Scope,
  RateLimit,
  MandateBody,
  SignedMandate,
  VerifyRequest,
  VerifyResponse,
  ConsumeRequest,
  ActionType,
  RejectCode,
  cmpDecimal,
  addDecimal,
  MANDATE_VERSION,
} from "@/types/mandate";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe("DecimalString", () => {
  it("accepts integers", () => {
    expect(DecimalString.parse("0")).toBe("0");
    expect(DecimalString.parse("100")).toBe("100");
  });

  it("accepts up to 8 fractional digits", () => {
    expect(DecimalString.parse("1.5")).toBe("1.5");
    expect(DecimalString.parse("0.00000001")).toBe("0.00000001");
  });

  it("rejects more than 8 fractional digits", () => {
    expect(() => DecimalString.parse("1.000000001")).toThrow();
  });

  it("rejects leading zeros (except for zero itself)", () => {
    expect(() => DecimalString.parse("01")).toThrow();
    expect(() => DecimalString.parse("007.5")).toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => DecimalString.parse("-1")).toThrow();
  });

  it("rejects non-strings", () => {
    expect(() => DecimalString.parse(1.5)).toThrow();
  });

  it("rejects scientific notation", () => {
    expect(() => DecimalString.parse("1e5")).toThrow();
  });
});

describe("PositiveDecimalString", () => {
  it("rejects zero in any form", () => {
    expect(() => PositiveDecimalString.parse("0")).toThrow();
    expect(() => PositiveDecimalString.parse("0.0")).toThrow();
    expect(() => PositiveDecimalString.parse("0.00000000")).toThrow();
  });

  it("accepts very small positive", () => {
    expect(PositiveDecimalString.parse("0.00000001")).toBe("0.00000001");
  });
});

describe("Hex32 / Hex16", () => {
  it("accepts exactly 64 lowercase hex chars for Hex32", () => {
    expect(Hex32.parse("a".repeat(64))).toBe("a".repeat(64));
    expect(Hex32.parse("0123456789abcdef".repeat(4))).toBeTruthy();
  });

  it("rejects wrong length", () => {
    expect(() => Hex32.parse("a".repeat(63))).toThrow();
    expect(() => Hex32.parse("a".repeat(65))).toThrow();
  });

  it("rejects uppercase hex", () => {
    expect(() => Hex32.parse("A".repeat(64))).toThrow();
  });

  it("rejects non-hex chars", () => {
    expect(() => Hex32.parse("g".repeat(64))).toThrow();
  });

  it("Hex16 needs exactly 32 chars", () => {
    expect(Hex16.parse("a".repeat(32))).toBe("a".repeat(32));
    expect(() => Hex16.parse("a".repeat(31))).toThrow();
  });
});

describe("IsoDateTime", () => {
  it("requires timezone offset", () => {
    expect(IsoDateTime.parse("2026-05-05T00:00:00.000Z")).toBeTruthy();
    expect(IsoDateTime.parse("2026-05-05T00:00:00+00:00")).toBeTruthy();
  });

  it("rejects naive datetimes", () => {
    expect(() => IsoDateTime.parse("2026-05-05T00:00:00")).toThrow();
  });

  it("rejects date-only", () => {
    expect(() => IsoDateTime.parse("2026-05-05")).toThrow();
  });
});

describe("CuidId", () => {
  it("accepts cuid-shaped strings", () => {
    expect(CuidId.parse("c" + "a".repeat(24))).toBeTruthy();
  });

  it("rejects strings not starting with c", () => {
    expect(() => CuidId.parse("x" + "a".repeat(24))).toThrow();
  });

  it("rejects too-short cuids", () => {
    expect(() => CuidId.parse("c123")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

describe("Scope", () => {
  const valid = {
    appIds: ["lopipo"],
    actions: ["POLL_ENTRY"] as const,
  };

  it("accepts a minimal valid scope", () => {
    expect(Scope.parse(valid)).toEqual(valid);
  });

  it("requires at least one appId", () => {
    expect(() => Scope.parse({ appIds: [], actions: ["POLL_ENTRY"] })).toThrow();
  });

  it("requires at least one action", () => {
    expect(() => Scope.parse({ appIds: ["lopipo"], actions: [] })).toThrow();
  });

  it("rejects unknown action types", () => {
    expect(() => Scope.parse({ appIds: ["lopipo"], actions: ["DRAIN_WALLET"] })).toThrow();
  });

  it("rejects duplicate appIds", () => {
    expect(() =>
      Scope.parse({ appIds: ["lopipo", "lopipo"], actions: ["POLL_ENTRY"] }),
    ).toThrow(/unique/);
  });

  it("rejects duplicate actions", () => {
    expect(() =>
      Scope.parse({ appIds: ["lopipo"], actions: ["POLL_ENTRY", "POLL_ENTRY"] }),
    ).toThrow(/unique/);
  });

  it("rejects whitelist + blacklist together", () => {
    expect(() =>
      Scope.parse({
        ...valid,
        targetWhitelist: ["a"],
        targetBlacklist: ["b"],
      }),
    ).toThrow(/mutually exclusive/);
  });

  it("accepts whitelist alone", () => {
    expect(
      Scope.parse({ ...valid, targetWhitelist: ["poll_42"] }),
    ).toBeTruthy();
  });

  it("accepts blacklist alone", () => {
    expect(
      Scope.parse({ ...valid, targetBlacklist: ["poll_999"] }),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RateLimit
// ---------------------------------------------------------------------------

describe("RateLimit", () => {
  it("accepts reasonable values", () => {
    expect(RateLimit.parse({ windowSeconds: 60, maxTx: 5 })).toEqual({
      windowSeconds: 60,
      maxTx: 5,
    });
  });

  it("rejects non-positive values", () => {
    expect(() => RateLimit.parse({ windowSeconds: 0, maxTx: 5 })).toThrow();
    expect(() => RateLimit.parse({ windowSeconds: 60, maxTx: 0 })).toThrow();
  });

  it("rejects float windows", () => {
    expect(() => RateLimit.parse({ windowSeconds: 1.5, maxTx: 5 })).toThrow();
  });

  it("caps the window at 7 days", () => {
    expect(() =>
      RateLimit.parse({ windowSeconds: 86_400 * 8, maxTx: 5 }),
    ).toThrow(/7 days/);
  });
});

// ---------------------------------------------------------------------------
// MandateBody
// ---------------------------------------------------------------------------

const validMandate = {
  v: MANDATE_VERSION,
  userId: "douyonevenst54",
  agentId: "agent_alpha",
  scope: { appIds: ["lopipo"], actions: ["POLL_ENTRY"] },
  cap: "100.00000000",
  perTxCap: "5.00000000",
  rateLimit: { windowSeconds: 3600, maxTx: 20 },
  notBefore: "2026-05-05T00:00:00.000Z",
  expiresAt: "2026-05-12T00:00:00.000Z",
  nonceSalt: "deadbeef".repeat(8),
};

describe("MandateBody", () => {
  it("accepts a valid mandate", () => {
    expect(MandateBody.parse(validMandate)).toBeTruthy();
  });

  it("requires version literal 1", () => {
    expect(() => MandateBody.parse({ ...validMandate, v: 2 })).toThrow();
    expect(() => MandateBody.parse({ ...validMandate, v: 0 })).toThrow();
  });

  it("rejects expiresAt before notBefore", () => {
    expect(() =>
      MandateBody.parse({
        ...validMandate,
        notBefore: "2026-06-01T00:00:00.000Z",
        expiresAt: "2026-05-01T00:00:00.000Z",
      }),
    ).toThrow(/expiresAt must be strictly after notBefore/);
  });

  it("rejects equal notBefore and expiresAt", () => {
    expect(() =>
      MandateBody.parse({
        ...validMandate,
        notBefore: "2026-05-05T00:00:00.000Z",
        expiresAt: "2026-05-05T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects perTxCap > cap", () => {
    expect(() =>
      MandateBody.parse({
        ...validMandate,
        cap: "10.0",
        perTxCap: "20.0",
      }),
    ).toThrow(/perTxCap cannot exceed cap/);
  });

  it("accepts perTxCap === cap", () => {
    expect(
      MandateBody.parse({
        ...validMandate,
        cap: "10.0",
        perTxCap: "10.0",
      }),
    ).toBeTruthy();
  });

  it("accepts null perTxCap", () => {
    expect(
      MandateBody.parse({ ...validMandate, perTxCap: null }),
    ).toBeTruthy();
  });

  it("accepts null rateLimit", () => {
    expect(
      MandateBody.parse({ ...validMandate, rateLimit: null }),
    ).toBeTruthy();
  });

  it("rejects empty userId", () => {
    expect(() => MandateBody.parse({ ...validMandate, userId: "" })).toThrow();
  });

  it("rejects negative cap", () => {
    expect(() => MandateBody.parse({ ...validMandate, cap: "-1" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// VerifyRequest
// ---------------------------------------------------------------------------

describe("VerifyRequest", () => {
  const valid = {
    mandateId: "c" + "a".repeat(24),
    appApiKey: "x".repeat(32),
    agentId: "agent_alpha",
    action: "POLL_ENTRY" as const,
    amount: "1.50000000",
    targetId: "poll_42",
    clientNonce: "f".repeat(32),
  };

  it("accepts a valid request", () => {
    expect(VerifyRequest.parse(valid)).toBeTruthy();
  });

  it("rejects too-short api key", () => {
    expect(() =>
      VerifyRequest.parse({ ...valid, appApiKey: "x".repeat(16) }),
    ).toThrow();
  });

  it("rejects amount of zero", () => {
    expect(() => VerifyRequest.parse({ ...valid, amount: "0" })).toThrow();
  });

  it("rejects unknown action", () => {
    expect(() =>
      VerifyRequest.parse({ ...valid, action: "DRAIN_WALLET" }),
    ).toThrow();
  });

  it("rejects malformed clientNonce", () => {
    expect(() =>
      VerifyRequest.parse({ ...valid, clientNonce: "f".repeat(33) }),
    ).toThrow();
  });

  it("rejects empty targetId", () => {
    expect(() => VerifyRequest.parse({ ...valid, targetId: "" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// VerifyResponse — discriminated union
// ---------------------------------------------------------------------------

describe("VerifyResponse", () => {
  it("accepts a valid ok response", () => {
    expect(
      VerifyResponse.parse({
        ok: true,
        nonce: "a".repeat(64),
        actionHash: "b".repeat(64),
        expiresAt: "2026-05-05T00:01:00.000Z",
        latencyMs: 12,
      }),
    ).toBeTruthy();
  });

  it("accepts a valid rejected response", () => {
    expect(
      VerifyResponse.parse({ ok: false, code: "EXPIRED" }),
    ).toBeTruthy();
  });

  it("rejects unknown reject codes", () => {
    expect(() =>
      VerifyResponse.parse({ ok: false, code: "TOTALLY_MADE_UP" }),
    ).toThrow();
  });

  it("rejects mismatched ok/payload shape", () => {
    expect(() =>
      VerifyResponse.parse({ ok: true, code: "EXPIRED" }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SignedMandate / ConsumeRequest sanity
// ---------------------------------------------------------------------------

describe("SignedMandate", () => {
  it("accepts a minimally valid envelope", () => {
    expect(
      SignedMandate.parse({
        body: validMandate,
        signature: "AAAA",
        signingKeyId: "c" + "a".repeat(24),
      }),
    ).toBeTruthy();
  });

  it("rejects non-base64 signature", () => {
    expect(() =>
      SignedMandate.parse({
        body: validMandate,
        signature: "@@@@@",
        signingKeyId: "c" + "a".repeat(24),
      }),
    ).toThrow();
  });
});

describe("ConsumeRequest", () => {
  it("accepts a valid request", () => {
    expect(
      ConsumeRequest.parse({
        nonce: "a".repeat(64),
        appApiKey: "x".repeat(32),
        piPaymentId: "pi_payment_xyz",
      }),
    ).toBeTruthy();
  });

  it("rejects empty piPaymentId", () => {
    expect(() =>
      ConsumeRequest.parse({
        nonce: "a".repeat(64),
        appApiKey: "x".repeat(32),
        piPaymentId: "",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// cmpDecimal / addDecimal — money math without floats
// ---------------------------------------------------------------------------

describe("cmpDecimal", () => {
  it("compares integers", () => {
    expect(cmpDecimal("5", "10")).toBe(-1);
    expect(cmpDecimal("10", "5")).toBe(1);
    expect(cmpDecimal("7", "7")).toBe(0);
  });

  it("compares fractions correctly", () => {
    expect(cmpDecimal("1.5", "1.50")).toBe(0);
    expect(cmpDecimal("1.5", "1.51")).toBe(-1);
    expect(cmpDecimal("1.51", "1.5")).toBe(1);
  });

  it("handles different fractional lengths", () => {
    expect(cmpDecimal("1", "1.00000000")).toBe(0);
    expect(cmpDecimal("1.00000001", "1")).toBe(1);
  });

  it("compares large values without float drift", () => {
    expect(cmpDecimal("99999999999.99999999", "99999999999.99999998")).toBe(1);
    expect(cmpDecimal("99999999999.99999998", "99999999999.99999999")).toBe(-1);
  });
});

describe("addDecimal", () => {
  it("adds integers", () => {
    expect(addDecimal("1", "2")).toBe("3");
    expect(addDecimal("0", "5")).toBe("5");
  });

  it("adds fractions exactly", () => {
    expect(addDecimal("0.1", "0.2")).toBe("0.3"); // floats would give 0.30000000000000004
    expect(addDecimal("1.5", "2.5")).toBe("4");
  });

  it("preserves precision at the 8th decimal", () => {
    expect(addDecimal("0.00000001", "0.00000001")).toBe("0.00000002");
  });

  it("handles carries across decimal", () => {
    expect(addDecimal("0.99999999", "0.00000001")).toBe("1");
  });

  it("works with no fractional parts", () => {
    expect(addDecimal("100", "50")).toBe("150");
  });

  it("matches cmpDecimal: a + b > a when b > 0", () => {
    const a = "12.34567890";
    const b = "0.00000001";
    const sum = addDecimal(a, b);
    expect(cmpDecimal(sum, a)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cross-validator: a Zod-validated mandate produces deterministic canonical bytes
// ---------------------------------------------------------------------------

describe("integration: validated mandate is canonicalize-safe", () => {
  it("a parsed mandate with stringified counts canonicalizes deterministically", async () => {
    const { canonicalize } = await import("@/lib/crypto/canonical");

    const parsed = MandateBody.parse(validMandate);

    // Stringify integer fields at the canonicalize boundary.
    const signingPayload = {
      v: String(parsed.v),
      userId: parsed.userId,
      agentId: parsed.agentId,
      scope: parsed.scope,
      cap: parsed.cap,
      perTxCap: parsed.perTxCap,
      rateLimit: parsed.rateLimit
        ? {
            windowSeconds: String(parsed.rateLimit.windowSeconds),
            maxTx: String(parsed.rateLimit.maxTx),
          }
        : null,
      notBefore: parsed.notBefore,
      expiresAt: parsed.expiresAt,
      nonceSalt: parsed.nonceSalt,
    };

    const a = canonicalize(signingPayload);
    const b = canonicalize(signingPayload);
    expect(a).toBe(b);
    // Sanity: agentId comes first alphabetically.
    expect(a.indexOf('"agentId"')).toBe(1);
  });
});
