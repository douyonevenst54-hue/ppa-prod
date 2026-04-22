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
        setUser(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem("ppa_user");
      }
    }
    initPiAuth();
  }, []);

  async function initPiAuth() {
    try {
      let attempts = 0;
      while (!window.Pi && attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      if (!window.Pi) {
        await signInDemo();
        return;
      }

      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      });

      const auth = await window.Pi.authenticate(
        ["username"],
        handleIncompletePayment
      );

      await signInWithPi(auth.user.uid, auth.user.username);
    } catch (err) {
      console.error("Pi auth error:", err);
      await signInDemo();
    } finally {
      setLoading(false);
    }
  }

  function handleIncompletePayment(payment: unknown) {
    console.log("Incomplete payment found:", payment);
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
          piUserId: "demo_" + Math.random().toString(36).slice(2, 8),
          username: "Demo_User",
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