"use client";

import { useAuth } from "./AuthProvider";

/**
 * Visible "Sign in with Pi" button. Required by Pi App Studio's
 * verification flow — Pi's iframe watches for an explicit Pi.authenticate
 * call after the page loads, so we need a user-actionable trigger in
 * addition to the automatic init.
 *
 * Renders only when the user is in public mode. Hidden when already
 * authenticated or while the initial auth check is loading.
 */
export default function SignInButton() {
  const { status, loading, signIn } = useAuth();

  if (status === "authenticated" || status === "loading") {
    return null;
  }

  const handleClick = async () => {
    if (typeof window !== "undefined" && !window.Pi) {
      alert("Open this app in Pi Browser to sign in with your Pi account.");
      return;
    }
    await signIn();
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 20px",
        borderRadius: 12,
        background: "#6c63ff",
        color: "white",
        fontWeight: 600,
        fontSize: 15,
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        boxShadow: "0 2px 8px rgba(108, 99, 255, 0.3)",
        transition: "opacity 0.2s",
      }}
    >
      <span style={{ fontSize: 18 }}>π</span>
      <span>{loading ? "Signing in..." : "Sign in with Pi"}</span>
    </button>
  );
}