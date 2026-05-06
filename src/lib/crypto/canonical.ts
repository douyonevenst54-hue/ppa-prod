/**
 * Canonical JSON serialization for PPA mandates.
 *
 * Why this exists: a mandate must serialize byte-identically every time it is
 * signed and verified. JS object iteration order is technically defined for
 * string keys (insertion order), but we cannot rely on every codepath
 * constructing the object the same way. We also do not want to depend on
 * JSON.stringify's number formatting, which has edge cases (e.g. -0, exponents).
 *
 * Spec (subset of RFC 8785 / JCS sufficient for our needs):
 *   - Object keys sorted lexicographically (UTF-16 code unit order, the same
 *     order Array.prototype.sort gives for strings — matches RFC 8785).
 *   - No whitespace between tokens.
 *   - Strings serialized via JSON.stringify (correct for our ASCII/UTF-8 inputs).
 *   - Numbers: REJECTED. Mandates carry monetary amounts and we never want a
 *     float to silently lose precision in a signed payload. Pass amounts as
 *     decimal strings.
 *   - undefined: REJECTED. Ambiguous in JSON. Use null explicitly.
 *   - Functions, symbols, BigInt: REJECTED.
 *
 * Determinism is the whole point. Anything that would produce a different
 * byte sequence for "the same" logical input throws.
 */

export class CanonicalJSONError extends Error {
  constructor(message: string, public readonly path: string) {
    super(`${message} at ${path}`);
    this.name = "CanonicalJSONError";
  }
}

export function canonicalize(value: unknown, path = "$"): string {
  // null
  if (value === null) return "null";

  // booleans
  if (typeof value === "boolean") return value ? "true" : "false";

  // strings
  if (typeof value === "string") return JSON.stringify(value);

  // numbers: rejected. Force callers to use decimal strings.
  if (typeof value === "number") {
    throw new CanonicalJSONError(
      "numbers are not allowed in canonical mandates; pass amounts as decimal strings",
      path,
    );
  }

  // bigint, symbol, function, undefined
  if (typeof value === "bigint") {
    throw new CanonicalJSONError("bigint is not allowed", path);
  }
  if (typeof value === "symbol") {
    throw new CanonicalJSONError("symbol is not allowed", path);
  }
  if (typeof value === "function") {
    throw new CanonicalJSONError("function is not allowed", path);
  }
  if (typeof value === "undefined") {
    throw new CanonicalJSONError(
      "undefined is not allowed; use null or omit the key from the schema",
      path,
    );
  }

  // arrays
  if (Array.isArray(value)) {
    const parts = value.map((item, i) => canonicalize(item, `${path}[${i}]`));
    return "[" + parts.join(",") + "]";
  }

  // plain objects (we reject Dates, Maps, Sets, class instances)
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new CanonicalJSONError(
        `non-plain object (${value.constructor?.name ?? "unknown"}) is not allowed; convert to a plain object first`,
        path,
      );
    }

    const obj = value as Record<string, unknown>;
    // Object.keys gives own enumerable string keys. We sort by UTF-16 code unit.
    const keys = Object.keys(obj).sort();

    const parts = keys.map((k) => {
      const childPath = `${path}.${k}`;
      // Reject undefined values explicitly — easy mistake to make.
      if (obj[k] === undefined) {
        throw new CanonicalJSONError(
          `key "${k}" has undefined value; remove the key or set it to null`,
          childPath,
        );
      }
      return JSON.stringify(k) + ":" + canonicalize(obj[k], childPath);
    });

    return "{" + parts.join(",") + "}";
  }

  throw new CanonicalJSONError(
    `unsupported type ${typeof value}`,
    path,
  );
}

/**
 * Convenience: canonicalize a value and return UTF-8 bytes ready for signing.
 */
export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
