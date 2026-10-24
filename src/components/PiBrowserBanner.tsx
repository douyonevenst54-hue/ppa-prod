"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";

const DISMISS_KEY = "ppa_banner_dismissed";

export default function PiBrowserBanner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, signInWithWeb, webSignInAvailable } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const showBanner = status === "public" && !dismissed;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  // ── WHY THERE IS NO LONGER A FULL-SCREEN LOADER ───────────────────────
  //
  // This used to hold a "Connecting to Pi Network..." screen in front of the
  // whole app until auth resolved. Inside Pi Browser that is a blink. Outside
  // it, auth could not succeed at all, so the screen stayed up for the length
  // of the SDK timeout and then revealed an app the visitor was told to open
  // somewhere else.
  //
  // That made the first impression of PPA a loading spinner followed by a
  // rejection — for exactly the audience a promotion link brings. The app now
  // renders immediately and signs in behind it. A slim bar reports progress
  // instead of replacing the page.
  return (
    <>
      {status === "loading" && (
        <div
          aria-hidden
          style={{
            position: "sticky",
            top: 0,
            zIndex: 101,
            height: 2,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "40%",
              height: "100%",
              background: "var(--accent-primary)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      )}
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
          {webSignInAvailable ? (
            <>
              <span style={{ flex: 1 }}>Sign in with Pi to play and earn</span>
              <button
                onClick={() => signInWithWeb()}
                style={{
                  background: "white",
                  color: "#6c63ff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Sign in
              </button>
            </>
          ) : (
            // No client ID configured for this deployment, so the only way in
            // is still the SDK. Say so rather than offering a button that
            // cannot work.
            <span style={{ flex: 1, textAlign: "center" }}>
              🔓 Open in Pi Browser to log in &amp; earn
            </span>
          )}
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