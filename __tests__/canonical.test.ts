import { describe, it, expect } from "vitest";
import { canonicalize, canonicalBytes, CanonicalJSONError } from "@/lib/crypto/canonical";

describe("canonicalize: primitives", () => {
  it("serializes null", () => {
    expect(canonicalize(null)).toBe("null");
  });

  it("serializes booleans", () => {
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(false)).toBe("false");
  });

  it("serializes plain ASCII strings", () => {
    expect(canonicalize("hello")).toBe('"hello"');
  });

  it("escapes special characters in strings", () => {
    expect(canonicalize('a"b')).toBe('"a\\"b"');
    expect(canonicalize("a\nb")).toBe('"a\\nb"');
    expect(canonicalize("a\\b")).toBe('"a\\\\b"');
  });
});

describe("canonicalize: rejected types", () => {
  it("rejects numbers — amounts must be decimal strings", () => {
    expect(() => canonicalize(42)).toThrow(CanonicalJSONError);
    expect(() => canonicalize(0)).toThrow(/numbers are not allowed/);
    expect(() => canonicalize(3.14)).toThrow(/numbers are not allowed/);
    expect(() => canonicalize(NaN)).toThrow(/numbers are not allowed/);
  });

  it("rejects bigint", () => {
    expect(() => canonicalize(1n)).toThrow(/bigint/);
  });

  it("rejects undefined values inside objects", () => {
    expect(() => canonicalize({ a: undefined })).toThrow(/undefined/);
  });

  it("rejects undefined at top level", () => {
    expect(() => canonicalize(undefined)).toThrow(/undefined/);
  });

  it("rejects Date objects (must be ISO strings)", () => {
    expect(() => canonicalize({ when: new Date() })).toThrow(/non-plain object/);
  });

  it("rejects Maps and Sets", () => {
    expect(() => canonicalize(new Map())).toThrow(/non-plain object/);
    expect(() => canonicalize(new Set())).toThrow(/non-plain object/);
  });

  it("rejects functions", () => {
    expect(() => canonicalize(() => 1)).toThrow(/function/);
  });

  it("error path points to the offending key", () => {
    try {
      canonicalize({ outer: { inner: 42 } });
      throw new Error("should have thrown");
    } catch (err) {
      if (err instanceof CanonicalJSONError) {
        expect(err.path).toBe("$.outer.inner");
      } else {
        throw err;
      }
    }
  });
});

describe("canonicalize: arrays", () => {
  it("preserves array order", () => {
    expect(canonicalize(["b", "a", "c"])).toBe('["b","a","c"]');
  });

  it("handles empty arrays", () => {
    expect(canonicalize([])).toBe("[]");
  });

  it("handles nested arrays", () => {
    expect(canonicalize([["a"], ["b"]])).toBe('[["a"],["b"]]');
  });
});

describe("canonicalize: objects — KEY ORDER IS THE WHOLE POINT", () => {
  it("sorts keys lexicographically regardless of insertion order", () => {
    const a = { b: "1", a: "2", c: "3" };
    const b = { c: "3", a: "2", b: "1" };
    const c = { a: "2", b: "1", c: "3" };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(b)).toBe(canonicalize(c));
    expect(canonicalize(a)).toBe('{"a":"2","b":"1","c":"3"}');
  });

  it("sorts nested object keys too", () => {
    const x = { z: { y: "1", x: "2" }, a: "0" };
    expect(canonicalize(x)).toBe('{"a":"0","z":{"x":"2","y":"1"}}');
  });

  it("handles empty objects", () => {
    expect(canonicalize({})).toBe("{}");
  });

  it("preserves keys that look like numbers as strings", () => {
    // Note: JS object keys are always strings, but Object.keys order for
    // integer-like keys ("0","1","2") is insertion order in V8 — which is
    // why we sort.
    const x = { "10": "a", "2": "b", "1": "c" };
    expect(canonicalize(x)).toBe('{"1":"c","10":"a","2":"b"}');
  });
});

