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

export type AuthStatus = "loading" | "authenticated" | "requires_pi_browser";

export function usePiAuth() {
  const [user, setUser] = useState<PPAUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("ppa_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Invalidate cache if piUserId doesn't look like a Pi UUID — old rows
        // had username stored in piUserId, which breaks A2U. Force re-auth so
        // the user is upserted with the real uid AND grants wallet_address.
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
        // Otherwise clear cache and fall through to re-auth
        localStorage.removeItem("ppa_user");
      } catch {
        localStorage.removeItem("ppa_user");
      }
    }
    initPiAuth();
  }, []);

  async function initPiAuth() {
    try {
      let attempts = 0;
      while (!window.Pi && attempts < 30) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
      }

      if (!window.Pi) {
        setStatus("requires_pi_browser");
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
      setStatus("requires_pi_browser");
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
    localStorage.removeItem("ppa_user");
    setUser(null);
    setStatus("requires_pi_browser");
  }

  return { user, status, loading, signOut, updateUser };
}