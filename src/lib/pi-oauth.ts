/**
 * Pi Sign-In — the OAuth 2.0 path for browsers that are not Pi Browser.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Until now PPA could only be played inside Pi Browser, because the only way
 * in was `window.Pi.authenticate()` from the Pi SDK. Everyone else got a page
 * they could look at and not use. That is a hard ceiling on promotion: a link
 * posted anywhere outside Pi lands on a dead end.
 *
 * Pi Sign-In removes the ceiling. It is Pi's own OAuth 2.0 server at
 * accounts.pinet.com, spec-compliant, built for a site that "runs in an
 * ordinary browser (desktop or mobile)". This is the supported path, not a
 * workaround — and it keeps PPA inside the Mainnet listing requirement to
 * "Use Only Pi Authentication", which a Google or email login would break.
 *
 * ── THE ONE THING IT CANNOT DO ────────────────────────────────────────────
 *
 * The `payments` scope is NOT available to Pi Sign-In. Only `username` and
 * `wallet_address` are. So a web session can play, earn, rank and hold a
 * balance, but cannot buy PPA with Pi.
 *
 * That is not a gap to work around. It is a boundary to make visible: the
 * free game opens to everyone, the paid door stays inside Pi Browser. Every
 * payment entry point checks the session origin rather than offering a button
 * that fails when pressed.
 *
 * ── IMPLICIT FLOW, AND WHAT FOLLOWS FROM IT ───────────────────────────────
 *
 * Implicit is the only flow Pi Sign-In supports. No client secret is issued,
 * and there is no refresh token. The access token comes back in the URL
 * *fragment*, which browsers never send to the server — so the token is read
 * in the browser and handed to our own /api/auth/pi, which validates it
 * against GET api.minepi.com/v2/me exactly as it already validates an SDK
 * token. The server side needed no change at all.
 *
 * No refresh token means an expired web session cannot be renewed silently.
 * It has to go back through the authorize redirect. apiFetch() therefore does
 * not attempt a silent retry for web sessions — it surfaces NotSignedInError
 * and the UI offers the round trip.
 *
 * ── EVERYTHING HERE IS PURE ───────────────────────────────────────────────
 *
 * No window, no fetch, no storage. URL building, fragment parsing and the two
 * security checks are the parts worth getting exactly right, so they are the
 * parts that can be tested without a browser. The side effects live in
 * useWebSignIn() and the /auth/callback screen.
 *
 * Reference: https://github.com/pi-apps/pi-platform-docs/blob/master/pi-sign-in.md
 */

export const PI_OAUTH_AUTHORIZE_URL = "https://accounts.pinet.com/oauth/authorize";

/**
 * Scopes Pi Sign-In can grant.
 *
 * `payments` is deliberately absent because Pi does not offer it to this flow
 * — not because we chose to leave it out. Asking for it would fail the
 * authorize request outright.
 *
 * `wallet_address` is available and still not requested: redemption is gone,
 * there is no A2U payout, so there is nothing to send Pi to. Not holding the
 * permission is a privacy claim /privacy can make honestly.
 */
export const WEB_SCOPES = ["username"] as const;

/** Where the CSRF state and return path are parked across the redirect. */
export const STATE_KEY = "ppa_oauth_state";
export const RETURN_KEY = "ppa_oauth_return";

export interface AuthorizeParams {
  clientId: string;
  /** Must exactly match a Redirect URI registered in the Developer Portal. */
  redirectUri: string;
  /** Opaque value echoed back by Pi; compared on return. */
  state: string;
  scopes?: readonly string[];
}

/**
 * Build the URL that sends the browser to Pi to sign in.
 *
 * `response_type=token` selects the implicit flow. PKCE is handled by Pi's
 * server; there is nothing for us to attach.
 */
export function buildAuthorizeUrl(params: AuthorizeParams): string {
  if (!params.clientId) throw new Error("buildAuthorizeUrl: clientId is required");
  if (!params.redirectUri) throw new Error("buildAuthorizeUrl: redirectUri is required");
  if (!params.state) throw new Error("buildAuthorizeUrl: state is required");

  const url = new URL(PI_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", (params.scopes ?? WEB_SCOPES).join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

export type FragmentResult =
  | { ok: true; accessToken: string; state: string | null }
  | { ok: false; error: string };

/**
 * Read the access token out of the URL fragment Pi redirects back with.
 *
 * Accepts the fragment with or without its leading '#'. An `error` parameter
 * wins over everything else — a declined sign-in comes back as
 * `error=access_denied`, and treating that as "no token" would show a generic
 * failure instead of "you cancelled".
 */
export function parseAuthFragment(hash: string): FragmentResult {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.trim()) return { ok: false, error: "no_fragment" };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return { ok: false, error: "malformed_fragment" };
  }

  const error = params.get("error");
  if (error) return { ok: false, error };

  const accessToken = params.get("access_token");
  if (!accessToken) return { ok: false, error: "no_access_token" };

  return { ok: true, accessToken, state: params.get("state") };
}

