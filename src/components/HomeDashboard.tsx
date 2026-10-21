"use client";

/**
 * The signed-in home screen.
 *
 * ── WHAT THIS SCREEN IS FOR ───────────────────────────────────────────────
 *
 * One question: what should I do right now, and how am I doing? Everything
 * here answers one of those two. Anything that answers neither belongs on
 * another screen.
 *
 * ── THREE SHAPES OF DATA, THREE TREATMENTS ────────────────────────────────
 *
 * Accuracy is a proportion, so it gets a ring. A streak is a pattern over
 * days, so it gets a strip of days — which also shows the gaps, where a single
 * number would hide them. Tier is a category, so it is a word. Three identical
 * rings would have looked tidier and told the player less.
 *
 * ── NO INVENTED NUMBERS ───────────────────────────────────────────────────
 *
 * The page this replaces fell back to a hardcoded leaderboard with invented
 * usernames when the real one was empty. A new player here is told they are
 * new. An empty state is an invitation, not a scoreboard of strangers.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/pi-session";

const TIER_COLOR: Record<string, string> = {
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

interface Tier {
  difficulty: string;
  title: string;
  category: string | null;
  questionCount: number;
  unlocked: boolean;
  completed: boolean;
}

interface Summary {
  date: string;
  username: string;
  balance: number;
  reputation: number;
  tier: string;
  accuracy: number | null;
  predictionAccuracy: number | null;
  tierProgress: { next: string; answeredToGo: number; accuracyNeeded: number; label: string } | null;
  answered: number;
  correct: number;
  streakDays: number;
  longestStreak: number;
  week: { date: string; played: boolean }[];
  tiers: Tier[];
  tierStatus: { difficulty: string; unlocked: boolean; requires: number; remaining: number }[];
  playedToday: number;
  rank: number | null;
  top: {
    rank: number;
    username: string;
    reputation: number;
    accuracy: number;
    tier: string;
    isMe: boolean;
  }[];
}

/** Figures are set in tabular numerals so columns of numbers line up. */
const FIGURE: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export function HomeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signin" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/summary");
      if (res.status === 401) {
        setState("signin");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      setData((await res.json()) as Summary);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setState("signin");
      return;
    }
    load();
  }, [user?.id, load]);

  if (state === "loading") {
    return <Resting>Loading your day…</Resting>;
  }

  if (state === "signin") {
    return (
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, letterSpacing: -0.3 }}>
          Five questions a day
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Everyone gets the same set. Answer correctly to build reputation and
          unlock harder tiers. Sign in with Pi to start.
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>Couldn&apos;t load your day.</div>
        <button
          className="btn-primary"
          onClick={() => { setState("loading"); load(); }}
          style={{ background: "transparent", border: "1px solid var(--border)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  const next = data.tiers.find((t) => t.unlocked && !t.completed);
  const allDone = data.tiers.length > 0 && data.tiers.every((t) => !t.unlocked || t.completed);
  const locked = data.tierStatus.filter((t) => !t.unlocked);
  const others = Math.max(0, data.playedToday - 1);

  return (
    <>
      {/* ── Today ─────────────────────────────────────────────────────── */}
      <section className="card" style={{
        marginBottom: 14,
        padding: 20,
        border: next ? `1px solid ${TIER_COLOR[next.difficulty]}44` : "1px solid var(--border)",
      }}>
        <div style={{
          fontSize: 12, color: "var(--text-secondary)", marginBottom: 10,
          display: "flex", justifyContent: "space-between", ...FIGURE,
        }}>
          <span>{formatDay(data.date)}</span>
          <span>{sharedLine(data.playedToday, others)}</span>
        </div>

        {next ? (
          <>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.15 }}>
              {next.title}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 16px", ...FIGURE }}>
              {next.category
                ? `${CATEGORY_ICONS[next.category]} ${titleCase(next.category)}`
                : "🎲 Every category"}
              {" · "}
              {next.questionCount} questions · 15 seconds each
            </div>
            <Link href="/challenges/daily">
              <button className="btn-primary" style={{ background: TIER_COLOR[next.difficulty] }}>
                Play {next.difficulty.toLowerCase()}
              </button>
            </Link>
          </>
        ) : allDone ? (
          <>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2 }}>
              You&apos;re done for today
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.6 }}>
              A new set arrives at midnight UTC.
              {locked.length > 0 &&
                ` ${locked[0].remaining} more reputation opens ${locked[0].difficulty.toLowerCase()}.`}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Today&apos;s challenges aren&apos;t ready yet. Check back shortly.
          </div>
        )}

        {/* Locked tiers: a quiet rail, not cards competing with the hero. */}
        {locked.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            {locked.map((t) => (
              <div key={t.difficulty} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 0", fontSize: 13, color: "var(--text-secondary)", ...FIGURE,
              }}>
                <span>{titleCase(t.difficulty)}</span>
                <span>{round1(t.remaining)} more reputation</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── How you're doing ──────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 14, padding: 20 }}>
        {data.accuracy === null ? (
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Answer your first challenge and your accuracy, streak and standing
            will show up here.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <AccuracyRing percent={data.accuracy} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                  {titleCase(data.tier)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, ...FIGURE }}>
                  {data.correct} of {data.answered} right
                  {data.rank !== null && ` · ranked #${data.rank}`}
                </div>
                {data.tierProgress && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, ...FIGURE }}>
                    {data.tierProgress.answeredToGo > 0
                      ? `${data.tierProgress.answeredToGo} more to reach ${titleCase(data.tierProgress.next)}`
                      : `${titleCase(data.tierProgress.next)} at ${Math.round(data.tierProgress.accuracyNeeded * 100)}% accuracy`}
                  </div>
                )}
                <div style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 600, marginTop: 2, ...FIGURE }}>
                  {round1(data.reputation)} reputation
                </div>
              </div>
            </div>

            <WeekStrip week={data.week} streakDays={data.streakDays} />
          </>
        )}
      </section>

      {/* ── Standings ─────────────────────────────────────────────────── */}
      {data.top.length > 0 && (
        <section className="card" style={{ marginBottom: 14, padding: 20 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Standings</span>
            <Link href="/leaderboard" style={{ fontSize: 13, color: "var(--accent-primary)", textDecoration: "none" }}>
              See all
            </Link>
          </div>

          {data.top.map((u) => (
            <div key={u.username} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "9px 0", borderBottom: "1px solid var(--border)",
              fontSize: 14, ...FIGURE,
            }}>
              <span style={{
                width: 20, color: u.rank === 1 ? "#ffd700" : "var(--text-secondary)",
                fontWeight: u.rank === 1 ? 700 : 400,
              }}>
                {u.rank}
              </span>
              <span style={{
                flex: 1, minWidth: 0, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontWeight: u.isMe ? 700 : 500,
                color: u.isMe ? "var(--accent-primary)" : "var(--text-primary)",
              }}>
                {u.username}{u.isMe && " — you"}
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{u.accuracy}%</span>
              <span style={{ fontWeight: 600, minWidth: 48, textAlign: "right" }}>
                {round1(u.reputation)}
              </span>
            </div>
          ))}

          {data.rank !== null && data.rank > data.top.length && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, paddingTop: 11,
              fontSize: 14, color: "var(--accent-primary)", fontWeight: 600, ...FIGURE,
            }}>
              <span style={{ width: 20 }}>{data.rank}</span>
              <span style={{ flex: 1 }}>{data.username} — you</span>
              <span style={{ minWidth: 48, textAlign: "right" }}>{round1(data.reputation)}</span>
            </div>
          )}

          <div style={{
            marginTop: 12, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6,
          }}>
            Everyone answers the same questions each day, so these are comparable.
            Reputation unlocks tiers — it can&apos;t be spent, sent or redeemed.
          </div>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Accuracy as a ring, because accuracy is genuinely a proportion — the arc
 * means something. A count or a tier in the same treatment would be a circle
 * drawn around a number for decoration.
 */
