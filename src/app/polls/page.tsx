"use client";

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
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Vote. Influence. Earn PPA.</div>
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

        {/* Results count */}
        {!loading && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            {polls.length} poll{polls.length !== 1 ? "s" : ""} found
            {debouncedSearch && ` for "${debouncedSearch}"`}
          </div>
        )}

        {/* Polls */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            Loading...
          </div>
        ) : polls.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No polls found</div>
            <div style={{ fontSize: 13 }}>Try a different search or category</div>
          </div>
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