"use client";

/**
 * Challenge result screen.
 *
 * Every number here comes from the server's response to the submission. The
 * old version read `correct` and `total` out of the URL query string and
 * rendered them, which meant the score shown was whatever the previous screen
 * — or the address bar — claimed. It also posted that score to the API, so the
 * reward had been asked for by the client.
 *
 * Now it posts the chosen answers and displays what came back: the grade, the
 * reward breakdown, the reputation gained, and whether a daily cap shortened
 * the payout.
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/pi-session";
import { readAttempt, clearAttempt } from "@/lib/ppa/attempt";

type RewardLine =
  | { kind: "delta"; label: string; value: number }
  | { kind: "multiplier"; label: string; factor: number };

interface SubmitResponse {
  correct: number;
  total: number;
  secondsTaken: number;
  breakdown: RewardLine[];
  earned: number;
  balance: number;
  reputationGain: number;
  reputation: number;
  capped: boolean;
  cappedReason: string | null;
  graded: { questionId: string; isCorrect: boolean; correctAnswer: string }[];
}

const FRIENDLY_ERROR: Record<string, string> = {
  already_submitted_today:
    "You've already played this one today. Come back tomorrow for a new set.",
  set_not_served:
    "These questions aren't today's set, so they can't be scored.",
  question_not_in_rotation:
    "One of these questions has been withdrawn from rotation.",
  challenge_closed: "This challenge has closed.",
  unauthenticated: "Sign in with Pi to save your result.",
};

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;
  const { user, refreshUser } = useAuth();

  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(true);
  const sentRef = useRef(false);

  const submit = useCallback(async () => {
    // StrictMode mounts effects twice in development; without this the second
    // run posts the same set and gets a 409 that overwrites a good result.
    if (sentRef.current) return;
    sentRef.current = true;

    const stash = readAttempt(challengeId);

    if (!stash) {
      setError("That attempt has expired. Play the challenge again to score it.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch("/api/challenges/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: stash.answers,
          secondsTaken: stash.secondsTaken,
          contentId: stash.contentId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(FRIENDLY_ERROR[data.error] ?? "Couldn't score this attempt.");
      } else {
        setResult(data as SubmitResponse);
        await refreshUser();
      }
    } catch {
      setError("Couldn't reach the server to score this attempt.");
    } finally {
      // Either way the attempt is spent: it must not be replayable from
      // storage, and it has been recorded server-side if it counted.
      clearAttempt(challengeId);
      setSubmitting(false);
    }
  }, [challengeId, refreshUser]);

  useEffect(() => {
    if (!user?.id) return;
    submit();
  }, [user?.id, submit]);

  if (submitting) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Scoring your answers...
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
        <div style={{ fontSize: 15, marginBottom: 20, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {error}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/challenges">
            <button className="btn-primary">All Challenges</button>
          </Link>
          <Link href="/">
            <button className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border)" }}>
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const { correct, total, earned, breakdown, graded } = result;
  const accuracy = Math.round((correct / total) * 100);
  const isPerfect = correct === total;
  const passed = correct >= Math.ceil(total / 2);

  return (
    <div style={{ padding: 16, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>
          {isPerfect ? "🏆" : passed ? "✅" : "📚"}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
          {isPerfect ? "Perfect Score!" : passed ? "Well Done!" : "Keep Practicing!"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {correct} out of {total} correct
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{
          fontSize: 56, fontWeight: 800,
          color: accuracy >= 80 ? "#00c9a7" : accuracy >= 60 ? "#ffd700" : "#ff6584",
          marginBottom: 4,
        }}>
          {correct}/{total}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {accuracy}% accuracy · {result.secondsTaken}s
        </div>
      </div>

      {/* Which answers were right — revealed now, not during play */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          YOUR ANSWERS
        </div>
        {graded.map((g, i) => (
          <div key={g.questionId} style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            padding: "8px 0",
            borderBottom: i < graded.length - 1 ? "1px solid var(--border)" : "none",
            fontSize: 13,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: g.isCorrect ? "#00c9a7" : "#ff6584",
              color: "white", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {g.isCorrect ? "✓" : "✗"}
            </span>
            <span style={{ color: g.isCorrect ? "var(--text-primary)" : "var(--text-secondary)" }}>
              Q{i + 1}
              {!g.isCorrect && (
                <>
                  {" — "}
                  <span style={{ color: "#00c9a7" }}>{g.correctAnswer}</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Reward, as the server computed it */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          PPA EARNED
        </div>

        {breakdown.map((line, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14,
          }}>
            <span style={{ color: "var(--text-secondary)" }}>{line.label}</span>
            <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>
              {line.kind === "delta" ? `+${line.value} PPA` : `×${line.factor}`}
            </span>
          </div>
        ))}

        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "12px 0 0", fontSize: 18, fontWeight: 700,
        }}>
          <span>Total</span>
          <span style={{ color: "var(--accent-gold)" }}>+{earned} PPA</span>
        </div>

        {result.capped && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 8,
            background: "#ffd70011", border: "1px solid #ffd70044",
            fontSize: 12, color: "#ffd700", lineHeight: 1.5,
          }}>
            Today&apos;s earning limit shortened this payout. Your score is recorded in
            full{result.cappedReason ? ` (${result.cappedReason})` : ""}.
          </div>
        )}
      </div>

      {result.reputationGain > 0 && (
        <div className="card" style={{
          marginBottom: 16, background: "#6c63ff11", border: "1px solid #6c63ff44",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-secondary)" }}>⭐ Reputation</span>
            <span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
              +{result.reputationGain} → {result.reputation}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
            Reputation unlocks harder daily tiers. It can&apos;t be spent, sent or
            redeemed.
          </div>
        </div>
      )}

      {user && (
        <div className="card" style={{
          marginBottom: 16, background: "#00c9a711",
          border: "1px solid #00c9a744", textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            New Balance
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-gold)" }}>
            {result.balance} PPA
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
        <button className="btn-primary" onClick={() => router.push("/challenges")}>
          All Challenges
        </button>
        <Link href="/">
          <button className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border)" }}>
            Back to Home
          </button>
        </Link>
      </div>

    </div>
  );
}
