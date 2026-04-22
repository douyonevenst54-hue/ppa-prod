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

export function usePiAuth() {
  const [user, setUser] = useState<PPAUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("ppa_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Don't use cached guest accounts — always re-auth
        if (parsed.username !== "Guest" && parsed.username !== "Demo_User") {
          setUser(parsed);
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem("ppa_user");
      }
    }
    initPiAuth();
  }, []);

  async function initPiAuth() {
    try {
      // Wait for Pi SDK to load
      let attempts = 0;
      while (!window.Pi && attempts < 30) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
      }

      if (!window.Pi) {
        // Not in Pi Browser — use guest mode
        await signInDemo();
        return;
      }

      // Initialize Pi SDK
      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      });

      // Small delay after init
      await new Promise(r => setTimeout(r, 500));

      // Authenticate with Pi
      const auth = await window.Pi.authenticate(
        ["username"],
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

      // Sign in with real Pi credentials
      await signInWithPi(auth.user.uid, auth.user.username);

    } catch (err) {
      console.error("Pi auth error:", err);
      if (!window.Pi) {
        await signInDemo();
      } else {
        setError("Pi authentication failed. Please reload and try again.");
        setLoading(false);
      }
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

  async function signInDemo() {
    try {
      const res = await fetch("/api/auth/pi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          piUserId: "demo_guest",
          username: "Guest",
        }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("ppa_user", JSON.stringify(data.user));
      }
    } catch {
      setError("Failed to sign in");
    }
  }

  function signOut() {
    localStorage.removeItem("ppa_user");
    setUser(null);
  }

  return { user, loading, error, signOut };
}