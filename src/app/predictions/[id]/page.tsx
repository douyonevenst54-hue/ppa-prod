"use client";

/**
 * Make a prediction.
 *
 * ── STAKES REMOVED ────────────────────────────────────────────────────────
 *
 * The stake selector is gone: entry is free, nothing is debited, and a wrong
 * call costs no PPA. The server rejects any request that still carries a
 * stakeAmount, so this screen and the API agree.
 *
 * ── WHY CONFIDENCE SURVIVED ───────────────────────────────────────────────
 *
 * Deleting the stake and leaving "Low 1.2x / Medium 1.8x / High 3.0x" would
 * have broken the game: with nothing at risk, High pays most and costs nothing,
 * so it stops being a choice. Confidence now stakes REPUTATION instead — a
 * confident correct call moves your standing up sharply, a confident miss moves
 * it down. Same decision, nothing of value on the table.
 *
 * The PPA shown is what the server will actually pay: computePredictionReward
 * is the same function resolution uses, fed this user's real streak and tier.
 */

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, NotSignedInError } from "@/lib/pi-session";
import {
  computePredictionReward,
  confidenceWeight,
  CONFIDENCE_LABELS,
} from "@/lib/ppa/rewards";

interface Prediction {
  id: string;
  title: string;
  category: string;
  participantCount: number;
  endsAt: string;
  pollOptions: { id: string; text: string }[];
}

const CONFIDENCE_COLORS: Record<number, string> = {
  1: "#a0a0b8",
  2: "#ffd700",
  3: "#00c9a7",
};

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

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

export default function PredictionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const predictionId = params.id as string;
  const { user, refreshUser } = useAuth();

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/predictions/${predictionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.prediction) setPrediction(data.prediction);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [predictionId]);

  const hoursBeforeClose = prediction
    ? Math.max(0, (new Date(prediction.endsAt).getTime() - Date.now()) / 3_600_000)
    : 0;

  // The same function the server uses at resolution, so the number shown here
  // is the number that gets paid — not an optimistic guess.
  const reward = computePredictionReward({
    isCorrect: true,
    hoursBeforeClose,
    streakDays: user?.streakDays ?? 0,
    tier: user?.tier ?? "NEWCOMER",
  });

  const repGain = confidenceWeight(confidence);
  const repLoss = repGain * 0.5;

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await apiFetch("/api/predictions/submit", {
        method: "POST",
        body: JSON.stringify({
          contentId: predictionId,
          answer: selectedAnswer,
          confidenceLevel: confidence,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Couldn't submit your call.");
        setSubmitting(false);
        return;
      }

      await refreshUser();

      const confirmParams = new URLSearchParams({
        answer: selectedAnswer,
        confidence: String(confidence),
        reward: String(reward.total),
      });

      router.push(`/predictions/${predictionId}/confirm?${confirmParams}`);
    } catch (err) {
      setError(
        err instanceof NotSignedInError
          ? "Open PPA in Pi Browser and sign in to make a call."
          : "Failed to submit. Try again.",
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading prediction...
      </div>
    );
  }

  if (!prediction) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Prediction not found.
        <Link href="/predictions" style={{ display: "block", marginTop: 16, color: "var(--accent-primary)" }}>
          ← Back to Predictions
        </Link>
      </div>
    );
  }

  const color = CATEGORY_COLORS[prediction.category] || "#a0a0b8";
  const icon = CATEGORY_ICONS[prediction.category] || "🧠";

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
        <Link href="/predictions" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Make Prediction</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Question */}
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="badge" style={{
            background: color + "22",
            color,
            marginBottom: 10,
            display: "inline-flex",
          }}>
            {icon} {prediction.category}
          </span>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
            {prediction.title}
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}>
            <span>👥 {prediction.participantCount} participants</span>
            <span>⏱ {timeLeft(prediction.endsAt)}</span>
          </div>
        </div>

        {/* Free-to-enter notice. Stated once, plainly, where the decision is made. */}
        <div style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 10,
          background: "#00c9a711",
          border: "1px solid #00c9a733",
          fontSize: 13,
          color: "#00c9a7",
          textAlign: "center",
        }}>
          Free to enter · nothing at stake · a wrong call costs no PPA
        </div>

        {/* Answer */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
            YOUR ANSWER
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(prediction.pollOptions ?? []).map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedAnswer(option.text)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: `2px solid ${selectedAnswer === option.text ? "var(--accent-primary)" : "var(--border)"}`,
                  background: selectedAnswer === option.text ? "#6c63ff22" : "var(--bg-card)",
                  color: selectedAnswer === option.text ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence — now a reputation decision */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            HOW SURE ARE YOU?
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3].map((level) => (
              <button
                key={level}
                onClick={() => setConfidence(level)}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  borderRadius: 12,
                  border: `2px solid ${confidence === level ? CONFIDENCE_COLORS[level] : "var(--border)"}`,
                  background: confidence === level ? CONFIDENCE_COLORS[level] + "22" : "var(--bg-secondary)",
                  color: confidence === level ? CONFIDENCE_COLORS[level] : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center",
                }}
              >
                <div>{CONFIDENCE_LABELS[level]}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  ±{confidenceWeight(level)} rep
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
            Confident calls move your reputation further — in both directions.
            <br />
            Right: <span style={{ color: "#00c9a7" }}>+{repGain}</span>
            {"  ·  "}
            Wrong: <span style={{ color: "#ff6584" }}>−{repLoss}</span>
            {"  ·  "}
            PPA reward is the same either way.
          </div>
        </div>

        {/* Reward */}
        <div className="card" style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid #6c63ff44",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                If you call it right
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-gold)" }}>
                +{reward.total} PPA
              </div>
              {hoursBeforeClose >= 24 && (
                <div style={{ fontSize: 11, color: "#00c9a7", marginTop: 4 }}>
                  includes an early-call bonus
                </div>
              )}
            </div>
            <div style={{ fontSize: 36 }}>🎯</div>
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: 12, borderRadius: 10,
            background: "#ff658422", border: "1px solid #ff658444",
            fontSize: 13, color: "#ff6584", textAlign: "center",
          }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!selectedAnswer || submitting}
          style={{
            opacity: selectedAnswer && !submitting ? 1 : 0.4,
            cursor: selectedAnswer && !submitting ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "Submitting..." : "Submit Prediction"}
        </button>

      </div>
    </div>
  );
}