function AccuracyRing({ percent }: { percent: number }) {
  const size = 84;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  const colour = percent >= 80 ? "#00c9a7" : percent >= 55 ? "#ffd700" : "#ff6584";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.5, ...FIGURE }}>
          {percent}%
        </span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>on quizzes</span>
      </div>
    </div>
  );
}

/**
 * Seven days, filled where they played.
 *
 * A streak as a single number hides its shape — "3 days" says nothing about
 * the four before it. The strip shows the gaps, which is the part worth
 * seeing.
 */
function WeekStrip({ week, streakDays }: { week: { date: string; played: boolean }[]; streakDays: number }) {
  return (
    <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {week.map((d) => (
          <div key={d.date} style={{ flex: 1 }}>
            <div
              title={d.date}
              style={{
                height: 28, borderRadius: 6,
                background: d.played ? "var(--accent-primary)" : "var(--bg-secondary)",
                border: d.played ? "none" : "1px solid var(--border)",
              }}
            />
            <div style={{
              fontSize: 10, textAlign: "center", marginTop: 4,
              color: d.played ? "var(--text-primary)" : "var(--text-secondary)",
            }}>
              {weekdayLetter(d.date)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", ...FIGURE }}>
        {streakDays > 0
          ? `${streakDays} day${streakDays === 1 ? "" : "s"} in a row`
          : "Play today to start a streak"}
      </div>
    </div>
  );
}

function Resting({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "32px 0", textAlign: "center",
      color: "var(--text-secondary)", fontSize: 14,
    }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function sharedLine(playedToday: number, others: number): string {
  if (playedToday === 0) return "No one has played yet";
  if (others === 0) return "First one in today";
  return `${others} other${others === 1 ? "" : "s"} played today`;
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function weekdayLetter(iso: string): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
    .charAt(0);
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** One decimal, and no trailing ".0" to add noise to a column of figures. */
function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
