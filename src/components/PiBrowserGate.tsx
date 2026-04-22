"use client";

import { useAuth } from "./AuthProvider";

export default function PiBrowserGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();

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

  if (status === "requires_pi_browser") {
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
        {/* Logo */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "#6c63ff22",
          border: "2px solid #6c63ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          marginBottom: 24,
        }}>
          🧠
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          Pap-Pad-App
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>
          Predict · Challenge · Earn
        </div>

        {/* Gate Card */}
        <div style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Pi Browser Required
          </div>
          <div style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}>
            Pap-Pad-App is a Pi Network app. You need to open it inside
            Pi Browser to authenticate and access all features.
          </div>

          {/* Steps */}
          {[
            { step: "1", text: "Download Pi Browser from App Store or Play Store" },
            { step: "2", text: "Open Pi Browser and sign in with your Pi account" },
            { step: "3", text: `Navigate to ppa-prod.vercel.app` },
          ].map((item) => (
            <div key={item.step} style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              marginBottom: 12,
              textAlign: "left",
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#6c63ff22",
                border: "1px solid #6c63ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "#6c63ff",
                flexShrink: 0,
              }}>
                {item.step}
              </div>
              <div style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                paddingTop: 4,
                lineHeight: 1.4,
              }}>
                {item.text}
              </div>
            </div>
          ))}
        </div>

        {/* Feature Preview */}
        <div style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: 20,
        }}>
          <div style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 16,
            fontWeight: 600,
            letterSpacing: 1,
          }}>
            WHAT AWAITS YOU
          </div>
          {[
            { icon: "🧠", text: "Predict real-world outcomes" },
            { icon: "🎯", text: "Win skill-based challenges" },
            { icon: "🗳️", text: "Vote and earn PPA tokens" },
            { icon: "🏆", text: "Climb the leaderboard" },
            { icon: "💰", text: "Exchange PPA for $Pi" },
          ].map((item) => (
            <div key={item.text} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 14,
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ color: "var(--text-secondary)" }}>{item.text}</span>
            </div>
          ))}
        </div>

      </div>
    );
  }

  return <>{children}</>;
}