"use client";

import { useState } from "react";
import Link from "next/link";

const TABS = ["Predictors", "Players", "Creators"];

const mockPredictors = [
  { rank: 1, username: "Alex_Pi", accuracy: 87, reputation: 4.8, tier: "ELITE", streak: 14 },
  { rank: 2, username: "Maria_K", accuracy: 82, reputation: 4.5, tier: "EXPERT", streak: 9 },
  { rank: 3, username: "Dev_Jon", accuracy: 79, reputation: 4.2, tier: "TRUSTED", streak: 7 },
  { rank: 4, username: "Crypto_Z", accuracy: 75, reputation: 3.9, tier: "TRUSTED", streak: 5 },
  { rank: 5, username: "PiKing", accuracy: 72, reputation: 3.7, tier: "MEMBER", streak: 3 },
  { rank: 6, username: "Jhon_D", accuracy: 0, reputation: 0, tier: "MEMBER", streak: 3, isMe: true },
];

const mockPlayers = [
  { rank: 1, username: "QuizMaster", score: 9840, accuracy: 91, tier: "ELITE", streak: 21 },
  { rank: 2, username: "BrainPi", score: 8720, accuracy: 88, tier: "ELITE", streak: 18 },
  { rank: 3, username: "FastFingers", score: 7650, accuracy: 84, tier: "EXPERT", streak: 12 },
  { rank: 4, username: "Alex_Pi", score: 6430, accuracy: 79, tier: "EXPERT", streak: 8 },
  { rank: 5, username: "Maria_K", score: 5210, accuracy: 76, tier: "TRUSTED", streak: 6 },
  { rank: 6, username: "Jhon_D", score: 0, accuracy: 0, tier: "MEMBER", streak: 3, isMe: true },
];

const mockCreators = [
  { rank: 1, username: "ContentKing", contributions: 142, earned: 2840, tier: "ELITE" },
  { rank: 2, username: "PollMaster", contributions: 98, earned: 1960, tier: "EXPERT" },
  { rank: 3, username: "PredictPro", contributions: 76, earned: 1520, tier: "EXPERT" },
  { rank: 4, username: "QuizBuilder", contributions: 54, earned: 1080, tier: "TRUSTED" },
  { rank: 5, username: "Maria_K", contributions: 41, earned: 820, tier: "TRUSTED" },
  { rank: 6, username: "Jhon_D", contributions: 0, earned: 0, tier: "MEMBER", isMe: true },
];

const TIER_COLORS: Record<string, string> = {
  NEWCOMER: "#a0a0b8",
  MEMBER: "#6c63ff",
  TRUSTED: "#00c9a7",
  EXPERT: "#ffd700",
  ELITE: "#ff6584",
};

const RANK_STYLES: Record<number, { bg: string; color: string; icon: string }> = {
  1: { bg: "#ffd70022", color: "#ffd700", icon: "🥇" },
  2: { bg: "#c0c0c022", color: "#c0c0c0", icon: "🥈" },
  3: { bg: "#cd7f3222", color: "#cd7f32", icon: "🥉" },
};

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState(0);

  const renderPredictors = () => (
    <>
      {mockPredictors.map((user) => (
        <div key={user.username} className="card" style={{
          marginBottom: 10,
          border: user.isMe ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
          background: user.isMe ? "#6c63ff11" : "var(--bg-card)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

            {/* Rank */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: RANK_STYLES[user.rank]?.bg || "var(--bg-secondary)",
              color: RANK_STYLES[user.rank]?.color || "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: user.rank <= 3 ? 18 : 14,
              flexShrink: 0,
            }}>
              {user.rank <= 3 ? RANK_STYLES[user.rank].icon : `#${user.rank}`}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {user.username}
                </span>
                {user.isMe && (
                  <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600 }}>
                    YOU
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>🔥 {user.streak} streak</span>
                <span style={{ color: TIER_COLORS[user.tier] }}>⭐ {user.tier}</span>
              </div>
            </div>

            {/* Accuracy */}
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: user.accuracy >= 75 ? "#00c9a7" : user.accuracy >= 50 ? "#ffd700" : "var(--text-secondary)",
              }}>
                {user.accuracy}%
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>accuracy</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  const renderPlayers = () => (
    <>
      {mockPlayers.map((user) => (
        <div key={user.username} className="card" style={{
          marginBottom: 10,
          border: user.isMe ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
          background: user.isMe ? "#6c63ff11" : "var(--bg-card)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: RANK_STYLES[user.rank]?.bg || "var(--bg-secondary)",
              color: RANK_STYLES[user.rank]?.color || "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: user.rank <= 3 ? 18 : 14,
              flexShrink: 0,
            }}>
              {user.rank <= 3 ? RANK_STYLES[user.rank].icon : `#${user.rank}`}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{user.username}</span>
                {user.isMe && (
                  <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600 }}>YOU</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>🔥 {user.streak} streak</span>
                <span style={{ color: TIER_COLORS[user.tier] }}>⭐ {user.tier}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-gold)" }}>
                {user.score.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>points</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  const renderCreators = () => (
    <>
      {mockCreators.map((user) => (
        <div key={user.username} className="card" style={{
          marginBottom: 10,
          border: user.isMe ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
          background: user.isMe ? "#6c63ff11" : "var(--bg-card)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: RANK_STYLES[user.rank]?.bg || "var(--bg-secondary)",
              color: RANK_STYLES[user.rank]?.color || "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: user.rank <= 3 ? 18 : 14,
              flexShrink: 0,
            }}>
              {user.rank <= 3 ? RANK_STYLES[user.rank].icon : `#${user.rank}`}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{user.username}</span>
                {user.isMe && (
                  <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600 }}>YOU</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                📝 {user.contributions} contributions
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-gold)" }}>
                {user.earned.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>PPA earned</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );

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
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🏆 Leaderboard</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Skill earns your rank. No shortcuts.
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          background: "var(--bg-card)",
          padding: 4,
          borderRadius: 12,
        }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 10,
                border: "none",
                background: activeTab === i ? "var(--accent-primary)" : "transparent",
                color: activeTab === i ? "white" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 0 && renderPredictors()}
        {activeTab === 1 && renderPlayers()}
        {activeTab === 2 && renderCreators()}

      </div>
    </div>
  );
}