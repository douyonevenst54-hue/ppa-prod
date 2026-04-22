"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";

interface StreakData {
  streakDays: number;
  longestStreak: number;
  multiplier: number;
  streakStatus: "active" | "at_risk" | "broken";
  checkedInToday: boolean;
}

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

export default function StreakCard() {
  const { user, refreshUser } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");

  const fetchStreak = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/streak?userId=${user.id}`);
      const data = await res.json();
      setStreak(data);
    } catch (err) {
      console.error("Failed to fetch streak:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  const handleCheckIn = async () => {
    if (!user?.id || claiming) return;
    setClaiming(true);

    try {
      const res = await fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      setMessage(data.message);
      setStreak({
        streakDays: data.streakDays,
        longestStreak: data.longestStreak,
        multiplier: data.multiplier,
        streakStatus: "active",
        checkedInToday: true,
      });
      if (data.ppaBonus > 0) {
        await refreshUser();
      }
    } catch {
      setMessage("❌ Failed to check in");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 12, padding: "16px" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Loading streak...
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[streak?.streakStatus || "broken"];
  const checkedIn = streak?.checkedInToday || false;

  return (
    <div className="card" style={{
      marginBottom: 12,
      background: "linear-gradient(135deg, #1a1a2e, #16213e)",
      border: `1px solid ${statusColor}44`,
    }}>

      {/* Top Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            Daily Streak
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            🔥 {streak?.streakDays || 0} Days
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: statusColor,
            marginBottom: 4,
          }}>
            {streak?.streakStatus === "active" && checkedIn && "✅ Checked in"}
            {streak?.streakStatus === "at_risk" && "⚠️ At risk!"}
            {streak?.streakStatus === "broken" && "💔 Start streak"}
            {streak?.streakStatus === "active" && !checkedIn && "🔥 Active"}
          </div>
          <div style={{
            padding: "4px 10px",
            borderRadius: 20,
            background: statusColor + "22",
            color: statusColor,
            fontSize: 12,
            fontWeight: 600,
          }}>
            {MULTIPLIER_LABELS[streak?.multiplier || 1.0]}
          </div>
        </div>
      </div>

      {/* Streak Progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
          <span>Progress to next milestone</span>
          <span>Best: {streak?.longestStreak || 0} days</span>
        </div>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
          <div style={{
            height: "100%",
            width: `${Math.min(((streak?.streakDays || 0) % 7) / 7 * 100, 100)}%`,
            background: statusColor,
            borderRadius: 3,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
          {7 - ((streak?.streakDays || 0) % 7)} days to next multiplier upgrade
        </div>
      </div>

      {/* Milestone badges */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { days: 3, label: "3d", mult: "1.2×" },
          { days: 7, label: "7d", mult: "1.5×" },
          { days: 14, label: "14d", mult: "1.8×" },
          { days: 30, label: "30d", mult: "2×" },
        ].map((milestone) => {
          const reached = (streak?.streakDays || 0) >= milestone.days;
          return (
            <div key={milestone.days} style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 8,
              textAlign: "center",
              background: reached ? "#00c9a722" : "var(--bg-secondary)",
              border: `1px solid ${reached ? "#00c9a7" : "var(--border)"}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: reached ? "#00c9a7" : "var(--text-secondary)" }}>
                {milestone.label}
              </div>
              <div style={{ fontSize: 10, color: reached ? "#00c9a7" : "var(--text-secondary)" }}>
                {milestone.mult}
              </div>
            </div>
          );
        })}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: message.startsWith("✅") || message.includes("streak") ? "#00c9a7" : "var(--accent-gold)",
          marginBottom: 10,
          textAlign: "center",
        }}>
          {message}
        </div>
      )}

      {/* CTA */}
      {!checkedIn ? (
        <button
          className="btn-primary"
          onClick={handleCheckIn}
          disabled={claiming}
          style={{ opacity: claiming ? 0.6 : 1 }}
        >
          {claiming ? "Checking in..." : "✅ Complete Today's Challenge"}
        </button>
      ) : (
        <div style={{
          textAlign: "center",
          padding: "10px",
          borderRadius: 12,
          background: "#00c9a722",
          border: "1px solid #00c9a744",
          fontSize: 13,
          color: "#00c9a7",
          fontWeight: 600,
        }}>
          ✅ Come back tomorrow to keep your streak!
        </div>
      )}

    </div>
  );
}