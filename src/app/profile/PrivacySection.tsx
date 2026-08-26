"use client";

/**
 * Profile -> Privacy.
 *
 * The privacy policy promises three things: download your data, leave the
 * leaderboards, delete your account. A policy that promises access with no
 * control behind it is worse than no promise, so this is where the promises
 * become buttons.
 *
 * Deletion asks the user to type their own username. A destructive, irreversible
 * action should cost more than one tap.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/pi-session";

export default function PrivacySection() {
  const { user, signOut } = useAuth();
  const [optOut, setOptOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/api/account/privacy")
      .then((r) => r.json())
      .then((d) => setOptOut(Boolean(d.leaderboardOptOut)))
      .catch(() => {});
  }, []);

  const toggleOptOut = async () => {
    setSaving(true);
    const next = !optOut;
    try {
      const res = await apiFetch("/api/account/privacy", {
        method: "PATCH",
        body: JSON.stringify({ leaderboardOptOut: next }),
      });
      if (res.ok) setOptOut(next);
    } catch {
      setMessage("Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    try {
      const res = await apiFetch("/api/account/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ppa-data-${user?.username ?? "export"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Couldn't prepare your download. Try again.");
    }
  };

  const deleteAccount = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({ confirmUsername: typed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "Couldn't delete the account.");
        return;
      }
      signOut();
    } catch {
      setMessage("Couldn't delete the account. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid var(--border)",
  } as const;

  return (
    <>
      <div
        style={{
          marginTop: 24,
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 8,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        PRIVACY
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Show me on leaderboards</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
              Your Pi username, tier, streak and accuracy appear publicly.
            </div>
          </div>
          <button
            onClick={toggleOptOut}
            disabled={saving}
            aria-pressed={!optOut}
            style={{
              flexShrink: 0,
              width: 52,
              height: 30,
              borderRadius: 15,
              border: "none",
              cursor: "pointer",
              background: optOut ? "var(--border)" : "#00c9a7",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: optOut ? 3 : 25,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "white",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Download my data</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Everything tied to your account, as JSON.
            </div>
          </div>
          <button
            onClick={download}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Download
          </button>
        </div>

        <div style={{ ...rowStyle, borderBottom: "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-secondary)" }}>
              Delete my account
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
              Permanent. Your PPA balance is gone and cannot be restored.
            </div>
          </div>
          {!confirming && (
            <button
              onClick={() => setConfirming(true)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #ff658444",
                background: "transparent",
                color: "var(--accent-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          )}
        </div>

        {confirming && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
              Type <strong style={{ color: "var(--text-primary)" }}>{user?.username}</strong> to confirm.
            </div>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={user?.username}
              style={{
                width: "100%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
                color: "var(--text-primary)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={saving || typed !== user?.username}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent-secondary)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: typed === user?.username ? "pointer" : "not-allowed",
                  opacity: typed === user?.username ? 1 : 0.4,
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        )}

        {message && (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--accent-secondary)" }}>
            {message}
          </div>
        )}
      </div>
    </>
  );
}
