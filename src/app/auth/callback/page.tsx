"use client";

/**
 * /auth/callback — where Pi Sign-In comes back to.
 *
 * Pi's implicit flow returns the access token in the URL *fragment*, which a
 * browser never sends to a server. So this has to be a client screen: it
 * reads the fragment, checks it, and hands the token to the auth context,
 * which puts it through the same /api/auth/pi the Pi Browser path uses.
 *
 * ── THE ORDER OF OPERATIONS IS THE SECURITY ───────────────────────────────
 *
 * 1. Read the fragment.
 * 2. Strip it from the address bar immediately, before any network call. An
 *    access token sitting in location.hash ends up in session history and in
 *    anything that later reads the URL. It should exist in the address bar
 *    for as close to zero time as possible.
 * 3. Compare the returned state to the one stored before the redirect. A
 *    callback with no stored state is refused rather than trusted: that is
 *    precisely the shape of someone handing a victim a link carrying their
 *    own token, to sign that victim into an account the attacker controls.
 * 4. Only then exchange the token.
 *
 * The return path is read from sessionStorage and passed through
 * safeReturnTo(), so a poisoned value cannot turn this screen into an open
 * redirect for a phishing link.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  parseAuthFragment,
  safeReturnTo,
  stateMatches,
  RETURN_KEY,
  STATE_KEY,
} from "@/lib/pi-oauth";

type Phase =
  | { kind: "working" }
  | { kind: "failed"; title: string; detail: string; canRetry: boolean };

/** Pi's error codes, in words a player can act on. */
function describe(error: string): { title: string; detail: string; canRetry: boolean } {
  switch (error) {
    case "access_denied":
      return {
        title: "Sign-in cancelled",
        detail: "You didn't approve the request, so nothing was shared with PPA.",
        canRetry: true,
      };
    case "state_mismatch":
      return {
        title: "That sign-in link didn't come from here",
        detail:
          "The security check failed, so it was refused. Start the sign-in from PPA itself rather than from a link someone sent you.",
        canRetry: true,
      };
    case "no_fragment":
    case "no_access_token":
      return {
        title: "Nothing came back from Pi",
        detail: "The sign-in didn't complete. This usually means the page was opened directly.",
        canRetry: true,
      };
    case "exchange_failed":
      return {
        title: "Pi couldn't confirm that sign-in",
        detail: "The token came back but Pi didn't recognise it. Trying again usually works.",
        canRetry: true,
      };
    case "invalid_scope":
      return {
        title: "PPA asked for the wrong permissions",
        detail: "That's a configuration problem on our side, not something you can fix.",
        canRetry: false,
      };
    default:
      return {
        title: "Sign-in didn't complete",
        detail: `Pi returned: ${error}`,
        canRetry: true,
      };
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { completeWebSignIn, signInWithWeb, webSignInAvailable } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  // React runs effects twice in development. The token is single-use, so a
  // second exchange would fail and show an error on a sign-in that worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const hash = window.location.hash;
    const result = parseAuthFragment(hash);

    // Strip the fragment before anything else happens with it.
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // Non-fatal; the navigation below replaces the URL anyway.
    }

    const storedState = (() => {
      try {
        return window.sessionStorage.getItem(STATE_KEY);
      } catch {
        return null;
      }
    })();

    const returnTo = safeReturnTo(
      (() => {
        try {
          return window.sessionStorage.getItem(RETURN_KEY);
        } catch {
          return null;
        }
      })(),
    );

    const clearStash = () => {
      try {
        window.sessionStorage.removeItem(STATE_KEY);
        window.sessionStorage.removeItem(RETURN_KEY);
      } catch {
        // ignore
      }
    };

    if (!result.ok) {
      clearStash();
      setPhase({ kind: "failed", ...describe(result.error) });
      return;
    }

    if (!stateMatches(result.state, storedState)) {
      clearStash();
      setPhase({ kind: "failed", ...describe("state_mismatch") });
      return;
    }

    clearStash();

    completeWebSignIn(result.accessToken)
      .then(() => router.replace(returnTo))
      .catch(() => setPhase({ kind: "failed", ...describe("exchange_failed") }));
  }, [completeWebSignIn, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        background: "var(--bg-primary)",
      }}
    >
      {phase.kind === "working" ? (
        <>
          <div style={{ fontSize: 40, marginBottom: 16 }}>π</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Finishing sign-in
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            One moment.
          </p>
        </>
      ) : (
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
            {phase.title}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {phase.detail}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {phase.canRetry && webSignInAvailable && (
              <button
                onClick={() => signInWithWeb("/")}
                style={{
                  padding: "12px 20px",
                  borderRadius: 12,
                  background: "var(--accent-primary)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try signing in again
              </button>
            )}
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "12px 20px",
                borderRadius: 12,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Back to PPA
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
