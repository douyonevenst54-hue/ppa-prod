"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const mockQuestions = [
  {
    id: "q1",
    text: "What is the largest cryptocurrency by market cap?",
    options: ["Ethereum", "Bitcoin", "Solana", "BNB"],
    correct: "Bitcoin",
  },
  {
    id: "q2",
    text: "What does 'DeFi' stand for?",
    options: ["Digital Finance", "Decentralized Finance", "Defined Fiat", "Direct Funding"],
    correct: "Decentralized Finance",
  },
  {
    id: "q3",
    text: "Which consensus mechanism does Ethereum use after The Merge?",
    options: ["Proof of Work", "Proof of Stake", "Proof of History", "Delegated PoS"],
    correct: "Proof of Stake",
  },
  {
    id: "q4",
    text: "What is a 'gas fee' in blockchain?",
    options: ["A mining tax", "Transaction processing cost", "Exchange fee", "Wallet fee"],
    correct: "Transaction processing cost",
  },
  {
    id: "q5",
    text: "What year was Bitcoin created?",
    options: ["2007", "2008", "2009", "2010"],
    correct: "2009",
  },
];

const QUESTION_TIME = 15;

export default function GameplayPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [results, setResults] = useState<boolean[]>([]);
  const [timings, setTimings] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(Date.now());

  const question = mockQuestions[current];
  const total = mockQuestions.length;

  const advance = useCallback((answer: string | null) => {
    const timeTaken = QUESTION_TIME - timeLeft;
    const isCorrect = answer === question.correct;
    const newResults = [...results, isCorrect];
    const newTimings = [...timings, timeTaken];

    if (current + 1 >= total) {
      const params = new URLSearchParams({
        correct: String(newResults.filter(Boolean).length),
        total: String(total),
        time: String(newTimings.reduce((a, b) => a + b, 0)),
      });
      router.push(`/challenges/1/result?${params.toString()}`);
    } else {
      setResults(newResults);
      setTimings(newTimings);
      setCurrent(current + 1);
      setSelected(null);
      setLocked(false);
      setTimeLeft(QUESTION_TIME);
      setStartTime(Date.now());
    }
  }, [current, timeLeft, question, results, timings, total, router]);

  useEffect(() => {
    if (locked) return;
    if (timeLeft <= 0) {
      setLocked(true);
      setTimeout(() => advance(null), 600);
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, locked, advance]);

  const handleSelect = (option: string) => {
    if (locked) return;
    setSelected(option);
    setLocked(true);
    setTimeout(() => advance(option), 800);
  };

  const timerColor = timeLeft > 8 ? "#00c9a7" : timeLeft > 4 ? "#ffd700" : "#ff6584";
  const timerPercent = (timeLeft / QUESTION_TIME) * 100;

  return (
    <div style={{ padding: 16, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Progress Bar */}
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
            width: `${((current) / total) * 100}%`,
            background: "var(--accent-primary)",
            borderRadius: 4,
            transition: "width 0.3s",
          }} />
        </div>
      </div>

      {/* Timer */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          margin: "0 auto",
          background: `conic-gradient(${timerColor} ${timerPercent}%, var(--border) 0%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--bg-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 700,
            color: timerColor,
          }}>
            {timeLeft}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>
          {question.text}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {question.options.map((option, i) => {
          let bg = "var(--bg-card)";
          let border = "var(--border)";
          let color = "var(--text-primary)";

          if (locked) {
            if (option === question.correct) {
              bg = "#00c9a722";
              border = "#00c9a7";
              color = "#00c9a7";
            } else if (option === selected) {
              bg = "#ff658422";
              border = "#ff6584";
              color = "#ff6584";
            }
          } else if (option === selected) {
            bg = "#6c63ff22";
            border = "#6c63ff";
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              disabled={locked}
              style={{
                background: bg,
                border: `2px solid ${border}`,
                borderRadius: 12,
                padding: "14px 16px",
                color,
                fontSize: 15,
                fontWeight: 500,
                cursor: locked ? "default" : "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
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