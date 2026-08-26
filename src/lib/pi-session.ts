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
 * Held in memory only.
 *
 * Deliberately not localStorage: an access token in storage survives the tab,
 * is readable by any script that gets injected, and Pi Browser keeps the
 * session anyway. Losing it on reload costs one silent re-auth.
 */
let accessToken: string | null = null;

export function setPiAccessToken(token: string | null): void {
  accessToken = token;
}

export function getPiAccessToken(): string | null {
  return accessToken;
}

export function hasPiSession(): boolean {
  return accessToken !== null;
}

/** True when running inside Pi Browser with the SDK present. */
export function isPiBrowser(): boolean {
  return typeof window !== 'undefined' && Boolean((window as { Pi?: unknown }).Pi);
}

/**
 * Re-authenticate and cache the token. Returns null outside Pi Browser or if
 * the user declines.
 */
async function refreshSession(): Promise<string | null> {
  if (!isPiBrowser()) return null;

  try {
    const Pi = (window as unknown as { Pi: { authenticate: (s: readonly string[], cb: (p: unknown) => void) => Promise<{ accessToken: string }> } }).Pi;
    const auth = await Pi.authenticate([...PI_SCOPES], () => {
      // Incomplete payment from a previous session. The top-up flow handles
      // completion; nothing to do here.
    });
    accessToken = auth.accessToken;
    return accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

export class NotSignedInError extends Error {
  constructor() {
    super('Open PPA in Pi Browser and sign in to continue.');
    this.name = 'NotSignedInError';
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

  let response = await send(accessToken ?? (await refreshSession()));

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
