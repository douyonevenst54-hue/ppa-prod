"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const TIER_MULTIPLIERS: Record<string, number> = {
  NEWCOMER: 0.8,
  MEMBER: 1.0,
  TRUSTED: 1.2,
  EXPERT: 1.5,
  ELITE: 2.0,
};

function calculateReward(correct: number, total: number, time: number): number {
  const accuracy = correct / total;
  const accuracySquared = Math.pow(accuracy, 2);
  const speedBonus = Math.max(0, (total * 15 - time) / (total * 15));
  const tier = TIER_MULTIPLIERS["MEMBER"];
  const base = 20;
  return Math.floor(base * accuracySquared * (1 + speedBonus) * tier);
}

function ResultContent() {
  const params = useSearchParams();
  const correct = parseInt(params.get("correct") || "0");
  const total = parseInt(params.get("total") || "5");
  const time = parseInt(params.get("time") || "0");

  const reward = calculateReward(correct, total, time);
  const accuracy = Math.round((correct / total) * 100);
  const isPerfect = correct === total;
  const passed = correct >= Math.ceil(total / 2);

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
          {isPerfect ? "You answered everything correctly" : `${correct} out of ${total} correct`}
        </div>
      </div>

      {/* Score Card */}
      <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          color: accuracy >= 80 ? "#00c9a7" : accuracy >= 60 ? "#ffd700" : "#ff6584",
          marginBottom: 4,
        }}>
          {correct}/{total}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {accuracy}% accuracy
        </div>
      </div>

      {/* Reward Breakdown */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          PPA EARNED
        </div>

        {[
          { label: "Base reward", value: `+${Math.floor(20 * Math.pow(accuracy / 100, 2))} PPA` },
          { label: "Speed bonus", value: `+${reward - Math.floor(20 * Math.pow(accuracy / 100, 2))} PPA` },
          { label: "Streak bonus (3🔥)", value: "+0 PPA" },
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
          fontSize: 18,
          fontWeight: 700,
        }}>
          <span>Total</span>
          <span style={{ color: "var(--accent-gold)" }}>+{reward} PPA</span>
        </div>
      </div>

      {/* Time Stat */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--text-secondary)" }}>⏱ Time taken</span>
          <span style={{ fontWeight: 600 }}>{time}s</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
        <button
          className="btn-primary"
          onClick={() => window.location.href = "/challenges/1"}
        >
          Try Again
        </button>
        <Link href="/challenges">
          <button className="btn-primary" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            All Challenges
          </button>
        </Link>
        <Link href="/">
          <button className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border)" }}>
            Back to Home
          </button>
        </Link>
      </div>

    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "white" }}>Loading...</div>}>
      <ResultContent />
    </Suspense>
  );
}