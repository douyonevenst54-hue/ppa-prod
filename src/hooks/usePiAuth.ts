"use client";

import { useState, useEffect } from "react";

interface PiUser {
  uid: string;
  username: string;
}

interface AuthResult {
  user: PiUser;
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
    };
  }
}

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

export function usePiAuth() {
  const [user, setUser] = useState<PPAUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for cached user first
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
      // Wait for Pi SDK to load
      let attempts = 0;
      while (!window.Pi && attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      if (!window.Pi) {
        // Not in Pi Browser — use demo mode
        await signInDemo();
        return;
      }

      // Initialize Pi SDK
      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      });

      // Authenticate
      const auth = await window.Pi.authenticate(
        ["username"],
        handleIncompletePayment
      );

      // Create/login user in our database
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
    // Demo mode for testing outside Pi Browser
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
    } catch (err) {
      setError("Failed to sign in");
    }
  }

  function signOut() {
    localStorage.removeItem("ppa_user");
    setUser(null);
  }

  return { user, loading, error, signOut };
}