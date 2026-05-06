import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  importPublicKey,
  importPrivateKey,
  sign,
  verify,
  verifyWithBase64Key,
  bytesToBase64,
  base64ToBytes,
  Ed25519Error,
} from "@/lib/crypto/ed25519";
import { canonicalize, canonicalBytes } from "@/lib/crypto/canonical";

// ---------------------------------------------------------------------------
// base64 helpers
// ---------------------------------------------------------------------------

describe("base64 helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 128, 64]);
    const b64 = bytesToBase64(original);
    const back = base64ToBytes(b64);
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it("round-trips an empty array", () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
    expect(base64ToBytes("").length).toBe(0);
  });

  it("rejects malformed base64", () => {
    expect(() => base64ToBytes("not@base64!")).toThrow(Ed25519Error);
  });
});

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

describe("generateKeyPair", () => {
  it("produces a 32-byte raw public key (44-char base64)", async () => {
    const kp = await generateKeyPair();
    const raw = base64ToBytes(kp.publicKeyBase64);
    expect(raw.length).toBe(32);
  });

  it("produces a non-empty PKCS#8 private key", async () => {
    const kp = await generateKeyPair();
    const priv = base64ToBytes(kp.privateKeyPkcs8Base64);
    // PKCS#8 Ed25519 private keys are 48 bytes (header + 32-byte seed)
    expect(priv.length).toBeGreaterThan(40);
    expect(priv.length).toBeLessThan(80);
  });

  it("produces different keys each call (sanity)", async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    expect(a.publicKeyBase64).not.toBe(b.publicKeyBase64);
  });
});

// ---------------------------------------------------------------------------
// Key import — round-trip
// ---------------------------------------------------------------------------

describe("key import round-trip", () => {
  it("imports a public key and uses it to verify", async () => {
    const kp = await generateKeyPair();
    const data = "hello world";
    const sig = await sign(data, kp.privateKey);

    const importedPub = await importPublicKey(kp.publicKeyBase64);
    const ok = await verify(data, sig, importedPub);
    expect(ok).toBe(true);
  });

  it("imports a private key and uses it to sign", async () => {
    const kp = await generateKeyPair();
    const importedPriv = await importPrivateKey(kp.privateKeyPkcs8Base64);

    const data = "hello world";
    const sig = await sign(data, importedPriv);

    const ok = await verify(data, sig, kp.publicKey);
    expect(ok).toBe(true);
  });

  it("rejects a public key of wrong length", async () => {
    const tooShort = bytesToBase64(new Uint8Array(31));
    await expect(importPublicKey(tooShort)).rejects.toThrow(/exactly 32 bytes/);
  });

  it("rejects a non-base64 public key string", async () => {
    await expect(importPublicKey("not!base64@")).rejects.toThrow(/invalid base64/);
  });
});

// ---------------------------------------------------------------------------
// Sign / verify happy path
// ---------------------------------------------------------------------------

describe("sign / verify", () => {
  it("signs and verifies a string", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("hello", kp.privateKey);
    expect(await verify("hello", sig, kp.publicKey)).toBe(true);
  });

  it("signs and verifies raw bytes", async () => {
    const kp = await generateKeyPair();
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const sig = await sign(data, kp.privateKey);
    expect(await verify(data, sig, kp.publicKey)).toBe(true);
  });

  it("signature is exactly 64 bytes (88 base64 chars)", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("x", kp.privateKey);
    const raw = base64ToBytes(sig);
    expect(raw.length).toBe(64);
  });

  it("string and matching bytes produce the same signature relationship", async () => {
    // Not the same bytes — Ed25519 is randomized? Actually no, Ed25519 is
    // deterministic per key+message. Same input must produce same signature.
    const kp = await generateKeyPair();
    const sigA = await sign("hello", kp.privateKey);
    const sigB = await sign(new TextEncoder().encode("hello"), kp.privateKey);
    expect(sigA).toBe(sigB);
  });

  it("Ed25519 is deterministic — same key + message yields same signature", async () => {
    const kp = await generateKeyPair();
    const s1 = await sign("repeatable", kp.privateKey);
    const s2 = await sign("repeatable", kp.privateKey);
    expect(s1).toBe(s2);
  });
});

// ---------------------------------------------------------------------------
// Sign / verify attack cases — these must all return false, not throw
// ---------------------------------------------------------------------------

