/**
 * Client-side Pi session + authenticated fetch.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The "unauthenticated" banner on the prediction screen isn't a bug in the
 * server — it's the expected result of the server change. Every route now
 * resolves the user from an `Authorization: Bearer <pi access token>` header
 * instead of trusting a userId in the request body. The client is still sending
 * bodies with userId and no header, so every call 401s.
 *
 * Rather than patch each fetch call, everything goes through apiFetch() here.
 * It attaches the token, and if the token is missing or has expired it
 * re-authenticates once and retries.
 *
 * ── INTEGRATION: ONE LINE ─────────────────────────────────────────────────
 *
 * In src/hooks/usePiAuth.ts, wherever Pi.authenticate resolves:
 *
 *     const auth = await window.Pi.authenticate(SCOPES, onIncompletePayment);
 *     setPiAccessToken(auth.accessToken);   // <- add this
 *
 * Then replace `fetch('/api/...')` with `apiFetch('/api/...')` across the app.
 */

/** Scopes PPA needs. `wallet_address` is deliberately absent — with redemption
 *  gone there is no A2U payout, so there's nothing to send Pi to, and not
 *  holding the permission is a privacy claim you can make honestly. */
export const PI_SCOPES = ['username', 'payments'] as const;

/**
 * How the current session was obtained.
 *
 * This is tracked explicitly rather than sniffed, because sniffing was wrong.
 * `isPiBrowser()` used to mean "window.Pi exists" — but the SDK script in
 * layout.tsx loads from sdk.minepi.com in *every* browser, so window.Pi is
 * defined on an ordinary desktop too. The object is there; the native bridge
 * behind it is not. Calling authenticate() against it hangs rather than
 * failing, which is what produced the fifteen-second "Connecting to Pi
 * Network..." screen for every visitor who arrived from outside Pi.
 *
 * 'pi-browser' sessions can be refreshed silently. 'web' sessions cannot:
 * Pi Sign-In's implicit flow issues no refresh token, so renewing means a
 * full round trip through accounts.pinet.com that the UI has to offer.
 */
export type SessionOrigin = 'pi-browser' | 'web';

let accessToken: string | null = null;
let sessionOrigin: SessionOrigin | null = null;

/** Where a web token is parked so a reload doesn't drop the session. */
const WEB_TOKEN_KEY = 'ppa_web_token';

/**
 * Pi Browser tokens are held in memory only. Losing one on reload costs a
 * single silent re-auth, so there is no reason to write it down.
 *
 * Web tokens are different: there is no silent re-auth to fall back on. Held
 * in memory alone, every refresh — and every accidental reload mid-quiz —
 * would bounce the player out to Pi and back. So a web token is mirrored into
 * sessionStorage, which dies with the tab and is not shared with other tabs
 * or windows.
 *
 * That is a deliberate trade and worth naming: a token in sessionStorage is
 * readable by any script that gets injected into the page, where a token in a
 * closure is not. It is scoped to one tab, it expires on its own, and it
 * grants username-level identity rather than payments — the scope Pi Sign-In
 * cannot issue. Against that, a full-page redirect on every reload is a worse
 * app and pushes people to stay signed out.
 */
export function setPiAccessToken(token: string | null, origin?: SessionOrigin): void {
  accessToken = token;
  if (origin) sessionOrigin = origin;
  if (token === null) sessionOrigin = null;

  if (typeof window === 'undefined') return;
  try {
    if (token && sessionOrigin === 'web') {
      window.sessionStorage.setItem(WEB_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(WEB_TOKEN_KEY);
    }
  } catch {
    // Private mode, or storage disabled. The in-memory token still works for
    // this page view; a reload will ask the player to sign in again.
  }
}

export function getPiAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(WEB_TOKEN_KEY);
    if (stored) {
      accessToken = stored;
      sessionOrigin = 'web';
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getSessionOrigin(): SessionOrigin | null {
  if (!sessionOrigin) getPiAccessToken(); // may restore a web session
  return sessionOrigin;
}

export function hasPiSession(): boolean {
  return getPiAccessToken() !== null;
}

/**
 * True only when the Pi SDK is genuinely usable — not merely present.
 *
 * Presence is established the only way that proves anything: an
 * authenticate() call that returned. Before that has happened, this reports
 * on the SDK object, which is the best guess available and is why callers
 * must still impose a timeout.
 */
export function isPiBrowser(): boolean {
  if (sessionOrigin === 'web') return false;
  return typeof window !== 'undefined' && Boolean((window as { Pi?: unknown }).Pi);
}

/** How long to wait on the SDK before deciding the bridge isn't there. */
const SDK_AUTH_TIMEOUT_MS = 6000;

/**
 * Re-authenticate and cache the token.
 *
 * Returns null for web sessions (nothing to refresh silently), outside Pi
 * Browser, if the user declines, or if the SDK stops responding. The timeout
 * is the part that matters: without it a non-Pi browser hangs here instead of
 * returning, and every screen that called apiFetch sits on a spinner.
 */
async function refreshSession(): Promise<string | null> {
  if (sessionOrigin === 'web') return null;
  if (!isPiBrowser()) return null;

  try {
    const Pi = (window as unknown as { Pi: { authenticate: (s: readonly string[], cb: (p: unknown) => void) => Promise<{ accessToken: string }> } }).Pi;
    const auth = await Promise.race([
      Pi.authenticate([...PI_SCOPES], () => {
        // Incomplete payment from a previous session. The top-up flow handles
        // completion; nothing to do here.
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SDK_AUTH_TIMEOUT_MS)),
    ]);
    if (!auth) return null;
    setPiAccessToken(auth.accessToken, 'pi-browser');
    return auth.accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

export class NotSignedInError extends Error {
  constructor(message = 'Sign in with Pi to continue.') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

/**
 * Thrown where an action needs the `payments` scope, which Pi Sign-In cannot
 * grant. Distinct from NotSignedInError because the player IS signed in —
 * sending them to sign in again would be a loop. They need Pi Browser.
 */
export class PiBrowserRequiredError extends Error {
  constructor(message = 'Open PPA in Pi Browser to pay with Pi.') {
    super(message);
    this.name = 'PiBrowserRequiredError';
  }
}

/**
 * fetch() with the Pi token attached.
 *
 * On a 401 it re-authenticates once and retries. A second 401 means the user
 * genuinely isn't signed in, and that surfaces as NotSignedInError so screens
 * can show a sign-in prompt rather than the raw word "unauthenticated".
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = async (token: string | null) => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  let response = await send(getPiAccessToken() ?? (await refreshSession()));

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new NotSignedInError();
    response = await send(refreshed);
    if (response.status === 401) throw new NotSignedInError();
  }

  return response;
}

/** apiFetch + JSON parse, throwing the server's message on failure. */
export async function apiJson<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(input, init);
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? 'Something went wrong.');
  }
  return data;
}