describe("canonicalize: determinism — same input, same bytes", () => {
  it("produces identical bytes for logically equivalent mandates", () => {
    // Two ways the same signing payload might be constructed — different key
    // insertion order. Output must be identical. Note v is a string here:
    // canonicalize rejects numbers, and the signing-payload boundary
    // stringifies ints. See mandate.test.ts > "canonicalize-safe" for the
    // boundary contract.
    const m1 = {
      v: "1",
      userId: "douyonevenst54",
      agentId: "agent_alpha",
      cap: "100.00000000",
      perTxCap: "5.00000000",
      scope: {
        appIds: ["lopipo"],
        actions: ["POLL_ENTRY", "PREDICTION"],
      },
      notBefore: "2026-05-05T00:00:00.000Z",
      expiresAt: "2026-05-12T00:00:00.000Z",
      nonceSalt: "a".repeat(64),
      rateLimit: null,
    };

    const m2 = {
      cap: "100.00000000",
      perTxCap: "5.00000000",
      scope: {
        actions: ["POLL_ENTRY", "PREDICTION"],
        appIds: ["lopipo"],
      },
      rateLimit: null,
      v: "1",
      nonceSalt: "a".repeat(64),
      expiresAt: "2026-05-12T00:00:00.000Z",
      notBefore: "2026-05-05T00:00:00.000Z",
      userId: "douyonevenst54",
      agentId: "agent_alpha",
    };

    expect(canonicalize(m1)).toBe(canonicalize(m2));
  });

  it("canonicalBytes returns a valid UTF-8 encoding", () => {
    const bytes = canonicalBytes({ a: "héllo" });
    const back = new TextDecoder().decode(bytes);
    expect(back).toBe('{"a":"héllo"}');
  });

  it("different inputs produce different output (sanity)", () => {
    const a = canonicalize({ x: "1" });
    const b = canonicalize({ x: "2" });
    expect(a).not.toBe(b);
  });
});

describe("canonicalize: real mandate shape", () => {
  it("serializes a full mandate body deterministically", () => {
    const mandate = {
      v: 1,
      userId: "douyonevenst54",
      agentId: "agent_alpha_v1",
      scope: {
        appIds: ["lopipo", "ppa"],
        actions: ["POLL_ENTRY", "SPIN_WHEEL"],
      },
      cap: "50.0",
      perTxCap: "5.0",
      rateLimit: { maxTx: 10, windowSeconds: 3600 },
      notBefore: "2026-05-05T00:00:00.000Z",
      expiresAt: "2026-05-12T00:00:00.000Z",
      nonceSalt: "deadbeef".repeat(8),
    };

    const expected =
      '{"agentId":"agent_alpha_v1",' +
      '"cap":"50.0",' +
      '"expiresAt":"2026-05-12T00:00:00.000Z",' +
      '"nonceSalt":"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",' +
      '"notBefore":"2026-05-05T00:00:00.000Z",' +
      '"perTxCap":"5.0",' +
      '"rateLimit":{"maxTx":10,"windowSeconds":3600},' +
      '"scope":{"actions":["POLL_ENTRY","SPIN_WHEEL"],"appIds":["lopipo","ppa"]},' +
      '"userId":"douyonevenst54",' +
      '"v":1}';

    // Wait — v:1 is a number. canonicalize rejects numbers. This is a
    // deliberate test failure to make us notice: rateLimit values are also
    // numbers. We need to decide.
    //
    // Decision: the canonical layer rejects floats. Integers used as enums or
    // counts (version, maxTx, windowSeconds) are also rejected by the strict
    // rule. We could allow them, but then we are back to "what happens to
    // -0, 1e2, etc."
    //
    // Cleanest answer: STRINGIFY integers in the signing payload too. The
    // validator (Zod) keeps them as numbers for type-safety in the app, and
    // we transform to string at the canonicalize boundary.
    //
    // We test that boundary explicitly below.
    expect(() => canonicalize(mandate)).toThrow(/numbers are not allowed/);
  });

  it("the actual signing payload uses stringified ints — see canonicalSigningPayload", () => {
    const stringifiedMandate = {
      v: "1",
      userId: "douyonevenst54",
      agentId: "agent_alpha_v1",
      scope: {
        appIds: ["lopipo", "ppa"],
        actions: ["POLL_ENTRY", "SPIN_WHEEL"],
      },
      cap: "50.0",
      perTxCap: "5.0",
      rateLimit: { maxTx: "10", windowSeconds: "3600" },
      notBefore: "2026-05-05T00:00:00.000Z",
      expiresAt: "2026-05-12T00:00:00.000Z",
      nonceSalt: "deadbeef".repeat(8),
    };

    const out = canonicalize(stringifiedMandate);
    // Must start with { and end with }
    expect(out.startsWith("{")).toBe(true);
    expect(out.endsWith("}")).toBe(true);
    // First key alphabetically must be agentId
    expect(out.indexOf('"agentId"')).toBe(1);
    // Determinism check
    expect(canonicalize(stringifiedMandate)).toBe(out);
  });
});
