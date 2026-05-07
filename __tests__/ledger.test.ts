/**
 * Tests for ledger hash-chain logic. These don't hit a database — they
 * verify that the hash function is deterministic, sensitive to tampering,
 * and produces non-colliding hashes across different inputs.
 *
 * The full integration tests (real Postgres, real concurrency) live in
 * a separate file that requires a TEST_DATABASE_URL env var.
 */

import { describe, it, expect } from "vitest";
import { computeRowHash } from "@/lib/ledger";

const ZERO_HASH = "0".repeat(64);

const baseRow = {
  prevHash: ZERO_HASH,
  piUserId: "douyonevenst54",
  amount: 100,
  type: "snapshot",
  source: "snapshot",
  balanceAfter: 100,
  createdAtIso: "2026-05-06T01:00:00.000Z",
  idempotencyKey: null,
};

describe("computeRowHash: shape", () => {
  it("returns a 64-char lowercase hex string", () => {
    const h = computeRowHash(baseRow);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeRowHash: determinism", () => {
  it("same input yields same hash every call", () => {
    expect(computeRowHash(baseRow)).toBe(computeRowHash(baseRow));
  });

  it("two different rows with same payload-shape but different timestamps differ", () => {
    const a = computeRowHash(baseRow);
    const b = computeRowHash({ ...baseRow, createdAtIso: "2026-05-06T01:00:00.001Z" });
    expect(a).not.toBe(b);
  });
});

describe("computeRowHash: sensitivity (every field matters)", () => {
  const baseHash = computeRowHash(baseRow);

  it("changes if prevHash changes", () => {
    expect(
      computeRowHash({ ...baseRow, prevHash: "1".repeat(64) }),
    ).not.toBe(baseHash);
  });

  it("changes if piUserId changes", () => {
    expect(
      computeRowHash({ ...baseRow, piUserId: "someone_else" }),
    ).not.toBe(baseHash);
  });

  it("changes if amount changes", () => {
    expect(
      computeRowHash({ ...baseRow, amount: 101 }),
    ).not.toBe(baseHash);
  });

  it("changes if type changes", () => {
    expect(
      computeRowHash({ ...baseRow, type: "earn" }),
    ).not.toBe(baseHash);
  });

  it("changes if source changes", () => {
    expect(
      computeRowHash({ ...baseRow, source: "poll" }),
    ).not.toBe(baseHash);
  });

  it("changes if balanceAfter changes", () => {
    expect(
      computeRowHash({ ...baseRow, balanceAfter: 999 }),
    ).not.toBe(baseHash);
  });

  it("changes if createdAtIso changes", () => {
    expect(
      computeRowHash({ ...baseRow, createdAtIso: "2030-01-01T00:00:00.000Z" }),
    ).not.toBe(baseHash);
  });

  it("changes if idempotencyKey changes from null to a string", () => {
    expect(
      computeRowHash({ ...baseRow, idempotencyKey: "retry-1" }),
    ).not.toBe(baseHash);
  });
});

describe("computeRowHash: chain construction", () => {
  it("a four-row chain produces four distinct hashes that link correctly", () => {
    // Row 0: snapshot
    const row0 = computeRowHash({
      ...baseRow,
      prevHash: ZERO_HASH,
      amount: 100,
      type: "snapshot",
      source: "snapshot",
      balanceAfter: 100,
      createdAtIso: "2026-05-06T01:00:00.000Z",
    });

    // Row 1: +5 from poll vote
    const row1 = computeRowHash({
      prevHash: row0,
      piUserId: "douyonevenst54",
      amount: 5,
      type: "earn",
      source: "poll",
      balanceAfter: 105,
      createdAtIso: "2026-05-06T01:01:00.000Z",
      idempotencyKey: null,
    });

    // Row 2: -20 from prediction stake
    const row2 = computeRowHash({
      prevHash: row1,
      piUserId: "douyonevenst54",
      amount: -20,
      type: "spend",
      source: "prediction:cm123",
      balanceAfter: 85,
      createdAtIso: "2026-05-06T01:02:00.000Z",
      idempotencyKey: null,
    });

    // Row 3: +50 from prediction payout (idempotent)
    const row3 = computeRowHash({
      prevHash: row2,
      piUserId: "douyonevenst54",
      amount: 50,
      type: "earn",
      source: "prediction:cm123:payout",
      balanceAfter: 135,
      createdAtIso: "2026-05-06T01:03:00.000Z",
      idempotencyKey: "resolve:cm123",
    });

    const chain = [row0, row1, row2, row3];
    expect(new Set(chain).size).toBe(4); // all distinct

    // Re-running with the same inputs reproduces every hash.
    const row1Again = computeRowHash({
      prevHash: row0,
      piUserId: "douyonevenst54",
      amount: 5,
      type: "earn",
      source: "poll",
      balanceAfter: 105,
      createdAtIso: "2026-05-06T01:01:00.000Z",
      idempotencyKey: null,
    });
    expect(row1Again).toBe(row1);
  });

  it("if attacker tampers row 1, recomputed row 2 will not match the original row 2", () => {
    const row0 = computeRowHash({
      ...baseRow,
      type: "snapshot",
      source: "snapshot",
      balanceAfter: 100,
    });

    // Honest row 1: user earns 5
    const honestRow1 = computeRowHash({
      prevHash: row0,
      piUserId: "douyonevenst54",
      amount: 5,
      type: "earn",
      source: "poll",
      balanceAfter: 105,
      createdAtIso: "2026-05-06T01:01:00.000Z",
      idempotencyKey: null,
    });

    // Tampered row 1: attacker rewrites to claim user earned 5000.
    // Tamper changes the rowHash for that row...
    const tamperedRow1 = computeRowHash({
      prevHash: row0,
      piUserId: "douyonevenst54",
      amount: 5000,
      type: "earn",
      source: "poll",
      balanceAfter: 5100,
      createdAtIso: "2026-05-06T01:01:00.000Z",
      idempotencyKey: null,
    });

    expect(tamperedRow1).not.toBe(honestRow1);

    // ...so any honest row 2 chained from honestRow1 will not match a row 2
    // chained from tamperedRow1. The break is detectable when verifyUserChain
    // walks the chain.
    const honestRow2 = computeRowHash({
      prevHash: honestRow1,
      piUserId: "douyonevenst54",
      amount: -10,
      type: "spend",
      source: "prediction",
      balanceAfter: 95,
      createdAtIso: "2026-05-06T01:02:00.000Z",
      idempotencyKey: null,
    });
    const fromTamperedRow2 = computeRowHash({
      prevHash: tamperedRow1,
      piUserId: "douyonevenst54",
      amount: -10,
      type: "spend",
      source: "prediction",
      balanceAfter: 5090,
      createdAtIso: "2026-05-06T01:02:00.000Z",
      idempotencyKey: null,
    });
    expect(honestRow2).not.toBe(fromTamperedRow2);
  });
});
