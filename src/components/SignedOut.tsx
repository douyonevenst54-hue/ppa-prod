"use client";

import { useAuth } from "./AuthProvider";

/**
 * What a signed-out visitor sees on a screen that needs an account.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Three screens answered "nobody is signed in" with "Loading…", forever:
 *
 *   profile:  if (!user) return <>Loading profile...</>
 *   wallet:   useEffect(() => { if (!user?.id) return; ... })   // setLoading(false)
 *             never runs, so `loading` stays true
 *   creator:  the same early return, leaving a stats card of zeroes that
 *             reads as the visitor's own record
 *
 * Inside Pi Browser that was nearly invisible: sign-in resolves in a blink,
 * so !user is a flicker. It stopped being invisible the moment the app could
 * be opened in an ordinary browser, where !user is the normal state for
 * everyone who has not signed in yet — and a spinner that never resolves is
 * the app telling them it is broken.
 *
 * It is also the same defect this codebase has had repeatedly: a screen
 * reporting a state it is not in. "Loading" when nothing is loading belongs
 * with "BALANCE 0 PPA" for a signed-out visitor and a streak card showing
 * "0 Days / Best: 0" after a failed fetch. The fix is the same each time —
 * say the true thing, and give the person the action that changes it.
 */
export default function SignedOut({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { signIn, loading, webSignInAvailable } = useAuth();

  return (
    <div style={{ padding: 16, paddingTop: 48 }}>
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>π</div>

        <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>
          {title}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.65,
            marginBottom: 20,
          }}
        >
          {children}
        </p>

        <button
          onClick={() => signIn()}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 22px",
            borderRadius: 12,
            background: "var(--accent-primary)",
            color: "white",
            fontWeight: 600,
            fontSize: 15,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: 17 }}>π</span>
          <span>{loading ? "Signing in…" : "Sign in with Pi"}</span>
        </button>

        {!webSignInAvailable && (
          // Without a client ID there is no redirect to offer, so the button
          // only works where the SDK does. Say so rather than letting someone
          // press it and get an alert.
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 14 }}>
            Open PPA in Pi Browser to sign in.
          </div>
        )}
      </div>
    </div>
  );
}