describe("verify rejects bad inputs", () => {
  it("rejects a tampered message", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("hello", kp.privateKey);
    expect(await verify("hello!", sig, kp.publicKey)).toBe(false);
  });

  it("rejects a signature from the wrong key", async () => {
    const kpA = await generateKeyPair();
    const kpB = await generateKeyPair();
    const sig = await sign("hello", kpA.privateKey);
    expect(await verify("hello", sig, kpB.publicKey)).toBe(false);
  });

  it("rejects a malformed signature (returns false, does not throw)", async () => {
    const kp = await generateKeyPair();
    expect(await verify("hello", "not-base64!", kp.publicKey)).toBe(false);
  });

  it("rejects a wrong-length signature", async () => {
    const kp = await generateKeyPair();
    const tooShort = bytesToBase64(new Uint8Array(63));
    expect(await verify("hello", tooShort, kp.publicKey)).toBe(false);
  });

  it("rejects an all-zeros signature", async () => {
    const kp = await generateKeyPair();
    const zeros = bytesToBase64(new Uint8Array(64));
    expect(await verify("hello", zeros, kp.publicKey)).toBe(false);
  });

  it("rejects flipping a single byte in a valid signature", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("hello", kp.privateKey);
    const raw = base64ToBytes(sig);
    raw[0] ^= 0x01;
    const tampered = bytesToBase64(raw);
    expect(await verify("hello", tampered, kp.publicKey)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyWithBase64Key — convenience used by the verifier endpoint
// ---------------------------------------------------------------------------

describe("verifyWithBase64Key", () => {
  it("works the same as verify with imported key", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("hello", kp.privateKey);
    expect(
      await verifyWithBase64Key("hello", sig, kp.publicKeyBase64),
    ).toBe(true);
  });

  it("returns false (not throws) on a malformed public key", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("hello", kp.privateKey);
    expect(
      await verifyWithBase64Key("hello", sig, "not-base64!"),
    ).toBe(false);
  });

  it("returns false (not throws) on a wrong-length public key", async () => {
    const kp = await generateKeyPair();
    const sig = await sign("hello", kp.privateKey);
    const wrongLen = bytesToBase64(new Uint8Array(31));
    expect(
      await verifyWithBase64Key("hello", sig, wrongLen),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// THE INTEGRATION TEST: ed25519 + canonical.ts work together for mandates
//
// This is the actual flow the verifier endpoint will use. If this test
// passes, the cryptographic core of the mandate layer works.
// ---------------------------------------------------------------------------

describe("integration: signing a canonical mandate payload", () => {
  // The same signing payload an agent's client would build, with all numbers
  // already stringified at the canonicalize boundary.
  const signingPayload = {
    v: "1",
    userId: "douyonevenst54",
    agentId: "agent_alpha",
    scope: {
      appIds: ["lopipo"],
      actions: ["POLL_ENTRY"],
    },
    cap: "100.00000000",
    perTxCap: "5.00000000",
    rateLimit: { windowSeconds: "3600", maxTx: "20" },
    notBefore: "2026-05-05T00:00:00.000Z",
    expiresAt: "2026-05-12T00:00:00.000Z",
    nonceSalt: "deadbeef".repeat(8),
  };

  it("end-to-end: canonicalize → sign → store → reload → verify", async () => {
    // CLIENT SIDE: user's device generates a key, signs the mandate body
    const kp = await generateKeyPair();
    const bytes = canonicalBytes(signingPayload);
    const signature = await sign(bytes, kp.privateKey);

    // Wire format: { body, signature, signingKeyId, publicKey }
    // Server stores publicKey in UserSigningKey table.
    const storedPublicKey = kp.publicKeyBase64;

    // SERVER SIDE: verifier endpoint receives the mandate, re-canonicalizes,
    // looks up the user's signing key, verifies.
    const recomputedBytes = canonicalBytes(signingPayload);
    const ok = await verifyWithBase64Key(recomputedBytes, signature, storedPublicKey);
    expect(ok).toBe(true);
  });

  it("verification FAILS if any field of the mandate is tampered with", async () => {
    const kp = await generateKeyPair();
    const sig = await sign(canonicalBytes(signingPayload), kp.privateKey);

    // Attacker raises the cap from 100 to 1000 after the user signed.
    const tampered = { ...signingPayload, cap: "1000.00000000" };
    const ok = await verifyWithBase64Key(
      canonicalBytes(tampered),
      sig,
      kp.publicKeyBase64,
    );
    expect(ok).toBe(false);
  });

  it("verification FAILS if attacker swaps the agentId", async () => {
    const kp = await generateKeyPair();
    const sig = await sign(canonicalBytes(signingPayload), kp.privateKey);

    const tampered = { ...signingPayload, agentId: "evil_agent" };
    const ok = await verifyWithBase64Key(
      canonicalBytes(tampered),
      sig,
      kp.publicKeyBase64,
    );
    expect(ok).toBe(false);
  });

  it("verification FAILS if attacker extends the expiry", async () => {
    const kp = await generateKeyPair();
    const sig = await sign(canonicalBytes(signingPayload), kp.privateKey);

    const tampered = { ...signingPayload, expiresAt: "2099-01-01T00:00:00.000Z" };
    const ok = await verifyWithBase64Key(
      canonicalBytes(tampered),
      sig,
      kp.publicKeyBase64,
    );
    expect(ok).toBe(false);
  });

  it("verification FAILS if a key from a different user signs the mandate", async () => {
    const userKp = await generateKeyPair();
    const attackerKp = await generateKeyPair();

    // Attacker signs a mandate that *claims* to be from the user.
    const sig = await sign(canonicalBytes(signingPayload), attackerKp.privateKey);

    // Verifier looks up the legitimate user's stored public key.
    const ok = await verifyWithBase64Key(
      canonicalBytes(signingPayload),
      sig,
      userKp.publicKeyBase64,
    );
    expect(ok).toBe(false);
  });

  it("two clients building the same mandate produce the same signature bytes", async () => {
    // Same mandate body, different key insertion order — must produce
    // byte-identical signed payload, and therefore the same signature.
    const kp = await generateKeyPair();

    const buildA = {
      v: "1",
      userId: "u1",
      agentId: "a1",
      scope: { appIds: ["lopipo"], actions: ["POLL_ENTRY"] },
      cap: "10",
      perTxCap: null,
      rateLimit: null,
      notBefore: "2026-05-05T00:00:00.000Z",
      expiresAt: "2026-05-12T00:00:00.000Z",
      nonceSalt: "a".repeat(64),
    };

    const buildB = {
      nonceSalt: "a".repeat(64),
      expiresAt: "2026-05-12T00:00:00.000Z",
      notBefore: "2026-05-05T00:00:00.000Z",
      rateLimit: null,
      perTxCap: null,
      cap: "10",
      scope: { actions: ["POLL_ENTRY"], appIds: ["lopipo"] },
      agentId: "a1",
      userId: "u1",
      v: "1",
    };

    const sigA = await sign(canonicalBytes(buildA), kp.privateKey);
    const sigB = await sign(canonicalBytes(buildB), kp.privateKey);
    expect(sigA).toBe(sigB);
  });
});
