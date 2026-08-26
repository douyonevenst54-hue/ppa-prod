"use client";

/**
 * Age gate, shown once after Pi authentication.
 *
 * Not dismissible, and deliberately not a date picker: what needs to exist is a
 * record that the user was asked and answered. Storing a date of birth creates
 * a data-protection liability with no product use.
 *
 * Declining signs the user out rather than degrading into a limited mode —
 * a half-open door for someone who said they're under 18 is worse than a
 * closed one.
 */

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/lib/pi-session";

export default function AgeGate() {
  const { user, signOut } = useAuth();
  const [needsGate, setNeedsGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    apiFetch("/api/account/attest-age")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setNeedsGate(d.attested === false);
      })
      .catch(() => {
        // Can't reach it — don't block the app on a network hiccup.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!needsGate) return null;

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/account/attest-age", {
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      });
      if (!res.ok) throw new Error();
      setNeedsGate(false);
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 360, width: "100%", padding: 24 }}
      >
        <div id="age-gate-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Confirm your age
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          PPA is for people 18 and over. Confirm your age to continue.
        </div>

        <button className="btn-primary" onClick={confirm} disabled={busy}>
          {busy ? "Saving..." : "I am 18 or older"}
        </button>

        <button
          onClick={() => signOut()}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          I am under 18
        </button>

        {error && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--accent-secondary)",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
