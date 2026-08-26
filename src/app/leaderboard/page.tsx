"use client";

/**
 * Leaderboard.
 *
 * ── THIS PAGE WAS BROKEN ──────────────────────────────────────────────────
 *
 * It called `/api/leaderboard?type=predictors` and read `json.users`. The
 * rewritten API takes `?board=` and returns `json.entries`, so this page was
 * rendering an empty array on every tab and showing "No rankings yet".
 *
 * Also new: the eligibility rule is displayed. The Predictors board only ranks
 * users with 10+ resolved predictions, so a short board is a rule, not a bug —
 * and someone missing from it deserves to know why rather than assuming they're
 * losing.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const TABS = [
  { label: "Predictors", board: "predictors" },
  { label: "Players", board: "players" },
  { label: "Creators", board: "creators" },
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

interface Entry {
  rank: number;
  username: string;
  tier: string;
  streak?: number;
  accuracy?: number;
  resolved?: number;
  reputation?: number;
  published?: number;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/leaderboard?board=${TABS[activeTab].board}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setEntries(json.entries ?? []);
        setNote(json.eligibilityNote ?? "");
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const onBoard = entries.some((e) => e.username === user?.username);

  const renderEntry = (entry: Entry) => {
    const isMe = entry.username === user?.username;
    const rankStyle = RANK_STYLES[entry.rank];

    return (
      <div
        key={entry.username}
        className="card"
        style={{
          marginBottom: 10,
          border: isMe ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
          background: isMe ? "#6c63ff11" : "var(--bg-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: rankStyle?.bg ?? "var(--bg-secondary)",
              color: rankStyle?.color ?? "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: entry.rank <= 3 ? 18 : 14,
              flexShrink: 0,
            }}
          >
            {entry.rank <= 3 ? rankStyle.icon : `#${entry.rank}`}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{entry.username}</span>
              {isMe && (
                <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600 }}>
                  YOU
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)" }}>
              {entry.streak !== undefined && <span>🔥 {entry.streak} streak</span>}
              <span style={{ color: TIER_COLORS[entry.tier] }}>⭐ {entry.tier}</span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            {activeTab === 0 && (
              <>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      (entry.accuracy ?? 0) >= 75
                        ? "#00c9a7"
                        : (entry.accuracy ?? 0) >= 50
                          ? "#ffd700"
                          : "var(--text-secondary)",
                  }}
                >
                  {entry.accuracy ?? 0}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  of {entry.resolved ?? 0}
                </div>
              </>
            )}
            {activeTab === 1 && (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-gold)" }}>
                  {entry.reputation ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>reputation</div>
              </>
            )}
            {activeTab === 2 && (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-gold)" }}>
                  {entry.published ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>published</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
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
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            background: "var(--bg-card)",
            padding: 4,
            borderRadius: 12,
          }}
        >
          {TABS.map((tab, i) => (
            <button
              key={tab.board}
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
              {tab.label}
            </button>
          ))}
        </div>

        {note && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 14,
              lineHeight: 1.5,
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--bg-secondary)",
            }}
          >
            {note}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            Loading rankings...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Nobody qualifies yet
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 260, margin: "0 auto" }}>
              This board fills up as players build a record. Keep making calls.
            </div>
          </div>
        ) : (
          entries.map(renderEntry)
        )}

        {!loading && entries.length > 0 && user && !onBoard && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: "#6c63ff11",
              border: "1px solid #6c63ff44",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            You&rsquo;re not ranked here yet. Keep playing to qualify.
          </div>
        )}
      </div>
    </div>
  );
}
