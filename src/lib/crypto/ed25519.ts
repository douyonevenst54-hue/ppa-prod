/**
 * Ed25519 signing and verification for PPA mandates.
 *
 * Uses the Web Crypto API (SubtleCrypto), which works identically in:
 *   - Node 20+ (runtime: 'nodejs')
 *   - Vercel edge runtime (runtime: 'edge')
 *   - browsers (for client-side mandate signing)
 *
 * No external dependencies. No "@noble/ed25519". No tweetnacl.
 *
 * Public keys and signatures cross the wire as base64. We use raw key formats:
 *   - public key:  32 bytes (raw Ed25519 public key)
 *   - signature:   64 bytes (raw Ed25519 signature)
 *   - private key: PKCS#8 DER (the format SubtleCrypto.exportKey returns for
 *                  Ed25519 private keys; we never put this on the wire — it
 *                  stays on the user's device)
 *
 * IMPORTANT: This module assumes the runtime exposes `crypto.subtle` and
 * supports the "Ed25519" algorithm. Both are true on Node 20+, Vercel edge,
 * and modern browsers (Chrome 113+, Firefox 130+, Safari 17+). If you need
 * to support older browsers, polyfill before importing this module.
 */

const ALG = "Ed25519" as const;
const PUBKEY_BYTES = 32;
const SIG_BYTES = 64;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ed25519Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ed25519Error";
  }
}

// ---------------------------------------------------------------------------
// base64 <-> Uint8Array helpers
//
// We avoid Buffer (not available in edge runtime / browser) and Node-only
// APIs. atob/btoa are universal.
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  // Be strict: reject anything that's not base64. atob is permissive on some
  // engines, so we validate first.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
    throw new Ed25519Error("invalid base64");
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Key generation (server-side: for tests; client-side: when issuing mandates)
// ---------------------------------------------------------------------------

export interface GeneratedKeyPair {
  /** raw 32-byte Ed25519 public key, base64 — store this in UserSigningKey.publicKey */
  publicKeyBase64: string;
  /** PKCS#8 DER private key, base64 — NEVER send to the server. Encrypt and
   *  store in IndexedDB or similar. */
  privateKeyPkcs8Base64: string;
  /** The CryptoKey objects, in case the caller wants to keep them resident. */
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateKeyPair(): Promise<GeneratedKeyPair> {
  const kp = (await crypto.subtle.generateKey(
    { name: ALG },
    /* extractable */ true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  if (rawPub.length !== PUBKEY_BYTES) {
    throw new Ed25519Error(`unexpected public key length: ${rawPub.length}`);
  }

  const pkcs8Priv = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", kp.privateKey),
  );

  return {
    publicKeyBase64: bytesToBase64(rawPub),
    privateKeyPkcs8Base64: bytesToBase64(pkcs8Priv),
    publicKey: kp.publicKey,
    privateKey: kp.privateKey,
  };
}

// ---------------------------------------------------------------------------
// Key import — turning stored base64 back into a CryptoKey
// ---------------------------------------------------------------------------

export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(publicKeyBase64);
  if (raw.length !== PUBKEY_BYTES) {
    throw new Ed25519Error(`public key must be exactly ${PUBKEY_BYTES} bytes, got ${raw.length}`);
  }
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(raw),
    { name: ALG },
    /* extractable */ false,
    ["verify"],
  );
}

export async function importPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  const pkcs8 = base64ToBytes(pkcs8Base64);
  return crypto.subtle.importKey(
    "pkcs8",
    asBufferSource(pkcs8),
    { name: ALG },
    /* extractable */ false,
    ["sign"],
  );
}

// ---------------------------------------------------------------------------
// Sign / verify
//
// `data` is the canonical-JSON bytes from canonical.ts. We accept either a
// Uint8Array (preferred) or a string (which we UTF-8 encode for the caller's
// convenience — but be careful: the bytes you sign and the bytes you verify
// must be byte-identical).
// ---------------------------------------------------------------------------

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

/**
 * Coerce a Uint8Array to BufferSource. Newer @types/node / lib.dom typings
 * sometimes infer `Uint8Array<ArrayBufferLike>` (which can be a SharedArrayBuffer)
 * while SubtleCrypto requires `Uint8Array<ArrayBuffer>`. Copying the bytes into
 * a fresh ArrayBuffer-backed Uint8Array is safe and the cleanest way to
 * satisfy the type checker without `any`. The cost (one small alloc per call)
 * is irrelevant next to the cost of an Ed25519 sign/verify.
 */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

export async function sign(
  data: Uint8Array | string,
  privateKey: CryptoKey,
): Promise<string> {
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: ALG }, privateKey, asBufferSource(toBytes(data))),
  );
  if (sig.length !== SIG_BYTES) {
    throw new Ed25519Error(`unexpected signature length: ${sig.length}`);
  }
  return bytesToBase64(sig);
}

export async function verify(
  data: Uint8Array | string,
  signatureBase64: string,
  publicKey: CryptoKey,
): Promise<boolean> {
  let sig: Uint8Array;
  try {
    sig = base64ToBytes(signatureBase64);
  } catch {
    return false; // malformed sig is just an invalid sig, not an exception
  }
  if (sig.length !== SIG_BYTES) return false;

  try {
    return await crypto.subtle.verify({ name: ALG }, publicKey, asBufferSource(sig), asBufferSource(toBytes(data)));
  } catch {
    // SubtleCrypto can throw on certain malformed inputs. Treat as invalid.
    return false;
  }
}

/**
 * Convenience: verify when the caller has the public key as base64 (the
 * common case in the verifier endpoint, where the key comes from
 * UserSigningKey.publicKey in the database).
 */
export async function verifyWithBase64Key(
  data: Uint8Array | string,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<boolean> {
  let pubKey: CryptoKey;
  try {
    pubKey = await importPublicKey(publicKeyBase64);
  } catch {
    return false; // malformed public key in DB → reject, don't crash
  }
  return verify(data, signatureBase64, pubKey);
}