/**
 * Constant-time-ish comparison of the returned state against the stored one.
 *
 * Without this check, a third party could feed a victim's browser a callback
 * URL carrying an attacker's token and sign them into the wrong account. The
 * state is generated before the redirect and must survive the round trip
 * unchanged. A missing stored state is a failure, not a pass — a callback
 * arriving with nothing stored means the flow did not start here.
 */
export function stateMatches(
  returned: string | null,
  stored: string | null,
): boolean {
  if (!returned || !stored) return false;
  if (returned.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < returned.length; i++) {
    diff |= returned.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Where to send the user after a successful callback.
 *
 * The classic bug in an OAuth callback is the open redirect: a `returnTo`
 * that is taken at face value and happens to point at someone else's site,
 * which turns our domain into a laundering step for a phishing link. Only a
 * same-site absolute path is allowed through.
 *
 * Rejected: anything with a scheme, protocol-relative '//evil.com' (a browser
 * reads that as a host, not a path), and backslash variants that some parsers
 * normalise into slashes.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  const v = value.trim();
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (v.includes("\\")) return fallback;
  // A scheme can only appear before the first '/', but check anyway — a value
  // like "/\t/evil.com" has been enough to fool naive checks elsewhere.
  if (/^\/[\s]*[a-z][a-z0-9+.-]*:/i.test(v)) return fallback;
  return v;
}

/** Opaque, unguessable state value. */
export function createOAuthState(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // Only reached in environments without WebCrypto, which the app never runs
  // in. Kept so importing this module can never throw.
  return Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0"),
  ).join("");
}

/**
 * The redirect URI to register in the Developer Portal, derived from wherever
 * the app is actually served. Keeping it derived rather than configured means
 * a preview deployment cannot silently send users to production.
 *
 * Production redirect URIs require a *verified domain* in the portal. Until
 * pappad.app is verified there, only loopback URIs (localhost, 127.0.0.1) are
 * accepted — which is exactly what local development uses, so the flow is
 * testable today and the production URI is one portal field away.
 */
export function callbackUrlFor(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}

/** Query flag that asks the canonical origin to begin sign-in on arrival. */
export const SIGNIN_FLAG = "pi_signin";

/**
 * One app, several domains, one registered callback.
 *
 * PPA answers on more than one host — `pappad.app` and `ppa-prod.vercel.app`
 * both serve the same deployment — but Pi accepts redirect URIs on the
 * project's verified app domain only. Registering a second host is refused
 * outright:
 *
 *   "https://pappadappnpn9819.pinet.com/auth/callback" — host must be
 *   ppa-prod.vercel.app or a loopback address.
 *
 * So a visitor who arrives on any other host cannot complete a sign-in from
 * there: Pi rejects the authorize request before they reach a password field.
 *
 * Nor can the redirect simply be pointed at the canonical host from here. The
 * CSRF state lives in sessionStorage, which is per-origin, so a flow that
 * starts on one host and returns to another finds nothing stored and is
 * correctly refused. Weakening that check to paper over a hosting detail
 * would be trading the one protection against token injection for tidiness.
 *
 * The honest move is to go to the canonical host first and sign in there.
 */
export function needsCanonicalHop(
  currentOrigin: string,
  canonicalOrigin: string | null | undefined,
): boolean {
  if (!canonicalOrigin) return false;
  return normaliseOrigin(currentOrigin) !== normaliseOrigin(canonicalOrigin);
}

function normaliseOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Where to send someone so they can sign in: the same page on the canonical
 * host, flagged to begin sign-in on arrival.
 *
 * The path is taken from our own location, never from input, and is passed
 * through safeReturnTo() anyway so this can't be turned into a redirect to
 * somewhere else.
 */
export function canonicalSignInUrl(
  canonicalOrigin: string,
  path: string,
  search = "",
): string {
  const base = normaliseOrigin(canonicalOrigin);
  const safePath = safeReturnTo(path);
  const url = new URL(base + safePath);
  if (search) {
    for (const [k, v] of new URLSearchParams(search)) {
      if (k !== SIGNIN_FLAG) url.searchParams.set(k, v);
    }
  }
  url.searchParams.set(SIGNIN_FLAG, "1");
  return url.toString();
}
