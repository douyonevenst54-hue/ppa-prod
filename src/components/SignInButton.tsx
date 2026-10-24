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
 *
 * ── TWO DOORS, ONE BUTTON ─────────────────────────────────────────────────
 *
 * This used to answer a press from outside Pi Browser with an alert telling
 * the visitor to go and use a different browser, which is where most of them
 * stopped. With Pi Sign-In configured there is a real second door: the same
 * press starts the OAuth round trip instead.
 *
 * The SDK is tried first when it is genuinely there. Inside Pi Browser that
 * is one tap and no page change; the redirect is the fallback, not the
 * default, because sending a Pi Browser user out to accounts.pinet.com when
 * they are already signed in to Pi would be a worse flow.
 */
export default function SignInButton() {
  const { status, loading, signIn } = useAuth();

  if (status === "authenticated" || status === "loading") {
    return null;
  }

  // signIn() tries the SDK and falls through to the redirect itself. Deciding
  // here would mean testing for Pi Browser, and the only honest test is
  // whether authenticate() answers — which is a thing signIn() does and a
  // button cannot.
  const handleClick = () => signIn();

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