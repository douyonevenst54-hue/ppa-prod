"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface Prediction {
  id: string;
  title: string;
  category: string;
  participantCount: number;
  endsAt: string;
  pollOptions: { id: string; text: string }[];
}

const CONFIDENCE_LABELS = ["", "Low", "Medium", "High"];
const CONFIDENCE_COLORS = ["", "#a0a0b8", "#ffd700", "#00c9a7"];
const CONFIDENCE_MULTIPLIERS = ["", "1.2×", "1.8×", "3.0×"];

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
  const [stake, setStake] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/predictions/${predictionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.prediction) setPrediction(data.prediction);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [predictionId]);

  const potentialReward = Math.floor(
    stake * parseFloat(CONFIDENCE_MULTIPLIERS[confidence])
  );

  const handleSubmit = async () => {
    if (!selectedAnswer || !user?.id) return;
    if (user.ppaBalance < stake) {
      setError("Insufficient PPA balance");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/predictions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          contentId: predictionId,
          answer: selectedAnswer,
          confidenceLevel: confidence,
          stakeAmount: stake,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setSubmitting(false);
        return;
      }

      await refreshUser();

      const confirmParams = new URLSearchParams({
        answer: selectedAnswer,
        confidence: String(confidence),
        stake: String(stake),
        reward: String(data.potentialReward || potentialReward),
      });

      router.push(`/predictions/${predictionId}/confirm?${confirmParams.toString()}`);
    } catch {
      setError("Failed to submit prediction. Try again.");
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

        {/* Question Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="badge" style={{
            background: color + "22",
            color: color,
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

        {/* Balance */}
        {user && (
          <div style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 12,
            textAlign: "right",
          }}>
            Balance:{" "}
            <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>
              {user.ppaBalance} PPA
            </span>
          </div>
        )}

        {/* Answer Selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
            YOUR ANSWER
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(prediction?.pollOptions ?? []).map((option) => (
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

        {/* Confidence Level */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            CONFIDENCE LEVEL
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
                <div style={{ fontSize: 11, marginTop: 2 }}>{CONFIDENCE_MULTIPLIERS[level]}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
            Higher confidence = higher reward, higher risk
          </div>
        </div>

        {/* Stake Input */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            STAKE AMOUNT
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button
              onClick={() => setStake(Math.max(5, stake - 5))}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "white", fontSize: 20, cursor: "pointer",
              }}
            >−</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--accent-gold)" }}>
                {stake}
              </span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)", marginLeft: 6 }}>PPA</span>
            </div>
            <button
              onClick={() => setStake(Math.min(500, stake + 5))}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "white", fontSize: 20, cursor: "pointer",
              }}
            >+</button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {[10, 25, 50, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => setStake(amount)}
                style={{
                  flex: 1, padding: "6px 4px", borderRadius: 8,
                  border: `1px solid ${stake === amount ? "var(--accent-primary)" : "var(--border)"}`,
                  background: stake === amount ? "#6c63ff22" : "var(--bg-secondary)",
                  color: stake === amount ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Potential Reward */}
        <div className="card" style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid #6c63ff44",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                If correct at {CONFIDENCE_LABELS[confidence]} confidence
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-gold)" }}>
                +{potentialReward} PPA
              </div>
            </div>
            <div style={{ fontSize: 36 }}>🎯</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 12, padding: 12, borderRadius: 10,
            background: "#ff658422", border: "1px solid #ff658444",
            fontSize: 13, color: "#ff6584", textAlign: "center",
          }}>
            ❌ {error}
          </div>
        )}

        {/* Submit */}
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