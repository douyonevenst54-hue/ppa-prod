"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const CATEGORIES = ["FINANCE", "SPORTS", "TECH", "POLITICS", "SOCIAL", "GENERAL"];

export default function CreatePredictionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [days, setDays] = useState(3);
  const [rewardPool, setRewardPool] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handlePublish = async () => {
    if (!title.trim() || !user?.id) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: user.id,
          title: title.trim(),
          category,
          options: ["Yes", "No"],
          durationDays: days,
          rewardPool,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => router.push("/creator"), 2000);
    } catch {
      setError("Failed to publish. Try again.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        padding: 16, minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Published!</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Your prediction is live. Redirecting...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/creator" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>🧠 New Prediction</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            QUESTION
          </div>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Will Bitcoin hit $100K before June?"
            maxLength={120}
            rows={3}
            style={{
              width: "100%", background: "var(--bg-card)",
              border: "1px solid var(--border)", borderRadius: 12,
              padding: "12px 14px", color: "var(--text-primary)",
              fontSize: 15, resize: "none", outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right", marginTop: 4 }}>
            {title.length}/120
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            CATEGORY
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "8px 14px", borderRadius: 20,
                border: `1px solid ${category === cat ? "var(--accent-primary)" : "var(--border)"}`,
                background: category === cat ? "#6c63ff22" : "var(--bg-card)",
                color: category === cat ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: 13, cursor: "pointer",
                fontWeight: category === cat ? 600 : 400,
              }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            DURATION
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 3, 7, 14].map((d) => (
              <button key={d} onClick={() => setDays(d)} style={{
                flex: 1, padding: "10px 4px", borderRadius: 10,
                border: `1px solid ${days === d ? "var(--accent-primary)" : "var(--border)"}`,
                background: days === d ? "#6c63ff22" : "var(--bg-secondary)",
                color: days === d ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: 13, cursor: "pointer",
                fontWeight: days === d ? 600 : 400,
              }}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Reward Pool */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>
            REWARD POOL (OPTIONAL)
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            Contribute PPA to boost visibility
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 25, 50, 100].map((amount) => (
              <button key={amount} onClick={() => setRewardPool(amount)} style={{
                flex: 1, padding: "10px 4px", borderRadius: 10,
                border: `1px solid ${rewardPool === amount ? "var(--accent-gold)" : "var(--border)"}`,
                background: rewardPool === amount ? "#ffd70022" : "var(--bg-secondary)",
                color: rewardPool === amount ? "var(--accent-gold)" : "var(--text-secondary)",
                fontSize: 12, cursor: "pointer",
              }}>
                {amount === 0 ? "None" : `${amount}`}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: 12, borderRadius: 10,
            background: "#ff658422", border: "1px solid #ff658444",
            fontSize: 13, color: "#ff6584", textAlign: "center",
          }}>
            ❌ {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handlePublish}
          disabled={!title.trim() || submitting}
          style={{ opacity: title.trim() && !submitting ? 1 : 0.4, cursor: title.trim() && !submitting ? "pointer" : "not-allowed" }}
        >
          {submitting ? "Publishing..." : "Publish Prediction"}
        </button>
      </div>
    </div>
  );
}