"use client";

/**
 * Starting the Pi Sign-In round trip.
 *
 * The decisions worth testing live in pi-oauth.ts, which is pure. This file
 * is the thin layer that touches sessionStorage and the address bar, kept
 * separate so that "does the URL have the right parameters" is answerable
 * without a browser.
 */

import {
  buildAuthorizeUrl,
  callbackUrlFor,
  createOAuthState,
  RETURN_KEY,
  STATE_KEY,
  WEB_SCOPES,
} from "./pi-oauth";

/**
 * The Developer Portal issues a client_id only — no secret, because the
 * implicit flow has nowhere safe to keep one. It is public by construction
 * and travels in the authorize URL, so NEXT_PUBLIC_ is correct rather than
 * careless.
 *
 * Referenced statically because Next inlines these at build time; a dynamic
 * lookup like process.env[name] is not replaced and reads as undefined in the
 * browser.
 */
export function piClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_PI_CLIENT_ID;
  return id && id.trim().length > 0 ? id.trim() : null;
}

/** True when the deployment is configured for Pi Sign-In. */
export function webSignInConfigured(): boolean {
  return piClientId() !== null;
}

export class WebSignInUnavailableError extends Error {
  constructor() {
    super(
      "Pi Sign-In is not configured for this deployment. Set NEXT_PUBLIC_PI_CLIENT_ID " +
        "to the oAuth Client ID from the Developer Portal (Pi Sign-In screen).",
    );
    this.name = "WebSignInUnavailableError";
  }
}

/**
 * Send the browser to Pi to sign in, and arrange to come back here.
 *
 * `returnTo` defaults to the current path, so a player who presses sign in
 * halfway down the leaderboard returns to the leaderboard rather than the
 * home screen. It is stored rather than put in the URL: anything in the
 * authorize URL has to match a registered redirect URI exactly, and anything
 * we read back out of a URL is attacker-controlled. sessionStorage is neither.
 */
export function startWebSignIn(returnTo?: string): void {
  const clientId = piClientId();
  if (!clientId) throw new WebSignInUnavailableError();

  const state = createOAuthState();
  const destination =
    returnTo ?? `${window.location.pathname}${window.location.search}`;

  try {
    window.sessionStorage.setItem(STATE_KEY, state);
    window.sessionStorage.setItem(RETURN_KEY, destination);
  } catch {
    // Storage blocked. Without a stored state the callback will refuse the
    // sign-in rather than accept an unverifiable one, so fail here where the
    // message can be useful instead of after a round trip.
    throw new Error(
      "Pi Sign-In needs session storage, which this browser has blocked. " +
        "Turn off private mode or allow site data, then try again.",
    );
  }

  window.location.assign(
    buildAuthorizeUrl({
      clientId,
      redirectUri: callbackUrlFor(window.location.origin),
      state,
      scopes: WEB_SCOPES,
    }),
  );
}
