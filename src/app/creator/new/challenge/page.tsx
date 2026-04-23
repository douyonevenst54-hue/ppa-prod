"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const CATEGORIES = ["FINANCE", "SPORTS", "TECH", "POLITICS", "SOCIAL", "GENERAL"];

interface Question {
  text: string;
  options: string[];
  correct: number;
  time: number;
}

const emptyQuestion = (): Question => ({
  text: "",
  options: ["", "", "", ""],
  correct: 0,
  time: 15,
});

export default function CreateChallengePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateQuestion = (index: number, field: keyof Question, value: unknown) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const addQuestion = () => {
    if (questions.length < 10) setQuestions([...questions, emptyQuestion()]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const canPublish = title.trim() &&
    questions.every(q =>
      q.text.trim() &&
      q.options.filter(o => o.trim()).length >= 2
    );

  const handlePublish = async () => {
    if (!canPublish || !user?.id) return;
    setSubmitting(true);
    setError("");

    try {
      const formattedQuestions = questions.map(q => ({
        text: q.text.trim(),
        options: q.options.filter(o => o.trim()),
        correctAnswer: q.options[q.correct],
        timeSeconds: q.time,
      }));

      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: user.id,
          title: title.trim(),
          category,
          difficulty,
          questions: formattedQuestions,
          durationDays: 365,
          rewardPool: 0,
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
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Challenge Published!</div>
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
        <div style={{ fontSize: 18, fontWeight: 700 }}>🎯 New Challenge</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            CHALLENGE TITLE
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Crypto Masters Quiz"
            maxLength={60}
            style={{
              width: "100%", background: "var(--bg-card)",
              border: "1px solid var(--border)", borderRadius: 12,
              padding: "12px 14px", color: "var(--text-primary)",
              fontSize: 15, outline: "none", fontFamily: "inherit",
            }}
          />
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
              }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            DIFFICULTY
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Easy", value: "EASY", color: "#00c9a7" },
              { label: "Medium", value: "MEDIUM", color: "#ffd700" },
              { label: "Hard", value: "HARD", color: "#ff6584" },
            ].map((d) => (
              <button key={d.value} onClick={() => setDifficulty(d.value)} style={{
                flex: 1, padding: "10px 4px", borderRadius: 10,
                border: `1px solid ${difficulty === d.value ? d.color : "var(--border)"}`,
                background: difficulty === d.value ? d.color + "22" : "var(--bg-secondary)",
                color: difficulty === d.value ? d.color : "var(--text-secondary)",
                fontSize: 13, cursor: "pointer",
                fontWeight: difficulty === d.value ? 600 : 400,
              }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          QUESTIONS ({questions.length}/10)
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="card" style={{ marginBottom: 12, border: "1px solid #6c63ff33" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-primary)" }}>
                Question {qi + 1}
              </div>
              {questions.length > 1 && (
                <button onClick={() => removeQuestion(qi)} style={{
                  background: "none", border: "none",
                  color: "#ff6584", cursor: "pointer", fontSize: 13,
                }}>
                  Remove
                </button>
              )}
            </div>

            <input
              value={q.text}
              onChange={(e) => updateQuestion(qi, "text", e.target.value)}
              placeholder="What is the question?"
              maxLength={120}
              style={{
                width: "100%", background: "var(--bg-secondary)",
                border: "1px solid var(--border)", borderRadius: 10,
                padding: "10px 12px", color: "var(--text-primary)",
                fontSize: 14, outline: "none", fontFamily: "inherit",
                marginBottom: 10,
              }}
            />

            {q.options.map((opt, oi) => (
              <div key={oi} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                <button
                  onClick={() => updateQuestion(qi, "correct", oi)}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    border: `2px solid ${q.correct === oi ? "#00c9a7" : "var(--border)"}`,
                    background: q.correct === oi ? "#00c9a7" : "transparent",
                    cursor: "pointer", flexShrink: 0,
                  }}
                />
                <input
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}${q.correct === oi ? " ✓ correct" : ""}`}
                  maxLength={60}
                  style={{
                    flex: 1, background: "var(--bg-secondary)",
                    border: `1px solid ${q.correct === oi ? "#00c9a744" : "var(--border)"}`,
                    borderRadius: 8, padding: "8px 12px",
                    color: "var(--text-primary)", fontSize: 13,
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            ))}

            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
              ● Tap circle to mark correct answer
            </div>

            {/* Timer */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                Time per question
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[10, 15, 30, 60].map((t) => (
                  <button key={t} onClick={() => updateQuestion(qi, "time", t)} style={{
                    flex: 1, padding: "6px 4px", borderRadius: 8,
                    border: `1px solid ${q.time === t ? "var(--accent-primary)" : "var(--border)"}`,
                    background: q.time === t ? "#6c63ff22" : "var(--bg-secondary)",
                    color: q.time === t ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 12, cursor: "pointer",
                  }}>
                    {t}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {questions.length < 10 && (
          <button onClick={addQuestion} style={{
            width: "100%", padding: "12px", borderRadius: 12,
            border: "1px dashed var(--border)", background: "transparent",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
            marginBottom: 20,
          }}>
            + Add Question
          </button>
        )}

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
          {submitting ? "Publishing..." : "Publish Challenge"}
        </button>
      </div>
    </div>
  );
}