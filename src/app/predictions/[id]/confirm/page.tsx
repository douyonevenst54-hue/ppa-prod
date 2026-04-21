"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const CONFIDENCE_LABELS: Record<string, string> = {
  "1": "Low",
  "2": "Medium",
  "3": "High",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  "1": "#a0a0b8",
  "2": "#ffd700",
  "3": "#00c9a7",
};

function ConfirmContent() {
  const params = useSearchParams();
  const answer = params.get("answer") || "";
  const confidence = params.get("confidence") || "2";
  const stake = params.get("stake") || "10";
  const reward = params.get("reward") || "0";

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
        <Link href="/predictions/1" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Confirm Prediction</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Success Icon */}
        <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "#00c9a722",
            border: "2px solid #00c9a7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            margin: "0 auto 16px",
          }}>
            ✅
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Prediction Submitted!
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Your prediction has been locked in
          </div>
        </div>

        {/* Summary Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            PREDICTION SUMMARY
          </div>

          {[
            {
              label: "Your Answer",
              value: answer,
              color: answer === "Yes" ? "#00c9a7" : "#ff6584",
            },
            {
              label: "Confidence",
              value: CONFIDENCE_LABELS[confidence],
              color: CONFIDENCE_COLORS[confidence],
            },
            {
              label: "PPA Staked",
              value: `${stake} PPA`,
              color: "var(--accent-gold)",
            },
            {
              label: "Potential Reward",
              value: `+${reward} PPA`,
              color: "var(--accent-gold)",
            },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {row.label}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Info Card */}
        <div className="card" style={{
          marginBottom: 24,
          background: "#6c63ff11",
          border: "1px solid #6c63ff44",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            🔒 Your prediction is locked. Results will be revealed when the prediction period ends.
            If correct, PPA will be automatically added to your balance.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/predictions">
            <button className="btn-primary">
              Explore More Predictions
            </button>
          </Link>
          <Link href="/challenges">
            <button className="btn-primary" style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}>
              Play a Challenge
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
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "white" }}>Loading...</div>}>
      <ConfirmContent />
    </Suspense>
  );
}