"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";

const DISMISS_KEY = "ppa_banner_dismissed";

export default function PiBrowserBanner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const showBanner = status === "public" && !dismissed;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  // Loading state — keep the nice loading screen briefly
  if (status === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        padding: 24,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Pap-Pad-App
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Connecting to Pi Network...
        </div>
        <div style={{
          marginTop: 24,
          width: 40,
          height: 4,
          borderRadius: 2,
          background: "var(--border)",
          overflow: "hidden",
        }}>
          <div style={{
            width: "100%",
            height: "100%",
            background: "var(--accent-primary)",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {showBanner && (
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#6c63ff",
          color: "white",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 13,
          fontWeight: 600,
        }}>
          <span style={{ flex: 1, textAlign: "center" }}>
            🔓 Open in Pi Browser to log in & earn
          </span>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              fontSize: 18,
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
              opacity: 0.8,
            }}
          >
            ✕
          </button>
        </div>
      )}
      {children}
    </>
  );
}