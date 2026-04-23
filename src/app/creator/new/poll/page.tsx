"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const CATEGORIES = ["FINANCE", "SPORTS", "TECH", "POLITICS", "SOCIAL", "GENERAL"];

export default function CreatePollPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [category, setCategory] = useState("GENERAL");
  const [days, setDays] = useState(3);
  const [weighted, setWeighted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const validOptions = options.filter(o => o.trim());
  const canPublish = question.trim() && validOptions.length >= 2;

  const handlePublish = async () => {
    if (!canPublish || !user?.id) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: user.id,
          title: question.trim(),
          category,
          options: validOptions,
          durationDays: days,
          weighted,
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
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Poll Published!</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Redirecting...</div>
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
        <div style={{ fontSize: 18, fontWeight: 700 }}>🗳️ New Poll</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Question */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            QUESTION
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Which crypto will outperform in Q2 2026?"
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
            {question.length}/120
          </div>
        </div>

        {/* Options */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            OPTIONS ({options.length}/6)
          </div>
          {options.map((option, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={60}
                style={{
                  flex: 1, background: "var(--bg-card)",
                  border: "1px solid var(--border)", borderRadius: 10,
                  padding: "12px 14px", color: "var(--text-primary)",
                  fontSize: 14, outline: "none", fontFamily: "inherit",
                }}
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} style={{
                  width: 40, height: 44, borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "#ff658422", color: "#ff6584",
                  fontSize: 18, cursor: "pointer",
                }}>×</button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button onClick={addOption} style={{
              width: "100%", padding: "10px", borderRadius: 10,
              border: "1px dashed var(--border)", background: "transparent",
              color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
            }}>
              + Add Option
            </button>
          )}
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

        {/* Weighted Toggle */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Weighted Voting</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Allow users to back their vote with PPA
              </div>
            </div>
            <button
              onClick={() => setWeighted(!weighted)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: "none",
                background: weighted ? "var(--accent-primary)" : "var(--border)",
                cursor: "pointer", position: "relative", transition: "background 0.2s",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: "50%", background: "white",
                position: "absolute", top: 3,
                left: weighted ? 25 : 3, transition: "left 0.2s",
              }} />
            </button>
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
          disabled={!canPublish || submitting}
          style={{ opacity: canPublish && !submitting ? 1 : 0.4, cursor: canPublish && !submitting ? "pointer" : "not-allowed" }}
        >
          {submitting ? "Publishing..." : "Publish Poll"}
        </button>
      </div>
    </div>
  );
}