"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const mockPrediction = {
  id: "1",
  title: "Will ETH surpass $4,000 by Friday?",
  description:
    "Ethereum has been trading between $3,200–$3,800 this week. With upcoming network upgrades and rising DeFi activity, analysts are split on whether ETH will break the $4,000 resistance before the weekend.",
  category: "FINANCE",
  participants: 142,
  endsAt: "2026-04-25T00:00:00Z",
  options: ["Yes", "No"],
  minStake: 5,
  maxStake: 500,
};

const CONFIDENCE_LABELS = ["", "Low", "Medium", "High"];
const CONFIDENCE_COLORS = ["", "#a0a0b8", "#ffd700", "#00c9a7"];
const CONFIDENCE_MULTIPLIERS = ["", "1.2×", "1.8×", "3.0×"];

export default function PredictionDetailPage() {
  const router = useRouter();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(2);
  const [stake, setStake] = useState(10);

  const potentialReward = Math.floor(
    stake * parseFloat(CONFIDENCE_MULTIPLIERS[confidence])
  );

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    const params = new URLSearchParams({
      answer: selectedAnswer,
      confidence: String(confidence),
      stake: String(stake),
      reward: String(potentialReward),
    });
    router.push(`/predictions/1/confirm?${params.toString()}`);
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
        <Link href="/predictions" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Make Prediction</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Question Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="badge" style={{
            background: "#00c9a722",
            color: "#00c9a7",
            marginBottom: 10,
            display: "inline-flex",
          }}>
            💹 FINANCE
          </span>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
            {mockPrediction.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {mockPrediction.description}
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}>
            <span>👥 {mockPrediction.participants} participants</span>
            <span>⏱ 3d left</span>
          </div>
        </div>

        {/* Answer Selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
            YOUR ANSWER
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {mockPrediction.options.map((option) => (
              <button
                key={option}
                onClick={() => setSelectedAnswer(option)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: 12,
                  border: `2px solid ${selectedAnswer === option ? "var(--accent-primary)" : "var(--border)"}`,
                  background: selectedAnswer === option ? "#6c63ff22" : "var(--bg-card)",
                  color: selectedAnswer === option ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence Slider */}
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
              onClick={() => setStake(Math.max(mockPrediction.minStake, stake - 5))}
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
              onClick={() => setStake(Math.min(mockPrediction.maxStake, stake + 5))}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "white", fontSize: 20, cursor: "pointer",
              }}
            >+</button>
          </div>

          {/* Quick Select */}
          <div style={{ display: "flex", gap: 8 }}>
            {[10, 25, 50, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => setStake(amount)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  borderRadius: 8,
                  border: `1px solid ${stake === amount ? "var(--accent-primary)" : "var(--border)"}`,
                  background: stake === amount ? "#6c63ff22" : "var(--bg-secondary)",
                  color: stake === amount ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Potential Reward Preview */}
        <div className="card" style={{
          marginBottom: 20,
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

        {/* Submit */}
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!selectedAnswer}
          style={{
            opacity: selectedAnswer ? 1 : 0.4,
            cursor: selectedAnswer ? "pointer" : "not-allowed",
          }}
        >
          Submit Prediction
        </button>

      </div>
    </div>
  );
}