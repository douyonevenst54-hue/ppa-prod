"use client";

import { useState, useEffect } from "react";

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

interface AuthResult {
  user: { uid: string; username: string };
  accessToken: string;
}

declare global {
  interface Window {
    Pi?: {
      init: (config: { version: string; sandbox?: boolean }) => void;
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
          onReadyForServerCompletion: (paymentId: string, txid: string) => void;
          onCancel: (paymentId: string) => void;
          onError: (error: Error, payment?: unknown) => void;
        }
      ) => void;
    };
  }
}

// "public" = browsing outside Pi Browser. App is fully accessible, but
// actions requiring Pi SDK (login, payments) are gated at the action level.
export type AuthStatus = "loading" | "authenticated" | "public";

export function usePiAuth() {
  const [user, setUser] = useState<PPAUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("ppa_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const looksLikeUuid = /^[a-f0-9-]{36}$/i.test(parsed.piUserId || "");
        if (
          parsed.piUserId &&
          !parsed.piUserId.startsWith("demo_") &&
          parsed.piUserId !== "demo_guest" &&
          looksLikeUuid
        ) {
          setUser(parsed);
          setStatus("authenticated");
          setLoading(false);
          return;
        }
        localStorage.removeItem("ppa_user");
      } catch {
        localStorage.removeItem("ppa_user");
      }
    }
    initPiAuth();
  }, []);

  async function initPiAuth() {
    try {
      // Detect Pi Browser via user agent. The SDK script loads in any
      // browser, but only Pi Browser has the native bridge that makes
      // pi.authenticate() actually resolve. Without this check, plain
      // browsers hang on authenticate() for 2 minutes before timing out.
      const isPiBrowser =
        typeof navigator !== "undefined" &&
        /PiBrowser/i.test(navigator.userAgent);

      if (!isPiBrowser) {
        setStatus("public");
        setLoading(false);
        return;
      }

      // Wait for SDK to inject (Pi Browser only)
      let attempts = 0;
      while (!window.Pi && attempts < 30) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
      }

      if (!window.Pi) {
        setStatus("public");
        setLoading(false);
        return;
      }

      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      });

      await new Promise(r => setTimeout(r, 500));

      const auth = await window.Pi.authenticate(
        ["username", "payments", "wallet_address"],
        async (payment) => {
          console.log("Incomplete payment found:", payment);
          try {
            await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: (payment as { identifier: string }).identifier,
              }),
            });
          } catch (e) {
            console.error("Incomplete payment handling failed:", e);
          }
        }
      );

      await signInWithPi(auth.user.uid, auth.user.username);
      setStatus("authenticated");

    } catch (err) {
      console.error("Pi auth error:", err);
      setStatus("public");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPi(piUserId: string, username: string) {
    const res = await fetch("/api/auth/pi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piUserId, username }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      localStorage.setItem("ppa_user", JSON.stringify(data.user));
    } else {
      throw new Error("Failed to authenticate");
    }
  }

  function updateUser(updatedUser: PPAUser) {
    setUser(updatedUser);
    localStorage.setItem("ppa_user", JSON.stringify(updatedUser));
  }

  function signOut() {
    try {
      localStorage.removeItem("ppa_user");
      Object.keys(localStorage).forEach((k) => {
        if (k.toLowerCase().includes("pi_") || k.toLowerCase().includes("ppa_")) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch {
      // non-fatal
    }
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
      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      });
      await new Promise((r) => setTimeout(r, 300));

      const auth = await window.Pi.authenticate(
        ["username", "payments", "wallet_address"],
        async (payment) => {
          try {
            await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: (payment as { identifier: string }).identifier,
              }),
            });
          } catch (e) {
            console.error("Incomplete payment handling failed:", e);
          }
        },
      );
      await signInWithPi(auth.user.uid, auth.user.username);
      setStatus("authenticated");
    } catch (err) {
      console.error("Force reauth failed:", err);
      window.location.reload();
    }
  }

  return { user, status, loading, signOut, forceReauth, updateUser };
}