"use client";

import { useState, useEffect, useCallback } from "react";
import {
  setPiAccessToken,
  getPiAccessToken,
  getSessionOrigin,
  apiFetch,
  type SessionOrigin,
} from "@/lib/pi-session";
import { startWebSignIn, webSignInConfigured } from "@/lib/web-signin";

export interface PPAUser {
  id: string;
  piUserId: string;
  username: string;
  ppaBalance: number;
  accuracyRate: number;
  reputationScore: number;
  streakDays: number;
  tier: string;
  totalPredictions: number;
  correctPredictions: number;
  totalChallenges: number;
  correctChallenges: number;
}

/**
 * How long to wait on Pi.authenticate() before deciding the native bridge
 * isn't there. The SDK object exists in every browser, so this timeout — not
 * the presence of window.Pi — is what actually distinguishes Pi Browser.
 */
const SDK_TIMEOUT_MS = 6000;

// Add near the top of the hook file
async function authenticateWithTimeout(
  scopes: string[],
  onIncompletePaymentFound: (p: unknown) => void,
  ms = SDK_TIMEOUT_MS
): Promise<AuthResult | null> {
  return Promise.race([
    window.Pi!.authenticate(scopes, onIncompletePaymentFound),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

interface AuthResult {
  user: { uid: string; username: string };
  accessToken: string;
}

declare global {
  interface Window {
    Pi?: {
      // init may be sync (legacy) or return a Promise (current docs).
      // We treat the return as PromiseLike so awaiting is always safe.
      init: (config: {
        version: string;
        sandbox?: boolean;
      }) => void | Promise<void>;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: unknown) => void
      ) => Promise<AuthResult>;
      createPayment: (
        paymentData: {
          amount: number;
          memo: string;
          metadata: Record<string, unknown>;
        },
        callbacks: {
          onReadyForServerApproval: (paymentId: string) => void;
          onReadyForServerCompletion: (
            paymentId: string,
            txid: string
          ) => void;
          onCancel: (paymentId: string) => void;
          onError: (error: Error, payment?: unknown) => void;
        }
      ) => void;
    };
  }
}

export type AuthStatus = "loading" | "authenticated" | "public";

/**
 * Scopes PPA requests.
 *
 * `wallet_address` was dropped when redemption was removed: there is no A2U
 * payout any more, so there is nothing to send Pi to. Not holding the
 * permission is also a privacy claim the policy can make honestly, and it is
 * what the permanent "Re-authorize Pi access" card in Profile was asking for.
 */
const PI_SCOPES = ["username", "payments"];

export function usePiAuth() {
  const [user, setUser] = useState<PPAUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [loading, setLoading] = useState(true);
  /**
   * How this session was obtained. Payments need the `payments` scope, which
   * Pi Sign-In cannot grant, so every top-up entry point reads this rather
   * than guessing from the presence of window.Pi.
   */
  const [origin, setOrigin] = useState<SessionOrigin | null>(null);

    useEffect(() => {
    // A web session parked in sessionStorage survives a reload. Restore it
    // before anything touches the SDK, so a signed-in web player is never
    // sent through Pi Browser detection they cannot pass.
    const restored = getPiAccessToken();
    if (restored && getSessionOrigin() === "web") {
      setOrigin("web");
    }

    const cached = localStorage.getItem("ppa_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Take the SERVER's record, not the cached one. The cache is only a
        // hint about who we are; every field comes back fresh.
        fetch(`/api/user/${parsed.id}`)
          .then(async (r) => {
            if (!r.ok) throw new Error("stale");
            const data = await r.json();
            const fresh = (data.user ?? data) as PPAUser;
            if (!fresh?.id) throw new Error("stale");
            setUser(fresh);
            setStatus("authenticated");
          })
          .catch(() => {
            localStorage.removeItem("ppa_user");
            initPiAuth(); // fall through to fresh Pi auth
          })
          .finally(() => setLoading(false));
        return;
      } catch {
        // Cache wasn't valid JSON.
        localStorage.removeItem("ppa_user");
      }
    }
    initPiAuth();
  }, []);
  
  /**
   * Try to sign in through the Pi SDK, then fall back to public mode.
   *
   * ── WHY THE OLD TIMINGS WERE WRONG ────────────────────────────────────
   *
   * This used to wait up to 6 seconds for window.Pi to appear, "because the
   * SDK is only injected in Pi Browser". It isn't. layout.tsx loads
   * sdk.minepi.com/pi-sdk.js in every browser, so window.Pi appears almost
   * immediately on an ordinary desktop too — the object is there, the native
   * bridge behind it is not. The poll therefore succeeded, authenticate() was
   * called against nothing, and the real wait was the 15-second timeout
   * underneath it.
   *
   * Fifteen seconds of "Connecting to Pi Network..." is what every visitor
   * arriving from a link outside Pi saw before being told to use a different
   * browser. Most of them left during it.
   *
   * Now: a short poll, a short authenticate timeout, and — in
   * PiBrowserBanner — the app renders while this runs instead of holding a
   * full-screen loader in front of it. Someone who lands here sees PPA, and
   * signs in when they choose to.
   */
  async function initPiAuth() {
    try {
      // A restored web session needs no SDK and must not be sent looking for
      // one; it is already signed in, or its token has expired and the fix is
      // another Pi Sign-In round trip, not Pi Browser.
      if (getSessionOrigin() === "web") {
        setStatus("public");
        setLoading(false);
        return;
      }

      let attempts = 0;
      const maxAttempts = 8; // 8 × 150ms = 1.2 seconds
      while (!window.Pi && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 150));
        attempts++;
      }

      if (!window.Pi) {
        setStatus("public");
        setLoading(false);
        return;
      }

      // Pi.init may be sync or return a Promise depending on SDK version.
      // Promise.resolve(...) handles both — `await` is safe either way.
      await Promise.resolve(
        window.Pi.init({
          version: "2.0",
          sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
        })
      );

      // The SDK object exists in every browser. Only a returned authenticate
      // call proves the bridge behind it is real, so this races a timeout
      // short enough that a visitor outside Pi Browser is not kept waiting.
      const authResult = await Promise.race([
        window.Pi.authenticate(
          PI_SCOPES,
          onIncompletePaymentFound
        ),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SDK_TIMEOUT_MS)),
      ]);

      if (!authResult) {
        setStatus("public");
        setLoading(false);
        return;
      }

      await signInWithPi(authResult, "pi-browser");
      setStatus("authenticated");
    } catch {
      // Not an error worth logging: outside Pi Browser this is the normal
      // path, and a console error on every ordinary visit is noise that
      // hides the real ones.
      setStatus("public");
    } finally {
      setLoading(false);
    }
  }

  async function onIncompletePaymentFound(payment: unknown) {
  console.log("Incomplete payment found:", payment);
  const p = payment as {
    identifier: string;
    transaction?: { txid?: string } | null;
  };
  try {
    if (p.transaction?.txid) {
      // Payment already has a blockchain tx — complete it server-side
      await apiFetch("/api/payments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: p.identifier, txid: p.transaction.txid }),
      });
    } else {
      await apiFetch("/api/payments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: p.identifier }),
      });
    }
  } catch (e) {
    console.error("Incomplete payment handling failed:", e);
  }
}

  /**
   * Send the Pi accessToken to the backend. The backend validates it
   * via GET https://api.minepi.com/v2/me and is the only source of
   * truth for the resolved user record.
   */
  async function signInWithPi(authResult: AuthResult, how: SessionOrigin) {
    const res = await fetch("/api/auth/pi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: authResult.accessToken,
        // Hint for new-user creation only; backend re-derives from /v2/me.
        hintUsername: authResult.user.username,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Auth failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    if (!data.user) {
      throw new Error("Auth response missing user");
    }

    // THE FIX FOR EVERY 401.
    // The token was previously sent to /api/auth/pi and then discarded, so
    // nothing could authenticate afterwards. Every route now resolves the user
    // from this token; apiFetch() reads it from here.
    setPiAccessToken(authResult.accessToken, how);
    setOrigin(how);

    setUser(data.user);
    cacheIdentity(data.user);
  }

  /**
   * Send the browser to Pi to sign in. Returns only in the failure case —
   * on success the page is replaced by Pi's, and /auth/callback finishes the
   * job when it comes back.
   */
  const signInWithWeb = useCallback((returnTo?: string) => {
    startWebSignIn(returnTo);
  }, []);

  /**
   * Finish a Pi Sign-In round trip.
   *
   * Called by /auth/callback with the token read out of the URL fragment.
   * It goes through the same /api/auth/pi the SDK path uses — the server
   * validates both the same way, against GET api.minepi.com/v2/me, so there
   * is one identity path and not two.
   *
   * Doing this through the hook rather than inside the callback screen is
   * what keeps the session live: the screen writing to localStorage would
   * leave AuthProvider, already mounted, still believing nobody is signed in.
   */
  const completeWebSignIn = useCallback(async (accessToken: string, username?: string) => {
    setLoading(true);
    try {
      await signInWithPi(
        { accessToken, user: { uid: "", username: username ?? "" } },
        "web",
      );
      setStatus("authenticated");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Manual sign-in trigger. Used by the visible "Sign in with Pi" button
   * (required by Pi App Studio's verification flow, which waits for an
   * explicit Pi.authenticate call after the page loads).
   *
   * Tries the SDK first and falls through to the Pi Sign-In redirect when it
   * doesn't answer. The order matters: inside Pi Browser the SDK is one tap
   * and no page change, so sending a Pioneer who is already signed in to Pi
   * out to accounts.pinet.com would be the worse flow. Outside Pi Browser the
   * SDK object still exists but never answers, which is what the timeout is
   * for — and the redirect is then a real way in rather than an apology.
   */
  const fallbackToWeb = useCallback((): boolean => {
    if (!webSignInConfigured()) return false;
    startWebSignIn();
    return true;
  }, []);

  const signIn = useCallback(async () => {
  setLoading(true);
  try {
    if (!window.Pi) {
      if (fallbackToWeb()) return;
      setStatus("public");
      return;
    }

    await Promise.resolve(
      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      })
    );

    const authResult = await authenticateWithTimeout(
      PI_SCOPES,
      onIncompletePaymentFound
    );

    if (!authResult) {
      // The SDK object was present but nothing answered — an ordinary browser
      // that loaded pi-sdk.js, not Pi Browser. Offer the door that works.
      if (fallbackToWeb()) return;
      alert("Pi sign-in timed out. Please close and reopen the app, then try again.");
      return;
    }

    await signInWithPi(authResult, "pi-browser");
    setStatus("authenticated");
  } catch (err) {
    console.error("[usePiAuth] manual signIn failed:", err);
    if (fallbackToWeb()) return;
    alert("Sign-in failed. Please try again.");
  } finally {
    setLoading(false);
  }
}, [fallbackToWeb]);

  /**
   * Cache identity only — never the balance.
   *
   * The previous version stored the whole user object, balance included, and
   * on reload displayed the cached number. That made the balance both stale and
   * trivially editable from devtools. Balances now always come from the server.
   */
  function cacheIdentity(u: PPAUser) {
    localStorage.setItem(
      "ppa_user",
      JSON.stringify({ id: u.id, piUserId: u.piUserId, username: u.username }),
    );
  }

  function updateUser(updatedUser: PPAUser) {
    setUser(updatedUser);
    cacheIdentity(updatedUser);
  }

  /** Re-read the authoritative user record. Call after anything that moves PPA. */
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const fresh = (data.user ?? data) as PPAUser;
      if (fresh?.id) {
        setUser(fresh);
        cacheIdentity(fresh);
      }
    } catch {
      // Non-fatal: the screen keeps the value it has.
    }
  }, [user?.id]);

  function signOut() {
    try {
      localStorage.removeItem("ppa_user");
      Object.keys(localStorage).forEach((k) => {
        if (
          k.toLowerCase().includes("pi_") ||
          k.toLowerCase().includes("ppa_")
        ) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch {
      // non-fatal
    }
    setPiAccessToken(null);
    setOrigin(null);
    setUser(null);
    setStatus("public");
  }

  async function forceReauth() {
    signOut();

    if (typeof window === "undefined" || !window.Pi) {
      window.location.reload();
      return;
    }

    try {
      await Promise.resolve(
        window.Pi.init({
          version: "2.0",
          sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
        })
      );
      await new Promise((r) => setTimeout(r, 300));

      const auth = await window.Pi.authenticate(
        PI_SCOPES,
        onIncompletePaymentFound
      );
      await signInWithPi(auth, "pi-browser");
      setStatus("authenticated");
    } catch (err) {
      console.error("Force reauth failed:", err);
      window.location.reload();
    }
  }

  return {
    user,
    status,
    loading,
    /** How this session was obtained; null when nobody is signed in. */
    origin,
    /** True when Pi payments are possible — i.e. the session came from Pi Browser. */
    canPay: origin === "pi-browser",
    /** True when this deployment has a Pi Sign-In client ID configured. */
    webSignInAvailable: webSignInConfigured(),
    signIn,
    signInWithWeb,
    completeWebSignIn,
    signOut,
    forceReauth,
    updateUser,
    refreshUser,
  };
}