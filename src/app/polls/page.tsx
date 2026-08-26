"use client";

/**
 * Polls listing.
 *
 * ── TWO CHANGES ───────────────────────────────────────────────────────────
 *
 * 1. The subtitle no longer promises PPA for voting.
 *
 *    "Vote. Influence. Earn PPA." described a mechanic that was the cheapest
 *    farm in the app — create a poll, vote on it, get paid, repeat — and it is
 *    gone from the server. Leaving the promise on screen would be advertising
 *    a reward the app won't pay.
 *
 * 2. The empty state is a way out, not a dead end.
 *
 *    "No polls found / Try a different search or category" on a primary nav tab
 *    told a user to retry a search that couldn't succeed, because there were no
 *    polls at all. It now distinguishes "your filters matched nothing" from
 *    "nobody has written one yet", and the second case offers to fix itself.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const CATEGORIES = ["ALL", "FINANCE", "SPORTS", "TECH", "POLITICS", "SOCIAL", "GENERAL"];

const CATEGORY_COLORS: Record<string, string> = {
  FINANCE: "#00c9a7",
  SPORTS: "#ff6584",
  TECH: "#6c63ff",
  POLITICS: "#ffd700",
  SOCIAL: "#ff9f43",
  GENERAL: "#a0a0b8",
};

const CATEGORY_ICONS: Record<string, string> = {
  FINANCE: "💹",
  SPORTS: "⚽",
  TECH: "💻",
  POLITICS: "🏛️",
  SOCIAL: "💬",
  GENERAL: "🧠",
};

interface Poll {
  id: string;
  title: string;
  category: string;
  participantCount: number;
  endsAt: string;
  pollOptions: { id: string; text: string }[];
  creator: { username: string };
}

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("popular");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        category,
        sort,
      });
      const res = await fetch(`/api/polls?${params}`);
      const data = await res.json();
      setPolls(data.polls || []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, sort]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const hasFilters = debouncedSearch !== "" || category !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategory("ALL");
    setSort("popular");
  };

  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Header */}
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🗳️ Polls</div>
          {/* Was "Vote. Influence. Earn PPA." — voting doesn't pay any more. */}
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Vote. Influence. See where the community lands.
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search polls..."
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "12px 16px",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 12, top: "50%",
                transform: "translateY(-50%)",
                background: "none", border: "none",
                color: "var(--text-secondary)", cursor: "pointer",
                fontSize: 16,
              }}
            >×</button>
          )}
        </div>

        {/* Category Filter */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 10,
          overflowX: "auto", paddingBottom: 4,
        }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              padding: "6px 14px", borderRadius: 20,
              border: "none", whiteSpace: "nowrap",
              background: category === cat ? "var(--accent-primary)" : "var(--bg-card)",
              color: category === cat ? "white" : "var(--text-secondary)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>
              {cat === "ALL" ? "All" : `${CATEGORY_ICONS[cat]} ${cat}`}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { value: "popular", label: "🔥 Popular" },
            { value: "newest", label: "🆕 Newest" },
            { value: "ending", label: "⏰ Ending Soon" },
          ].map((s) => (
            <button key={s.value} onClick={() => setSort(s.value)} style={{
              padding: "6px 12px", borderRadius: 20,
              border: `1px solid ${sort === s.value ? "var(--accent-primary)" : "var(--border)"}`,
              background: sort === s.value ? "#6c63ff22" : "transparent",
              color: sort === s.value ? "var(--accent-primary)" : "var(--text-secondary)",
              fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Results count — hidden when there are none, since the empty state
            below says it better than "0 polls found" does. */}
        {!loading && polls.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            {polls.length} poll{polls.length !== 1 ? "s" : ""}
            {debouncedSearch && ` for "${debouncedSearch}"`}
          </div>
        )}

        {/* Polls */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            Loading...
          </div>
        ) : polls.length === 0 ? (
          hasFilters ? (
            /* Filters matched nothing — the retry advice is actually useful here. */
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                No polls match those filters
              </div>
              <button
                onClick={clearFilters}
                style={{
                  marginTop: 8,
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            /* Nothing exists yet. Telling someone to "try a different search"
               when there are zero polls is a dead end; offer the fix instead. */
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗳️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                No polls running right now
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 260, margin: "0 auto 20px" }}>
                Polls are written by players. Ask a question and see how the
                community splits.
              </div>
              <Link href="/creator/new/poll" style={{ textDecoration: "none" }}>
                <button className="btn-primary" style={{ maxWidth: 220, margin: "0 auto" }}>
                  Write the first poll
                </button>
              </Link>
            </div>
          )
        ) : (
          polls.map((poll) => (
            <div key={poll.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="badge" style={{
                  background: CATEGORY_COLORS[poll.category] + "22",
                  color: CATEGORY_COLORS[poll.category],
                }}>
                  {CATEGORY_ICONS[poll.category]} {poll.category}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  ⏱ {timeLeft(poll.endsAt)}
                </span>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                {poll.title}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {poll.pollOptions?.map((option) => (
                  <span key={option.id} style={{
                    padding: "4px 10px", borderRadius: 20,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    fontSize: 12, color: "var(--text-secondary)",
                  }}>
                    {option.text}
                  </span>
                ))}
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 12, fontSize: 12, color: "var(--text-secondary)",
              }}>
                <span>🗳️ {poll.participantCount.toLocaleString()} votes</span>
                <span>by {poll.creator.username}</span>
              </div>

              <Link href={`/polls/${poll.id}`}>
                <button className="btn-primary">Vote</button>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
