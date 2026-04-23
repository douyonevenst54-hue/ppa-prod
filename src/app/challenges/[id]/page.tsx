"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
}

const QUESTION_TIME = 15;

export default function GameplayPage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [results, setResults] = useState<boolean[]>([]);
  const [timings, setTimings] = useState<number[]>([]);

  useEffect(() => {
    async function loadChallenge() {
      try {
        const res = await fetch(`/api/challenges/${challengeId}`);
        const data = await res.json();
        if (data.challenge?.questions) {
          setQuestions(data.challenge.questions);
        }
      } catch (err) {
        console.error("Failed to load challenge:", err);
      } finally {
        setLoading(false);
      }
    }
    loadChallenge();
  }, [challengeId]);

  const question = questions[current];
  const total = questions.length;

  const advance = useCallback((answer: string | null) => {
    if (!question) return;
    const timeTaken = QUESTION_TIME - timeLeft;
    const isCorrect = answer === question.correctAnswer;
    const newResults = [...results, isCorrect];
    const newTimings = [...timings, timeTaken];

    if (current + 1 >= total) {
      const params = new URLSearchParams({
  correct: String(newResults.filter(Boolean).length),
  total: String(total),
  time: String(newTimings.reduce((a, b) => a + b, 0)),
  challengeId: challengeId,
});
router.push(`/challenges/${challengeId}/result?${params.toString()}`);
    } else {
      setResults(newResults);
      setTimings(newTimings);
      setCurrent(current + 1);
      setSelected(null);
      setLocked(false);
      setTimeLeft(QUESTION_TIME);
    }
  }, [current, timeLeft, question, results, timings, total, router, challengeId]);

  useEffect(() => {
    if (loading || locked || !question) return;
    if (timeLeft <= 0) {
      setLocked(true);
      setTimeout(() => advance(null), 600);
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, locked, advance, loading, question]);

  const handleSelect = (option: string) => {
    if (locked) return;
    setSelected(option);
    setLocked(true);
    setTimeout(() => advance(option), 800);
  };

  if (loading) {
    return (
      <div style={{ padding: 16, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <div>Loading challenge...</div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div style={{ padding: 16, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <div>Challenge not found.</div>
        </div>
      </div>
    );
  }

  const timerColor = timeLeft > 8 ? "#00c9a7" : timeLeft > 4 ? "#ffd700" : "#ff6584";
  const timerPercent = (timeLeft / QUESTION_TIME) * 100;
  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <div style={{ padding: 16, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Question {current + 1} of {total}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {results.filter(Boolean).length} correct
          </span>
        </div>
        <div style={{ height: 4, background: "var(--border)", borderRadius: 4 }}>
          <div style={{
            height: "100%",
            width: `${(current / total) * 100}%`,
            background: "var(--accent-primary)",
            borderRadius: 4,
            transition: "width 0.3s",
          }} />
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          margin: "0 auto",
          background: `conic-gradient(${timerColor} ${timerPercent}%, var(--border) 0%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--bg-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: timerColor,
          }}>
            {timeLeft}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>
          {question.text}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {options.map((option, i) => {
          let bg = "var(--bg-card)";
          let border = "var(--border)";
          let color = "var(--text-primary)";

          if (locked) {
            if (option === question.correctAnswer) {
              bg = "#00c9a722"; border = "#00c9a7"; color = "#00c9a7";
            } else if (option === selected) {
              bg = "#ff658422"; border = "#ff6584"; color = "#ff6584";
            }
          } else if (option === selected) {
            bg = "#6c63ff22"; border = "#6c63ff";
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              disabled={locked}
              style={{
                background: bg, border: `2px solid ${border}`,
                borderRadius: 12, padding: "14px 16px",
                color, fontSize: 15, fontWeight: 500,
                cursor: locked ? "default" : "pointer",
                textAlign: "left", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {["A", "B", "C", "D"][i]}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}