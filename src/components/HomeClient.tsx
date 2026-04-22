"use client";

import { useAuth } from "./AuthProvider";

const TIER_COLORS: Record<string, string> = {
  NEWCOMER: "#a0a0b8",
  MEMBER: "#6c63ff",
  TRUSTED: "#00c9a7",
  EXPERT: "#ffd700",
  ELITE: "#ff6584",
};

const TIER_LABELS: Record<string, string> = {
  NEWCOMER: "Newcomer",
  MEMBER: "Member",
  TRUSTED: "Trusted",
  EXPERT: "Expert",
  ELITE: "Elite",
};

export default function HomeClient() {
  const { user, loading } = useAuth();

  function handleReconnect() {
    localStorage.removeItem("ppa_user");
    window.location.reload();
  }

  if (loading) {
    return (
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Connecting to Pi...
        </div>
      </div>
    );
  }

  const isGuest = !user ||
    user.username === "Guest" ||
    user.username === "Demo_User";

  return (
    <>
      {/* Top Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 16px 12px",
        position: "sticky",
        top: 0,
        background: "var(--bg-primary)",
        zIndex: 10,
        borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
            BALANCE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-gold)" }}>
            {user?.ppaBalance || 0}{" "}
            <span style={{ fontSize: 13 }}>PPA</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {user?.username || "Guest"}
          </div>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: TIER_COLORS[user?.tier || "NEWCOMER"] + "22",
            color: TIER_COLORS[user?.tier || "NEWCOMER"],
          }}>
            ⭐ {TIER_LABELS[user?.tier || "NEWCOMER"]}
          </span>
        </div>
      </div>

      {/* Connect Pi Account Banner — only shown to guests */}
      {isGuest && (
        <div style={{
          margin: "12px 16px 0",
          padding: "12px 16px",
          borderRadius: 12,
          background: "#6c63ff22",
          border: "1px solid #6c63ff44",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              Connect Pi Account
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Open in Pi Browser to sign in
            </div>
          </div>
          <button
            onClick={handleReconnect}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: "var(--accent-primary)",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Connect
          </button>
        </div>
      )}
    </>
  );
}