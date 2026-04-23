"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const TABS = ["Predictors", "Players", "Creators"];

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

interface LeaderboardUser {
  id: string;
  username: string;
  accuracyRate?: number;
  reputationScore?: number;
  tier: string;
  streakDays?: number;
  _count?: { createdContent: number };
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  const tabTypes = ["predictors", "players", "creators"];

  useEffect(() => {
    fetchLeaderboard(tabTypes[activeTab]);
  }, [activeTab]);

  async function fetchLeaderboard(type: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?type=${type}`);
      const json = await res.json();
      setData(json.users || []);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }

  const renderEntry = (entry: LeaderboardUser, rank: number) => {
    const isMe = entry.id === user?.id;
    const rankStyle = RANK_STYLES[rank];

    return (
      <div key={entry.id} className="card" style={{
        marginBottom: 10,
        border: isMe ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
        background: isMe ? "#6c63ff11" : "var(--bg-card)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

          {/* Rank */}
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: rankStyle?.bg || "var(--bg-secondary)",
            color: rankStyle?.color || "var(--text-secondary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700,
            fontSize: rank <= 3 ? 18 : 14,
            flexShrink: 0,
          }}>
            {rank <= 3 ? rankStyle.icon : `#${rank}`}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                {entry.username}
              </span>
              {isMe && (
                <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600 }}>
                  YOU
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)" }}>
              {entry.streakDays !== undefined && (
                <span>🔥 {entry.streakDays} streak</span>
              )}
              <span style={{ color: TIER_COLORS[entry.tier] }}>
                ⭐ {entry.tier}
              </span>
            </div>
          </div>

          {/* Metric */}
          <div style={{ textAlign: "right" }}>
            {activeTab === 0 && (
              <>
                <div style={{
                  fontSize: 20, fontWeight: 700,
                  color: (entry.accuracyRate || 0) >= 0.75 ? "#00c9a7" :
                         (entry.accuracyRate || 0) >= 0.5 ? "#ffd700" : "var(--text-secondary)",
                }}>
                  {Math.round((entry.accuracyRate || 0) * 100)}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>accuracy</div>
              </>
            )}
            {activeTab === 1 && (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-gold)" }}>
                  {(entry.reputationScore || 0).toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>reputation</div>
              </>
            )}
            {activeTab === 2 && (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-gold)" }}>
                  {entry._count?.createdContent || 0}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>contributions</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

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
          display: "flex", gap: 8, marginBottom: 20,
          background: "var(--bg-card)", padding: 4, borderRadius: 12,
        }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 10,
                border: "none",
                background: activeTab === i ? "var(--accent-primary)" : "transparent",
                color: activeTab === i ? "white" : "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            Loading rankings...
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              No rankings yet
            </div>
            <div style={{ fontSize: 13 }}>
              Be the first to make it on the leaderboard!
            </div>
          </div>
        ) : (
          data.map((entry, index) => renderEntry(entry, index + 1))
        )}

        {/* Your rank if not in top list */}
        {!loading && data.length > 0 && user &&
          !data.find(d => d.id === user.id) && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            background: "#6c63ff11",
            border: "1px solid #6c63ff44",
            textAlign: "center",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}>
            Keep playing to climb the rankings! 🚀
          </div>
        )}

      </div>
    </div>
  );
}