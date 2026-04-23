"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const TIER_MULTIPLIERS: Record<string, number> = {
  NEWCOMER: 0.8,
  MEMBER: 1.0,
  TRUSTED: 1.2,
  EXPERT: 1.5,
  ELITE: 2.0,
};

interface RewardBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  tierBonus: number;
  total: number;
}

function ResultContent() {
  const params = useSearchParams();
  const { user, refreshUser } = useAuth();

  const correct = parseInt(params.get("correct") || "0");
  const total = parseInt(params.get("total") || "5");
  const time = parseInt(params.get("time") || "0");
  const challengeId = params.get("challengeId") || "";

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reward, setReward] = useState<RewardBreakdown | null>(null);

  const accuracy = Math.round((correct / total) * 100);
  const isPerfect = correct === total;
  const passed = correct >= Math.ceil(total / 2);

  useEffect(() => {
    if (!user?.id || saved || saving) return;
    saveResults();
  }, [user?.id]);

  async function saveResults() {
    if (!user?.id) return;
    setSaving(true);

    try {
      const res = await fetch("/api/challenges/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          challengeId,
          correct,
          total,
          timeSeconds: time,
          streakDays: user.streakDays,
          tier: user.tier,
        }),
      });

      const data = await res.json();

      if (data.ppaEarned !== undefined) {
        setReward({
          base: data.baseReward || 0,
          speedBonus: data.speedBonus || 0,
          streakBonus: data.streakBonus || 0,
          tierBonus: data.tierBonus || 0,
          total: data.ppaEarned,
        });
        await refreshUser();
      }

      setSaved(true);
    } catch (err) {
      console.error("Failed to save results:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Result Header */}
      <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>
          {isPerfect ? "🏆" : passed ? "✅" : "📚"}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
          {isPerfect ? "Perfect Score!" : passed ? "Well Done!" : "Keep Practicing!"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {correct} out of {total} correct
        </div>
      </div>

      {/* Score Card */}
      <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{
          fontSize: 56, fontWeight: 800,
          color: accuracy >= 80 ? "#00c9a7" : accuracy >= 60 ? "#ffd700" : "#ff6584",
          marginBottom: 4,
        }}>
          {correct}/{total}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {accuracy}% accuracy
        </div>
      </div>

      {/* PPA Reward Breakdown */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          marginBottom: 12, fontWeight: 600, letterSpacing: 1,
        }}>
          PPA EARNED
        </div>

        {saving && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, padding: "8px 0" }}>
            Calculating reward...
          </div>
        )}

        {reward && (
          <>
            {[
              { label: "Base reward", value: `+${reward.base} PPA` },
              { label: "Speed bonus", value: `+${reward.speedBonus} PPA` },
              { label: `Streak bonus (${user?.streakDays || 0}🔥)`, value: `+${reward.streakBonus} PPA` },
              { label: `Tier bonus (${user?.tier || "NEWCOMER"})`, value: `+${reward.tierBonus} PPA` },
            ].map((row) => (
              <div key={row.label} style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 14,
              }}>
                <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0 0",
              fontSize: 18, fontWeight: 700,
            }}>
              <span>Total</span>
              <span style={{ color: "var(--accent-gold)" }}>+{reward.total} PPA</span>
            </div>
          </>
        )}

        {!saving && !reward && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
            {saved ? "No PPA earned this round" : "Saving results..."}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--text-secondary)" }}>⏱ Time taken</span>
          <span style={{ fontWeight: 600 }}>{time}s</span>
        </div>
      </div>

      {/* Updated Balance */}
      {user && reward && (
        <div className="card" style={{
          marginBottom: 16,
          background: "#00c9a711",
          border: "1px solid #00c9a744",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            New Balance
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-gold)" }}>
            {user.ppaBalance} PPA
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
        <button
          className="btn-primary"
          onClick={() => window.location.href = `/challenges/${challengeId || "1"}`}
        >
          Try Again
        </button>
        <Link href="/challenges">
          <button className="btn-primary" style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}>
            All Challenges
          </button>
        </Link>
        <Link href="/">
          <button className="btn-primary" style={{
            background: "transparent",
            border: "1px solid var(--border)",
          }}>
            Back to Home
          </button>
        </Link>
      </div>

    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 16, color: "white", textAlign: "center", paddingTop: 80 }}>
        Loading results...
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}