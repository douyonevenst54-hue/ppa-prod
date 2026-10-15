"use client";

/**
 * The daily challenge board.
 *
 * Three tiers a day, one set of questions per tier, the same set for every
 * player — so the leaderboard compares like with like. EASY is open to
 * everyone; MEDIUM and HARD unlock on reputation earned by answering
 * correctly.
 *
 * ── WHY ONE PAGE AND NO sessionStorage ────────────────────────────────────
 *
 * The creator-challenge flow hands answers to a separate result screen, so it
 * has to stash them. Here the board, the play surface and the result are
 * phases of one component, and the answers never leave React state. Fewer
 * moving parts, and nothing to go stale if someone reloads mid-run — a reload
 * simply starts the tier again, which is harmless because the server refuses a
 * second submission for the same questions on the same day.
 *
 * ── WHAT THE LOCKED TIERS ARE FOR ─────────────────────────────────────────
 *
 * Locked tiers are shown, with what they require. A visible locked door is the
 * point: it tells a player what the next thing to earn is. Their questions are
 * not in the payload.
 *
 * Reputation gates access and nothing else. It cannot be spent, sent or
 * redeemed, and nothing is promised in exchange for accumulating it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/pi-session";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#00c9a7",
  MEDIUM: "#ffd700",
  HARD: "#ff6584",
};

const CATEGORY_ICONS: Record<string, string> = {
  FINANCE: "💹",
  SPORTS: "⚽",
  TECH: "💻",
  POLITICS: "🏛️",
  SOCIAL: "💬",
  GENERAL: "🧠",
};

interface Question {
  id: string;
  text: string;
  options: string[];
  category: string;
  difficulty: string;
}

interface DailyChallenge {
  difficulty: string;
  category: string | null;
  title: string;
  questionCount: number;
  secondsPerQuestion: number;
  unlocked: boolean;
  completed: boolean;
  questions: Question[];
}

interface Tier {
  difficulty: string;
  unlocked: boolean;
  requires: number;
  remaining: number;
}

interface DailyResponse {
  date: string;
  reputation: number;
  tiers: Tier[];
  challenges: DailyChallenge[];
}

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

const SUBMIT_ERROR: Record<string, string> = {
  already_submitted_today:
    "You've already played this tier today. A new set arrives tomorrow.",
  set_not_served: "This set is no longer today's — reload and try again.",
  question_not_in_rotation: "One of these questions has been withdrawn.",
  unauthenticated: "Sign in with Pi to save your result.",
};

export default function DailyChallengePage() {
  const { user, refreshUser } = useAuth();

  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [playing, setPlaying] = useState<DailyChallenge | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);

  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const runStartRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/challenges/daily");
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error === "Not signed in" ? "signin" : "load");
        return;
      }
      setData(body as DailyResponse);
    } catch {
      setLoadError("load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setLoadError("signin");
      return;
    }
    load();
  }, [user?.id, load]);

  const submit = useCallback(
    async (finalAnswers: { questionId: string; answer: string }[]) => {
      setSubmitting(true);
      try {
        const res = await apiFetch("/api/challenges/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: finalAnswers,
            secondsTaken: Math.max(1, Math.round((Date.now() - runStartRef.current) / 1000)),
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setSubmitError(SUBMIT_ERROR[body.error] ?? "Couldn't score this round.");
        } else {
          setResult(body as SubmitResponse);
          await refreshUser();
          load();
        }
      } catch {
        setSubmitError("Couldn't reach the server to score this round.");
      } finally {
        setSubmitting(false);
      }
    },
    [refreshUser, load],
  );

  const advance = useCallback(
    (questionId: string, answer: string) => {
      if (!playing) return;
      const next = [...answers, { questionId, answer }];

      if (next.length >= playing.questions.length) {
        setAnswers(next);
        submit(next);
        return;
      }

      setAnswers(next);
      setCurrentQ(next.length);
      setSelected(null);
      setLocked(false);
      setTimeLeft(playing.secondsPerQuestion);
    },
    [answers, playing, submit],
  );

  useEffect(() => {
    if (!playing || locked || result || submitting) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setLocked(true);
          // Out of time is an unanswered question. An empty string matches no
          // option, so the server grades it wrong.
          const q = playing.questions[currentQ];
          setTimeout(() => advance(q.id, ""), 800);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, locked, currentQ, advance, result, submitting]);

  function startTier(challenge: DailyChallenge) {
    setPlaying(challenge);
    setCurrentQ(0);
    setAnswers([]);
    setSelected(null);
    setLocked(false);
    setResult(null);
    setSubmitError(null);
    setTimeLeft(challenge.secondsPerQuestion);
    runStartRef.current = Date.now();
  }

  function backToBoard() {
    setPlaying(null);
    setResult(null);
    setSubmitError(null);
    setAnswers([]);
  }

  function handleSelect(option: string) {
    if (locked || !playing) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(option);
    setLocked(true);
    setTimeout(() => advance(playing.questions[currentQ].id, option), 400);
  }

  /* ---------------- states ---------------- */

  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Loading today&apos;s challenges...
        </div>
      </Shell>
    );
  }

  if (loadError === "signin") {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 16px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Sign in with Pi to play today&apos;s challenges and earn PPA.
          </div>
        </div>
      </Shell>
    );
  }

  if (loadError || !data) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 16px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 20 }}>
            Couldn&apos;t load today&apos;s challenges.
          </div>
          <button className="btn-primary" onClick={() => { setLoadError(null); setLoading(true); load(); }}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  /* ---------------- result ---------------- */

  if (result && playing) {
    const accuracy = Math.round((result.correct / result.total) * 100);
    const colour = DIFFICULTY_COLORS[playing.difficulty];

    return (
      <Shell>
        <div style={{ padding: 16 }}>
          <div style={{ textAlign: "center", padding: "20px 0 24px" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>
              {result.correct === result.total ? "🏆" : accuracy >= 50 ? "✅" : "📚"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {result.correct} of {result.total} correct
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              {playing.title} · {playing.difficulty} · {result.secondsTaken}s
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <Label>YOUR ANSWERS</Label>
            {result.graded.map((g, i) => (
              <div key={g.questionId} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "9px 0",
                borderBottom: i < result.graded.length - 1 ? "1px solid var(--border)" : "none",
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
                <span style={{ lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {playing.questions[i]?.text ?? `Question ${i + 1}`}
                  </span>
                  {!g.isCorrect && (
                    <>
                      <br />
                      <span style={{ color: "#00c9a7" }}>{g.correctAnswer}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <Label>PPA EARNED</Label>
            {result.breakdown.map((line, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 14,
              }}>
                <span style={{ color: "var(--text-secondary)" }}>{line.label}</span>
                <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>
                  {line.kind === "delta" ? `+${line.value}` : `×${line.factor}`}
                </span>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between",
              padding: "12px 0 0", fontSize: 18, fontWeight: 700,
            }}>
              <span>Total</span>
              <span style={{ color: "var(--accent-gold)" }}>+{result.earned} PPA</span>
            </div>
            {result.capped && (
              <div style={{
                marginTop: 12, padding: 10, borderRadius: 8,
                background: "#ffd70011", border: "1px solid #ffd70044",
                fontSize: 12, color: "#ffd700", lineHeight: 1.5,
              }}>
                Today&apos;s earning limit shortened this payout. Your score is recorded in full.
              </div>
            )}
          </div>

          {result.reputationGain > 0 && (
            <div className="card" style={{
              marginBottom: 14, background: `${colour}11`, border: `1px solid ${colour}44`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>⭐ Reputation</span>
                <span style={{ fontWeight: 700, color: colour }}>
                  +{result.reputationGain} → {result.reputation}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                Reputation unlocks harder tiers. It can&apos;t be spent, sent or redeemed.
              </div>
            </div>
          )}

          <button className="btn-primary" onClick={backToBoard}>
            Back to today&apos;s challenges
          </button>
        </div>
      </Shell>
    );
  }

  /* ---------------- submitting / submit failed ---------------- */

  if (playing && submitting) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Scoring your answers...
        </div>
      </Shell>
    );
  }

  if (playing && submitError) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 16px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
            {submitError}
          </div>
          <button className="btn-primary" onClick={backToBoard}>Back to today&apos;s challenges</button>
        </div>
      </Shell>
    );
  }

  /* ---------------- playing ---------------- */

  if (playing) {
    const question = playing.questions[currentQ];
    const total = playing.questions.length;
    const colour = DIFFICULTY_COLORS[playing.difficulty];

    return (
      <Shell>
        <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: "var(--text-secondary)" }}>
              {playing.title} · {currentQ + 1} of {total}
            </span>
            <span style={{
              fontWeight: 700, fontSize: 16,
              color: timeLeft <= 5 ? "#ff6584" : timeLeft <= 10 ? "#ffd700" : "#00c9a7",
            }}>
              ⏱ {timeLeft}s
            </span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${(currentQ / total) * 100}%`,
              background: colour, borderRadius: 3, transition: "width 0.3s ease",
            }} />
          </div>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
            <div style={{
              height: "100%",
              width: `${(timeLeft / playing.secondsPerQuestion) * 100}%`,
              background: timeLeft <= 5 ? "#ff6584" : timeLeft <= 10 ? "#ffd700" : "#00c9a7",
              borderRadius: 2, transition: "width 1s linear",
            }} />
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div className="card" style={{ marginBottom: 18, minHeight: 92 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
              {CATEGORY_ICONS[question.category]} {question.category}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>{question.text}</div>
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
                    padding: 16, borderRadius: 12,
                    border: `2px solid ${isSelected ? colour : "var(--border)"}`,
                    background: isSelected ? `${colour}22` : "var(--bg-card)",
                    color: isSelected ? colour : "var(--text-primary)",
                    fontSize: 15, fontWeight: 500, textAlign: "left",
                    cursor: locked ? "default" : "pointer",
                    transition: "all 0.2s",
                    display: "flex", alignItems: "center", gap: 10,
                    opacity: locked && !isSelected ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: isSelected ? colour : "var(--bg-secondary)",
                    color: isSelected ? "white" : "var(--text-secondary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
            Answers are revealed at the end
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------------- the board ---------------- */

  const byDifficulty = new Map(data.challenges.map((c) => [c.difficulty, c]));

  return (
    <Shell>
      <div style={{ padding: 16 }}>

        <div className="card" style={{ marginBottom: 18, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: 1 }}>
            REPUTATION
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: "var(--accent-primary)", margin: "4px 0" }}>
            {data.reputation}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Earned by answering correctly. Unlocks harder tiers — it can&apos;t be
            spent, sent or redeemed.
          </div>
        </div>

        {data.tiers.map((tier) => {
          const challenge = byDifficulty.get(tier.difficulty);
          const colour = DIFFICULTY_COLORS[tier.difficulty];
          const playable = tier.unlocked && challenge && !challenge.completed;

          return (
            <div key={tier.difficulty} className="card" style={{
              marginBottom: 12,
              border: `1px solid ${tier.unlocked ? `${colour}55` : "var(--border)"}`,
              opacity: tier.unlocked ? 1 : 0.75,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: colour }}>
                  {tier.difficulty}
                </span>
                {challenge?.completed && (
                  <span style={{ fontSize: 11, color: "#00c9a7", fontWeight: 600 }}>✓ DONE TODAY</span>
                )}
                {!tier.unlocked && (
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>🔒 LOCKED</span>
                )}
              </div>

              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                {challenge?.title ?? "Not available today"}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                {challenge
                  ? `${challenge.category ? `${CATEGORY_ICONS[challenge.category]} ${challenge.category}` : "🎲 Mixed categories"} · ${challenge.questionCount} questions · ${challenge.secondsPerQuestion}s each`
                  : "The pool is too thin for this tier today."}
              </div>

              {!tier.unlocked ? (
                <div style={{
                  padding: 10, borderRadius: 8, background: "var(--bg-secondary)",
                  fontSize: 12, color: "var(--text-secondary)", textAlign: "center",
                }}>
                  {tier.remaining} more reputation to unlock
                </div>
              ) : challenge?.completed ? (
                <div style={{
                  padding: 10, borderRadius: 8,
                  background: "#00c9a711", border: "1px solid #00c9a744",
                  fontSize: 12, color: "#00c9a7", textAlign: "center",
                }}>
                  Played today. A new set arrives tomorrow.
                </div>
              ) : playable ? (
                <button
                  className="btn-primary"
                  onClick={() => startTier(challenge!)}
                  style={{ background: colour }}
                >
                  Play {tier.difficulty.toLowerCase()} →
                </button>
              ) : (
                <div style={{
                  padding: 10, borderRadius: 8, background: "var(--bg-secondary)",
                  fontSize: 12, color: "var(--text-secondary)", textAlign: "center",
                }}>
                  Nothing to play here today.
                </div>
              )}
            </div>
          );
        })}

        <div style={{
          marginTop: 18, fontSize: 11, color: "var(--text-secondary)",
          textAlign: "center", lineHeight: 1.6,
        }}>
          Everyone gets the same questions each day ({data.date}). PPA earned here
          is for use inside Pap Pad App and is not redeemable for Pi or cash.
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href="/challenges">
            <button className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border)" }}>
              Community challenges
            </button>
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, color: "var(--text-secondary)",
      marginBottom: 10, fontWeight: 600, letterSpacing: 1,
    }}>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>📅 Daily Challenges</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Three tiers. New questions every day.
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
