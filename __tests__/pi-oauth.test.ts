import { describe, it, expect } from "vitest";
import {
  PI_OAUTH_AUTHORIZE_URL,
  WEB_SCOPES,
  buildAuthorizeUrl,
  parseAuthFragment,
  stateMatches,
  safeReturnTo,
  createOAuthState,
  callbackUrlFor,
} from "@/lib/pi-oauth";

describe("WEB_SCOPES", () => {
  it("does not request payments, which Pi Sign-In cannot grant", () => {
    // Asking for it would fail the authorize request outright. This test is
    // here so that a future "why can't web users top up?" is answered by a
    // failing test rather than by adding the scope back.
    expect(WEB_SCOPES).not.toContain("payments");
  });

  it("requests username, which is what identifies the player", () => {
    expect(WEB_SCOPES).toContain("username");
  });
});

describe("buildAuthorizeUrl", () => {
  const base = {
    clientId: "test-client",
    redirectUri: "https://pappad.app/auth/callback",
    state: "abc123",
  };

  it("targets Pi's OAuth server", () => {
    expect(buildAuthorizeUrl(base).startsWith(PI_OAUTH_AUTHORIZE_URL)).toBe(true);
  });

  it("selects the implicit flow", () => {
    const url = new URL(buildAuthorizeUrl(base));
    // Implicit is the only flow Pi Sign-In supports.
    expect(url.searchParams.get("response_type")).toBe("token");
  });

  it("carries client_id, redirect_uri, scope and state", () => {
    const url = new URL(buildAuthorizeUrl(base));
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://pappad.app/auth/callback");
    expect(url.searchParams.get("scope")).toBe("username");
    expect(url.searchParams.get("state")).toBe("abc123");
  });

  it("space-separates multiple scopes", () => {
    const url = new URL(buildAuthorizeUrl({ ...base, scopes: ["username", "wallet_address"] }));
    expect(url.searchParams.get("scope")).toBe("username wallet_address");
  });

  it("encodes the redirect URI rather than emitting it raw", () => {
    const raw = buildAuthorizeUrl(base);
    expect(raw).toContain("redirect_uri=https%3A%2F%2Fpappad.app%2Fauth%2Fcallback");
  });

  it("refuses to build without the pieces Pi requires", () => {
    expect(() => buildAuthorizeUrl({ ...base, clientId: "" })).toThrow(/clientId/);
    expect(() => buildAuthorizeUrl({ ...base, redirectUri: "" })).toThrow(/redirectUri/);
    expect(() => buildAuthorizeUrl({ ...base, state: "" })).toThrow(/state/);
  });
});

describe("parseAuthFragment", () => {
  it("reads a token out of the fragment, with or without the hash", () => {
    const withHash = parseAuthFragment("#access_token=tok123&state=s1");
    const without = parseAuthFragment("access_token=tok123&state=s1");
    expect(withHash).toEqual({ ok: true, accessToken: "tok123", state: "s1" });
    expect(without).toEqual({ ok: true, accessToken: "tok123", state: "s1" });
  });

  it("reports a declined sign-in as the error Pi sent, not a generic failure", () => {
    // The user pressing "cancel" and the flow breaking are different events
    // and deserve different screens.
    expect(parseAuthFragment("#error=access_denied&state=s1")).toEqual({
      ok: false,
      error: "access_denied",
    });
  });

  it("prefers an error over a token when both somehow appear", () => {
    const result = parseAuthFragment("#error=invalid_scope&access_token=tok");
    expect(result.ok).toBe(false);
  });

  it("treats an empty or token-less fragment as a failure", () => {
    expect(parseAuthFragment("").ok).toBe(false);
    expect(parseAuthFragment("#").ok).toBe(false);
    expect(parseAuthFragment("#state=s1").ok).toBe(false);
  });

  it("returns a null state rather than throwing when Pi omits it", () => {
    expect(parseAuthFragment("#access_token=tok")).toEqual({
      ok: true,
      accessToken: "tok",
      state: null,
    });
  });

  it("decodes percent-encoded token characters", () => {
    const result = parseAuthFragment("#access_token=a%2Bb%2Fc%3D");
    expect(result.ok && result.accessToken).toBe("a+b/c=");
  });
});

describe("stateMatches", () => {
  it("accepts an unchanged round trip", () => {
    expect(stateMatches("abc123", "abc123")).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(stateMatches("abc123", "abc124")).toBe(false);
  });

  it("rejects a missing stored state", () => {
    // A callback arriving with nothing stored means the flow did not start
    // here — which is exactly the shape of a token-injection attempt.
    expect(stateMatches("abc123", null)).toBe(false);
    expect(stateMatches("abc123", "")).toBe(false);
  });

  it("rejects a missing returned state", () => {
    expect(stateMatches(null, "abc123")).toBe(false);
    expect(stateMatches("", "abc123")).toBe(false);
  });

  it("rejects a prefix of the stored state", () => {
    expect(stateMatches("abc", "abc123")).toBe(false);
  });
});

describe("safeReturnTo", () => {
  it("allows a same-site path", () => {
    expect(safeReturnTo("/challenges/daily")).toBe("/challenges/daily");
    expect(safeReturnTo("/profile?tab=privacy")).toBe("/profile?tab=privacy");
  });

  it("falls back when there is nothing stored", () => {
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("refuses an absolute URL to another site", () => {
    expect(safeReturnTo("https://evil.example/steal")).toBe("/");
    expect(safeReturnTo("http://evil.example")).toBe("/");
  });

  it("refuses a protocol-relative URL", () => {
    // Browsers read //evil.example as a host, not a path. This is the one
    // that slips past a naive startsWith("/") check.
    expect(safeReturnTo("//evil.example/steal")).toBe("/");
  });

  it("refuses backslash variants", () => {
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo("/path\\to")).toBe("/");
  });

  it("refuses a scheme smuggled behind whitespace", () => {
    expect(safeReturnTo("/\tjavascript:alert(1)")).toBe("/");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeReturnTo("https://evil.example", "/home")).toBe("/home");
  });
});

describe("createOAuthState", () => {
  it("produces a long opaque value", () => {
    expect(createOAuthState().length).toBeGreaterThanOrEqual(32);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, () => createOAuthState()));
    expect(seen.size).toBe(200);
  });

  it("contains no dashes, so it survives a URL round trip unencoded", () => {
    expect(createOAuthState()).toMatch(/^[0-9a-f]+$/);
  });
});

describe("callbackUrlFor", () => {
  it("derives the callback from the serving origin", () => {
    expect(callbackUrlFor("https://pappad.app")).toBe("https://pappad.app/auth/callback");
  });

  it("tolerates a trailing slash", () => {
    expect(callbackUrlFor("https://pappad.app/")).toBe("https://pappad.app/auth/callback");
  });

  it("works for the loopback origins Pi accepts before domain verification", () => {
    expect(callbackUrlFor("http://localhost:3000")).toBe("http://localhost:3000/auth/callback");
  });
});
