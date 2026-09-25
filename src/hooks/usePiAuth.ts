"use client";

import { useState, useEffect, useCallback } from "react";
import { setPiAccessToken, apiFetch } from "@/lib/pi-session";

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

// Add near the top of the hook file
async function authenticateWithTimeout(
  scopes: string[],
  onIncompletePaymentFound: (p: unknown) => void,
  ms = 15000
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

    useEffect(() => {
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
   * Initialize Pi SDK and authenticate the user automatically on app load.
   * Detects Pi Browser by waiting for window.Pi to appear (the SDK is only
   * injected in Pi Browser). Falls through to public mode after 6 seconds
   * if the SDK never appears.
   */
  async function initPiAuth() {
    try {
      let attempts = 0;
      const maxAttempts = 20; // 20 × 300ms = 6 seconds
      while (!window.Pi && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 300));
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

      // Race authenticate against a 15-second timeout so regular browsers
      // that load the SDK script don't hang on a missing native bridge.
      const authResult = await Promise.race([
        window.Pi.authenticate(
          PI_SCOPES,
          onIncompletePaymentFound
        ),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);

      if (!authResult) {
        console.warn(
          "[usePiAuth] Pi.authenticate() timed out, falling back to public mode"
        );
        setStatus("public");
        setLoading(false);
        return;
      }

      await signInWithPi(authResult);
      setStatus("authenticated");
    } catch (err) {
      console.error("[usePiAuth] auth error:", err);
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
  async function signInWithPi(authResult: AuthResult) {
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
    setPiAccessToken(authResult.accessToken);

    setUser(data.user);
    cacheIdentity(data.user);
  }

  /**
   * Manual sign-in trigger. Used by the visible "Sign in with Pi" button
   * (required by Pi App Studio's verification flow, which waits for an
   * explicit Pi.authenticate call after the page loads).
   */
  const signIn = useCallback(async () => {
  setLoading(true);
  try {
    if (!window.Pi) {
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
      alert("Pi sign-in timed out. Please close and reopen the app, then try again.");
      return;
    }

    await signInWithPi(authResult);
    setStatus("authenticated");
  } catch (err) {
    console.error("[usePiAuth] manual signIn failed:", err);
    alert("Sign-in failed. Please try again.");
  } finally {
    setLoading(false);
  }
}, []);

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
      await signInWithPi(auth);
      setStatus("authenticated");
    } catch (err) {
      console.error("Force reauth failed:", err);
      window.location.reload();
    }
  }

  return { user, status, loading, signIn, signOut, forceReauth, updateUser, refreshUser };
}