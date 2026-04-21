"use client";

import { useState } from "react";
import Link from "next/link";

const mockPoll = {
  id: "1",
  question: "Which crypto will outperform in Q2 2026?",
  category: "FINANCE",
  totalVotes: 1243,
  endsAt: "2026-04-28T00:00:00Z",
  options: [
    { id: "a", text: "Bitcoin", votes: 487 },
    { id: "b", text: "Ethereum", votes: 391 },
    { id: "c", text: "Solana", votes: 241 },
    { id: "d", text: "BNB", votes: 124 },
  ],
};

export default function PollVotePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [ppaWeight, setPpaWeight] = useState(0);

  const totalVotes = mockPoll.options.reduce((sum, o) => sum + o.votes, 0);

  const getPercent = (votes: number) =>
    Math.round((votes / totalVotes) * 100);

  const handleVote = () => {
    if (!selected) return;
    setVoted(true);
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
        <Link href="/polls" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {voted ? "Poll Results" : "Cast Your Vote"}
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Question */}
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="badge" style={{
            background: "#00c9a722",
            color: "#00c9a7",
            marginBottom: 10,
            display: "inline-flex",
          }}>
            💹 FINANCE
          </span>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
            {mockPoll.question}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            🗳️ {(totalVotes + (voted ? 1 : 0)).toLocaleString()} total votes
          </div>
        </div>

        {/* Options */}
        <div style={{ marginBottom: 16 }}>
          {mockPoll.options.map((option) => {
            const percent = getPercent(option.votes);
            const isSelected = selected === option.id;
            const isWinner = voted && option.votes === Math.max(...mockPoll.options.map(o => o.votes));

            return (
              <button
                key={option.id}
                onClick={() => !voted && setSelected(option.id)}
                disabled={voted}
                style={{
                  width: "100%",
                  marginBottom: 10,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `2px solid ${isSelected || (voted && isSelected)
                    ? "var(--accent-primary)"
                    : isWinner
                    ? "#00c9a7"
                    : "var(--border)"}`,
                  background: "var(--bg-card)",
                  cursor: voted ? "default" : "pointer",
                  position: "relative",
                  overflow: "hidden",
                  textAlign: "left",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Progress Fill */}
                {voted && (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${percent}%`,
                    background: isSelected
                      ? "#6c63ff22"
                      : isWinner
                      ? "#00c9a711"
                      : "#ffffff08",
                    transition: "width 0.6s ease",
                  }} />
                )}

                <div style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {!voted && (
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "var(--accent-primary)" : "var(--border)"}`,
                        background: isSelected ? "var(--accent-primary)" : "transparent",
                        flexShrink: 0,
                      }} />
                    )}
                    {voted && isWinner && <span style={{ fontSize: 14 }}>🏆</span>}
                    {voted && isSelected && !isWinner && <span style={{ fontSize: 14 }}>✓</span>}
                    <span style={{
                      fontSize: 14,
                      fontWeight: isSelected || isWinner ? 600 : 400,
                      color: isSelected || isWinner ? "var(--text-primary)" : "var(--text-secondary)",
                    }}>
                      {option.text}
                    </span>
                  </div>
                  {voted && (
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isWinner ? "#00c9a7" : "var(--text-secondary)",
                    }}>
                      {percent}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* PPA Weight (before voting) */}
        {!voted && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
              BACK YOUR VOTE WITH PPA (OPTIONAL)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[0, 5, 10, 25].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setPpaWeight(amount)}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: `1px solid ${ppaWeight === amount ? "var(--accent-primary)" : "var(--border)"}`,
                    background: ppaWeight === amount ? "#6c63ff22" : "var(--bg-secondary)",
                    color: ppaWeight === amount ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {amount === 0 ? "None" : `${amount} PPA`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* After Vote — Reward */}
        {voted && (
          <div className="card" style={{
            marginBottom: 16,
            background: "#00c9a711",
            border: "1px solid #00c9a744",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
              PPA Earned for voting
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-gold)" }}>
              +5 PPA
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              Added to your balance
            </div>
          </div>
        )}

        {/* CTA */}
        {!voted ? (
          <button
            className="btn-primary"
            onClick={handleVote}
            disabled={!selected}
            style={{
              opacity: selected ? 1 : 0.4,
              cursor: selected ? "pointer" : "not-allowed",
            }}
          >
            Submit Vote
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/polls">
              <button className="btn-primary">More Polls</button>
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
        )}

      </div>
    </div>
  );
}