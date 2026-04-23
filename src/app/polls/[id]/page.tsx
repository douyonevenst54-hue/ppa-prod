"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useParams } from "next/navigation";

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

interface Poll {
  id: string;
  title: string;
  category: string;
  participantCount: number;
  endsAt: string;
  pollOptions: PollOption[];
}

export default function PollVotePage() {
  const params = useParams();
  const pollId = params.id as string;
  const { user, refreshUser } = useAuth();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ppaWeight, setPpaWeight] = useState(0);
  const [ppaEarned, setPpaEarned] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPoll();
  }, [pollId]);

  async function fetchPoll() {
    try {
      const res = await fetch(`/api/polls/${pollId}`);
      const data = await res.json();
      if (data.poll) setPoll(data.poll);
    } catch (err) {
      console.error("Failed to fetch poll:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalVotes = poll?.pollOptions.reduce((sum, o) => sum + o.voteCount, 0) || 0;

  const getPercent = (votes: number) =>
    totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);

  const handleVote = async () => {
    if (!selected || !user?.id || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          pollOptionId: selected,
          ppaWeight,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setSubmitting(false);
        return;
      }

      setPpaEarned(data.ppaEarned || 5);
      await refreshUser();
      await fetchPoll();
      setVoted(true);
    } catch {
      setError("Failed to submit vote. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading poll...
      </div>
    );
  }

  if (!poll) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Poll not found.
        <Link href="/polls" style={{ display: "block", marginTop: 16, color: "var(--accent-primary)" }}>
          ← Back to Polls
        </Link>
      </div>
    );
  }

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
        <Link href="/polls" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {voted ? "Poll Results" : "Cast Your Vote"}
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Question */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
            {poll.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            🗳️ {(totalVotes + (voted ? 0 : 0)).toLocaleString()} total votes
          </div>
        </div>

        {/* Options */}
        <div style={{ marginBottom: 16 }}>
          {poll.pollOptions.map((option) => {
            const percent = getPercent(option.voteCount);
            const isSelected = selected === option.id;
            const isWinner = voted && option.voteCount === Math.max(...poll.pollOptions.map(o => o.voteCount));

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
                    : isWinner ? "#00c9a7" : "var(--border)"}`,
                  background: "var(--bg-card)",
                  cursor: voted ? "default" : "pointer",
                  position: "relative",
                  overflow: "hidden",
                  textAlign: "left",
                  transition: "border-color 0.2s",
                }}
              >
                {voted && (
                  <div style={{
                    position: "absolute", left: 0, top: 0,
                    height: "100%", width: `${percent}%`,
                    background: isSelected ? "#6c63ff22" : isWinner ? "#00c9a711" : "#ffffff08",
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
                        width: 20, height: 20, borderRadius: "50%",
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
                      fontSize: 14, fontWeight: 700,
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
                    flex: 1, padding: "8px 4px", borderRadius: 8,
                    border: `1px solid ${ppaWeight === amount ? "var(--accent-primary)" : "var(--border)"}`,
                    background: ppaWeight === amount ? "#6c63ff22" : "var(--bg-secondary)",
                    color: ppaWeight === amount ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 12, cursor: "pointer",
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
              +{ppaEarned} PPA
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              Added to your balance
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 12, padding: 12, borderRadius: 10,
            background: "#ff658422", border: "1px solid #ff658444",
            fontSize: 13, color: "#ff6584", textAlign: "center",
          }}>
            ❌ {error}
          </div>
        )}

        {/* CTA */}
        {!voted ? (
          <button
            className="btn-primary"
            onClick={handleVote}
            disabled={!selected || submitting}
            style={{
              opacity: selected && !submitting ? 1 : 0.4,
              cursor: selected && !submitting ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Submitting..." : "Submit Vote"}
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