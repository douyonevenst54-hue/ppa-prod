"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
}

interface Challenge {
  id: string;
  title: string;
  category: string;
  questions: Question[];
  creator: { username: string };
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#00c9a7",
  MEDIUM: "#ffd700",
  HARD: "#ff6584",
};

export default function ChallengePage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [timings, setTimings] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    fetchChallenge();
  }, [challengeId]);

  async function fetchChallenge() {
    try {
      const res = await fetch(`/api/challenges/${challengeId}`);
      const data = await res.json();
      if (data.challenge) {
        // Parse options if stored as JSON strings
        const challenge = {
          ...data.challenge,
          questions: data.challenge.questions.map((q: Question & { options: unknown }) => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
          })),
        };
        setChallenge(challenge);
      }
    } catch (err) {
      console.error("Failed to fetch challenge:", err);
    } finally {
      setLoading(false);
    }
  }

  const advance = useCallback((isCorrect: boolean, timeTaken: number) => {
    const newResults = [...results, isCorrect];
    const newTimings = [...timings, timeTaken];

    if (!challenge) return;
    const total = challenge.questions.length;

    if (currentQ + 1 >= total) {
      // Done
      const totalT = newTimings.reduce((a, b) => a + b, 0);
      setTotalTime(totalT);
      const searchParams = new URLSearchParams({
        correct: String(newResults.filter(Boolean).length),
        total: String(total),
        time: String(Math.round(totalT)),
        challengeId,
      });
      router.push(`/challenges/${challengeId}/result?${searchParams.toString()}`);
    } else {
      setResults(newResults);
      setTimings(newTimings);
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(15);
      startTimeRef.current = Date.now();
    }
  }, [results, timings, currentQ, challenge, challengeId, router]);

  useEffect(() => {
    if (!started || revealed || !challenge) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          const timeTaken = (Date.now() - startTimeRef.current) / 1000;
          setRevealed(true);
          setTimeout(() => advance(false, timeTaken), 1500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [started, currentQ, revealed, advance, challenge]);

  const handleSelect = (option: string) => {
    if (revealed || !challenge) return;
    clearInterval(timerRef.current!);
    const timeTaken = (Date.now() - startTimeRef.current) / 1000;
    setSelected(option);
    setRevealed(true);
    const isCorrect = option === challenge.questions[currentQ].correctAnswer;
    setTimeout(() => advance(isCorrect, timeTaken), 1200);
  };

  const handleStart = () => {
    setStarted(true);
    setTimeLeft(15);
    startTimeRef.current = Date.now();
  };

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading challenge...
      </div>
    );
  }

  if (!challenge) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
        <div style={{ marginBottom: 16 }}>Challenge not found.</div>
        <Link href="/challenges" style={{ color: "var(--accent-primary)" }}>← Back</Link>
      </div>
    );
  }

  const questions = challenge.questions;
  const total = questions.length;
  const question = questions[currentQ];
  const progress = ((currentQ) / total) * 100;

  // Pre-game screen
  if (!started) {
    return (
      <div style={{ padding: "0 0 80px 0" }}>
        <div style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Link href="/challenges" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{challenge.title}</div>
        </div>

        <div style={{ padding: 16 }}>
          <div className="card" style={{
            marginBottom: 16, textAlign: "center",
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              {challenge.title}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
              by {challenge.creator.username}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 14 }}>
              <span>📝 {total} Questions</span>
              <span>⏱ 15s each</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
              HOW TO PLAY
            </div>
            {[
              "Each question has a 15 second timer",
              "Faster answers earn more PPA",
              "Your streak multiplier applies to rewards",
              "Results and PPA are awarded instantly",
            ].map((rule, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "8px 0", borderBottom: "1px solid var(--border)",
                fontSize: 13,
              }}>
                <span style={{ color: "var(--accent-primary)", fontWeight: 700 }}>{i + 1}.</span>
                <span style={{ color: "var(--text-secondary)" }}>{rule}</span>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={handleStart}>
            Start Challenge 🚀
          </button>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Progress Header */}
      <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: "var(--text-secondary)" }}>
            Question {currentQ + 1} of {total}
          </span>
          <span style={{
            fontWeight: 700,
            color: timeLeft <= 5 ? "#ff6584" : timeLeft <= 10 ? "#ffd700" : "#00c9a7",
            fontSize: 16,
          }}>
            ⏱ {timeLeft}s
          </span>
        </div>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--accent-primary)",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }} />
        </div>
        {/* Timer bar */}
        <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
          <div style={{
            height: "100%",
            width: `${(timeLeft / 15) * 100}%`,
            background: timeLeft <= 5 ? "#ff6584" : timeLeft <= 10 ? "#ffd700" : "#00c9a7",
            borderRadius: 2,
            transition: "width 1s linear",
          }} />
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Question */}
        <div className="card" style={{ marginBottom: 20, minHeight: 100 }}>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>
            {question.text}
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {question.options.map((option, i) => {
            const isSelected = selected === option;
            const isCorrect = option === question.correctAnswer;
            const showResult = revealed;

            let bg = "var(--bg-card)";
            let border = "var(--border)";
            let color = "var(--text-primary)";

            if (showResult) {
              if (isCorrect) { bg = "#00c9a722"; border = "#00c9a7"; color = "#00c9a7"; }
              else if (isSelected && !isCorrect) { bg = "#ff658422"; border = "#ff6584"; color = "#ff6584"; }
            } else if (isSelected) {
              bg = "#6c63ff22"; border = "var(--accent-primary)"; color = "var(--accent-primary)";
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(option)}
                disabled={revealed}
                style={{
                  padding: "16px", borderRadius: 12,
                  border: `2px solid ${border}`,
                  background: bg, color,
                  fontSize: 15, fontWeight: 500,
                  cursor: revealed ? "default" : "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: showResult && isCorrect ? "#00c9a7" :
                              showResult && isSelected && !isCorrect ? "#ff6584" :
                              "var(--bg-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  color: showResult && (isCorrect || (isSelected && !isCorrect)) ? "white" : "var(--text-secondary)",
                }}>
                  {showResult && isCorrect ? "✓" :
                   showResult && isSelected && !isCorrect ? "✗" :
                   String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}