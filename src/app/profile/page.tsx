"use client";

import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

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

const TIER_REQUIREMENTS: Record<string, string> = {
  NEWCOMER: "Just getting started",
  MEMBER: "10+ predictions",
  TRUSTED: "65%+ accuracy, 20+ predictions",
  EXPERT: "75%+ accuracy, 30+ predictions",
  ELITE: "85%+ accuracy, 50+ predictions",
};

const NEXT_TIER: Record<string, string> = {
  NEWCOMER: "MEMBER",
  MEMBER: "TRUSTED",
  TRUSTED: "EXPERT",
  EXPERT: "ELITE",
  ELITE: "ELITE",
};

function getStreakMultiplier(streakDays: number): string {
  if (streakDays >= 30) return "2.0×";
  if (streakDays >= 14) return "1.8×";
  if (streakDays >= 7)  return "1.5×";
  if (streakDays >= 3)  return "1.2×";
  return "1.0×";
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading profile...
      </div>
    );
  }

  const accuracy = Math.round((user.accuracyRate || 0) * 100);
  const tierColor = TIER_COLORS[user.tier] || "#a0a0b8";
  const nextTier = NEXT_TIER[user.tier];
  const streakMultiplier = getStreakMultiplier(user.streakDays);

  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Header */}
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>My Profile</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Avatar + Name */}
        <div style={{
          textAlign: "center",
          padding: "24px 0 20px",
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: tierColor + "22",
            border: `3px solid ${tierColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            margin: "0 auto 12px",
          }}>
            🧠
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {user.username}
          </div>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            background: tierColor + "22",
            color: tierColor,
          }}>
            ⭐ {TIER_LABELS[user.tier]}
          </span>
        </div>

        {/* Balance Card */}
        <div className="card" style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid #6c63ff44",
          textAlign: "center",
          padding: "20px 16px",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4, letterSpacing: 1 }}>
            PPA BALANCE
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: "var(--accent-gold)" }}>
            {user.ppaBalance.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>PPA Tokens</div>
        </div>

        {/* Core Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            {
              label: "Accuracy Rate",
              value: `${accuracy}%`,
              color: accuracy >= 75 ? "#00c9a7" : accuracy >= 50 ? "#ffd700" : "#ff6584",
              icon: "🎯",
            },
            {
              label: "Reputation",
              value: user.reputationScore.toFixed(1),
              color: "#6c63ff",
              icon: "⭐",
            },
            {
              label: "Day Streak",
              value: `${user.streakDays} 🔥`,
              color: "#ff9f43",
              icon: "🔥",
            },
            {
              label: "Multiplier",
              value: streakMultiplier,
              color: "#00c9a7",
              icon: "⚡",
            },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "16px 8px" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Prediction Stats */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            PREDICTION STATS
          </div>
          {[
            { label: "Total Predictions", value: user.totalPredictions },
            { label: "Correct Predictions", value: user.correctPredictions },
            { label: "Accuracy Rate", value: `${accuracy}%` },
            {
              label: "Wrong Predictions",
              value: user.totalPredictions - user.correctPredictions,
            },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 14,
            }}>
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span style={{ fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Tier Progress */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            TIER PROGRESS
          </div>

          {/* Current tier */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: tierColor }}>
                {TIER_LABELS[user.tier]}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {TIER_REQUIREMENTS[user.tier]}
              </div>
            </div>
            <div style={{
              padding: "6px 14px",
              borderRadius: 20,
              background: tierColor + "22",
              color: tierColor,
              fontSize: 12,
              fontWeight: 600,
            }}>
              Current
            </div>
          </div>

          {/* All tiers */}
          {["NEWCOMER", "MEMBER", "TRUSTED", "EXPERT", "ELITE"].map((tier) => {
            const reached = ["NEWCOMER", "MEMBER", "TRUSTED", "EXPERT", "ELITE"]
              .indexOf(tier) <=
              ["NEWCOMER", "MEMBER", "TRUSTED", "EXPERT", "ELITE"]
              .indexOf(user.tier);
            const isCurrent = tier === user.tier;
            const color = TIER_COLORS[tier];

            return (
              <div key={tier} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                opacity: reached ? 1 : 0.4,
              }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: reached ? color : "var(--border)",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? color : "var(--text-primary)" }}>
                    {TIER_LABELS[tier]}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {TIER_REQUIREMENTS[tier]}
                  </div>
                </div>
                {reached && !isCurrent && (
                  <span style={{ fontSize: 14 }}>✅</span>
                )}
                {isCurrent && (
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>YOU</span>
                )}
              </div>
            );
          })}

          {nextTier !== user.tier && (
            <div style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: TIER_COLORS[nextTier] + "11",
              border: `1px solid ${TIER_COLORS[nextTier]}33`,
              fontSize: 12,
              color: "var(--text-secondary)",
              textAlign: "center",
            }}>
              Next: {TIER_LABELS[nextTier]} — {TIER_REQUIREMENTS[nextTier]}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Link href="/wallet">
            <div className="card" style={{
              textAlign: "center", padding: "16px 12px",
              cursor: "pointer", border: "1px solid #ffd70044",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>💰</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-gold)" }}>
                Wallet
              </div>
            </div>
          </Link>
          <Link href="/leaderboard">
            <div className="card" style={{
              textAlign: "center", padding: "16px 12px",
              cursor: "pointer", border: "1px solid #6c63ff44",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🏆</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-primary)" }}>
                Leaderboard
              </div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}