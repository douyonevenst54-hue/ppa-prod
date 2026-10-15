"use client";

/**
 * Challenge play screen.
 *
 * ── THE CLIENT NO LONGER KNOWS THE ANSWERS ────────────────────────────────
 *
 * This screen used to grade each tap against `question.correctAnswer`, which
 * meant the API had to ship the answer key to the browser. Anyone could read
 * it before answering. Now the screen collects what was chosen, hands the set
 * to the result screen, and the server grades and reveals.
 *
 * The cost is that "✓ correct!" can't appear the instant you tap — the app
 * doesn't know yet. So a tap highlights the choice and moves on, and every
 * answer is revealed together at the end.
 *
 * Answers travel in sessionStorage rather than the URL: a query string would
 * put them in history and in any shared link, and they're too long for one.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { stashAttempt } from "@/lib/ppa/attempt";

interface Question {
  id: string;
  text: string;
  options: string[];
  category?: string;
  difficulty?: string;
}

interface Challenge {
  id: string;
  title: string;
  category: string;
  questions: Question[];
  creator: { username: string };
}

const SECONDS_PER_QUESTION = 15;

export default function ChallengePage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartRef = useRef<number>(0);
  const runStartRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/challenges/${challengeId}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.error === "not_enough_questions") {
          setLoadError(
            "This category doesn't have enough questions in rotation yet.",
          );
        } else if (data.challenge) {
          setChallenge({
            ...data.challenge,
            questions: data.challenge.questions.map(
              (q: Question & { options: unknown }) => ({
                ...q,
                options: Array.isArray(q.options)
                  ? q.options
                  : JSON.parse(q.options as string),
              }),
            ),
          });
        }
      } catch {
        if (!cancelled) setLoadError("Couldn't load this challenge.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  const advance = useCallback(
    (questionId: string, answer: string) => {
      if (!challenge) return;

      const next = [...answers, { questionId, answer }];
      const total = challenge.questions.length;

      if (next.length >= total) {
        const secondsTaken = Math.max(
          1,
          Math.round((Date.now() - runStartRef.current) / 1000),
        );
        // If storage is unavailable the result screen says the attempt couldn't
        // be scored, rather than showing a score nobody was paid for.
        stashAttempt(challengeId, {
          answers: next,
          secondsTaken,
          contentId: challengeId,
        });
        router.push(`/challenges/${challengeId}/result`);
        return;
      }

      setAnswers(next);
      setCurrentQ(next.length);
      setSelected(null);
      setLocked(false);
      setTimeLeft(SECONDS_PER_QUESTION);
      questionStartRef.current = Date.now();
    },
    [answers, challenge, challengeId, router],
  );

  useEffect(() => {
    if (!started || locked || !challenge) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setLocked(true);
          // Out of time counts as unanswered. An empty string matches no
          // option, so the server grades it wrong.
          const q = challenge.questions[currentQ];
          setTimeout(() => advance(q.id, ""), 900);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, currentQ, locked, advance, challenge]);

  const handleSelect = (option: string) => {
    if (locked || !challenge) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(option);
    setLocked(true);
    const q = challenge.questions[currentQ];
    setTimeout(() => advance(q.id, option), 450);
  };

  const handleStart = () => {
    setStarted(true);
    setTimeLeft(SECONDS_PER_QUESTION);
    questionStartRef.current = Date.now();
    runStartRef.current = Date.now();
  };

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading challenge...
      </div>
    );
  }

  if (loadError || !challenge || challenge.questions.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
        <div style={{ marginBottom: 16, fontSize: 14, color: "var(--text-secondary)" }}>
          {loadError ?? "Challenge not found."}
        </div>
        <Link href="/challenges" style={{ color: "var(--accent-primary)" }}>← Back</Link>
      </div>
    );
  }

  const questions = challenge.questions;
  const total = questions.length;
  const question = questions[currentQ];
  const progress = (currentQ / total) * 100;

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
              <span>⏱ {SECONDS_PER_QUESTION}s each</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
              HOW TO PLAY
            </div>
            {[
              `Each question has a ${SECONDS_PER_QUESTION} second timer`,
              "Faster answers earn more PPA",
              "Your streak multiplier applies to rewards",
              "Answers are revealed together at the end",
              "Correct answers build reputation, which unlocks harder tiers",
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
        <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
          <div style={{
            height: "100%",
            width: `${(timeLeft / SECONDS_PER_QUESTION) * 100}%`,
            background: timeLeft <= 5 ? "#ff6584" : timeLeft <= 10 ? "#ffd700" : "#00c9a7",
            borderRadius: 2,
            transition: "width 1s linear",
          }} />
        </div>
      </div>

      <div style={{ padding: 16 }}>

        <div className="card" style={{ marginBottom: 20, minHeight: 100 }}>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>
            {question.text}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {question.options.map((option, i) => {
            const isSelected = selected === option;

            return (
              <button
                key={i}
                onClick={() => handleSelect(option)}
                disabled={locked}
                style={{
                  padding: "16px", borderRadius: 12,
                  border: `2px solid ${isSelected ? "var(--accent-primary)" : "var(--border)"}`,
                  background: isSelected ? "#6c63ff22" : "var(--bg-card)",
                  color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                  fontSize: 15, fontWeight: 500,
                  cursor: locked ? "default" : "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 10,
                  opacity: locked && !isSelected ? 0.5 : 1,
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isSelected ? "var(--accent-primary)" : "var(--bg-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  color: isSelected ? "white" : "var(--text-secondary)",
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        <div style={{
          marginTop: 16, textAlign: "center",
          fontSize: 12, color: "var(--text-secondary)",
        }}>
          Answers are revealed at the end
        </div>

      </div>
    </div>
  );
}
