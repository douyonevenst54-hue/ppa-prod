"use client";

/**
 * Daily streak card.
 *
 * Changes:
 *  - apiFetch, and no `?userId=` — the route returns the session user now.
 *  - The check-in reply can report a capped payout; saying so beats silently
 *    paying less than the message promised.
 *  - Milestone progress is measured against the actual ladder (3/7/14/30)
 *    rather than `% 7`, which claimed "7 days to next upgrade" to someone on a
 *    28-day streak whose next milestone was 2 days away.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/lib/pi-session";

interface StreakData {
  streakDays: number;
  longestStreak: number;
  multiplier: number;
  streakStatus: "active" | "at_risk" | "broken";
  checkedInToday: boolean;
}

const MILESTONES = [
  { days: 3, label: "3d", mult: "1.2×" },
  { days: 7, label: "7d", mult: "1.5×" },
  { days: 14, label: "14d", mult: "1.8×" },
  { days: 30, label: "30d", mult: "2×" },
];

const MULTIPLIER_LABELS: Record<number, string> = {
  1.0: "No bonus",
  1.2: "1.2× bonus",
  1.5: "1.5× bonus",
  1.8: "1.8× bonus",
  2.0: "2.0× MAX",
};

const STATUS_COLORS = {
  active: "#00c9a7",
  at_risk: "#ffd700",
  broken: "#ff6584",
};

/** Days remaining to the next milestone, and how far through we are. */
function milestoneProgress(days: number): { next: number | null; pct: number } {
  const prev = [0, ...MILESTONES.map((m) => m.days)].filter((d) => d <= days).pop() ?? 0;
  const next = MILESTONES.find((m) => m.days > days)?.days ?? null;
  if (next === null) return { next: null, pct: 100 };
  return { next: next - days, pct: ((days - prev) / (next - prev)) * 100 };
}

export default function StreakCard() {
  const { user, refreshUser } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  // Distinct from "streak is 0". A failed load used to render 0 Days / Best: 0,
  // which tells someone they have lost a streak they still have.
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState("");

  const fetchStreak = useCallback(async () => {
    try {
      const res = await apiFetch("/api/streak");
      if (res.ok) {
        setStreak(await res.json());
        setUnavailable(false);
      } else {
        setUnavailable(true);
      }
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Don't ask when nobody is signed in. apiFetch re-authenticates once on a
    // 401 by calling the Pi SDK, and that call never settles without a user to
    // answer it — so the `finally` never ran and the card sat on "Loading
    // streak..." for the whole visit.
    if (!user?.id) {
      setLoading(false);
      return;
    }
    void fetchStreak();
  }, [user?.id, fetchStreak]);

  const handleCheckIn = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await apiFetch("/api/streak", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message ?? "Couldn't check in.");
        return;
      }

      setMessage(
        data.capped
          ? `${data.message} You've hit today's earning limit, so this paid ${data.ppaBonus} PPA.`
          : data.ppaBonus > 0
            ? `${data.message} +${data.ppaBonus} PPA`
            : data.message,
      );

      setStreak({
        streakDays: data.streakDays,
        longestStreak: data.longestStreak,
        multiplier: data.multiplier,
        streakStatus: "active",
        checkedInToday: true,
      });

      if (data.ppaBonus > 0) await refreshUser();
    } catch {
      setMessage("Couldn't check in. Try again.");
    } finally {
      setClaiming(false);
    }
  };

  // A streak belongs to an account. With nobody signed in there is nothing to
  // show and nothing to claim, so the card stays out of the way rather than
  // occupying a slot with a placeholder.
  if (!user?.id) return null;

  if (unavailable && !streak) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>
          Couldn&apos;t load your streak.
        </div>
        <button
          className="btn-primary"
          style={{ background: "transparent", border: "1px solid var(--border)" }}
          onClick={() => {
            setUnavailable(false);
            setLoading(true);
            void fetchStreak();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Loading streak...
        </div>
      </div>
    );
  }

  const days = streak?.streakDays ?? 0;
  const statusColor = STATUS_COLORS[streak?.streakStatus ?? "broken"];
  const checkedIn = streak?.checkedInToday ?? false;
  const progress = milestoneProgress(days);

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        background: "linear-gradient(135deg, #1a1a2e, #16213e)",
        border: `1px solid ${statusColor}44`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            Daily Streak
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>🔥 {days} Days</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, marginBottom: 4 }}>
            {checkedIn && "✅ Checked in"}
            {!checkedIn && streak?.streakStatus === "at_risk" && "⚠️ At risk"}
            {!checkedIn && streak?.streakStatus === "broken" && "Start a streak"}
            {!checkedIn && streak?.streakStatus === "active" && "🔥 Active"}
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: statusColor + "22",
              color: statusColor,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {MULTIPLIER_LABELS[streak?.multiplier ?? 1.0]}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
          <span>Progress to next milestone</span>
          <span>Best: {streak?.longestStreak ?? 0} days</span>
        </div>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(progress.pct, 100)}%`,
              background: statusColor,
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
          {progress.next === null
            ? "Top multiplier reached"
            : `${progress.next} day${progress.next === 1 ? "" : "s"} to the next multiplier`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {MILESTONES.map((m) => {
          const reached = days >= m.days;
          return (
            <div
              key={m.days}
              style={{
                flex: 1,
                padding: "6px 4px",
                borderRadius: 8,
                textAlign: "center",
                background: reached ? "#00c9a722" : "var(--bg-secondary)",
                border: `1px solid ${reached ? "#00c9a7" : "var(--border)"}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: reached ? "#00c9a7" : "var(--text-secondary)" }}>
                {m.label}
              </div>
              <div style={{ fontSize: 10, color: reached ? "#00c9a7" : "var(--text-secondary)" }}>
                {m.mult}
              </div>
            </div>
          );
        })}
      </div>

      {message && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#00c9a7",
            marginBottom: 10,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      )}

      {!checkedIn ? (
        <button className="btn-primary" onClick={handleCheckIn} disabled={claiming} style={{ opacity: claiming ? 0.6 : 1 }}>
          {claiming ? "Checking in..." : "Check in for today"}
        </button>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: 10,
            borderRadius: 12,
            background: "#00c9a722",
            border: "1px solid #00c9a744",
            fontSize: 13,
            color: "#00c9a7",
            fontWeight: 600,
          }}
        >
          Come back tomorrow to keep your streak
        </div>
      )}
    </div>
  );
}
