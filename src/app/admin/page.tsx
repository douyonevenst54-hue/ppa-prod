"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface AdminPrediction {
  id: string;
  title: string;
  category: string;
  status: string;
  endsAt: string;
  participantCount: number;
  creator: { username: string };
  _count: { predictions: number };
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  category: string;
  difficulty: string;
  qualityScore: number;
  createdAt: string;
}

interface ResolveResult {
  success: boolean;
  totalPredictions: number;
  winnersCount: number;
  totalPaid: number;
  correctAnswer: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#00c9a7",
  RESOLVED: "#6c63ff",
  ARCHIVED: "#a0a0b8",
  PENDING: "#ffd700",
};

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

const CATEGORIES = ["GENERAL", "FINANCE", "SPORTS", "TECH", "POLITICS", "SOCIAL"];

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "⏰ Ended";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"predictions" | "questions">("predictions");

  // Predictions state
  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [predLoading, setPredLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ResolveResult>>({});
  const [predFilter, setPredFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionStats, setQuestionStats] = useState<{ category: string; _count: { id: number } }[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [genCategory, setGenCategory] = useState("GENERAL");
  const [genDifficulty, setGenDifficulty] = useState("MEDIUM");
  const [genCount, setGenCount] = useState(10);
  const [genTopic, setGenTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");
  const [questionFilter, setQuestionFilter] = useState("ALL");

  const [error, setError] = useState("");

  const fetchPredictions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/predictions?userId=${user.id}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPredictions(data.predictions || []);
    } catch { setError("Failed to load predictions"); }
    finally { setPredLoading(false); }
  }, [user?.id]);

  const fetchQuestions = useCallback(async () => {
    if (!user?.id) return;
    setQLoading(true);
    try {
      const res = await fetch(`/api/admin/questions?userId=${user.id}&category=${questionFilter}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setQuestions(data.questions || []);
      setQuestionStats(data.stats || []);
    } catch { setError("Failed to load questions"); }
    finally { setQLoading(false); }
  }, [user?.id, questionFilter]);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);
  useEffect(() => { if (activeTab === "questions") fetchQuestions(); }, [activeTab, fetchQuestions]);

  const handleResolve = async (contentId: string, correctAnswer: string) => {
    if (!user?.id || resolving) return;
    setResolving(contentId);
    try {
      const res = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, contentId, correctAnswer }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResults(prev => ({ ...prev, [contentId]: data }));
      await fetchPredictions();
    } catch { setError("Failed to resolve"); }
    finally { setResolving(null); }
  };

  const handleGenerate = async () => {
    if (!user?.id || generating) return;
    setGenerating(true);
    setGenResult("");
    try {
      const res = await fetch("/api/admin/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          category: genCategory,
          difficulty: genDifficulty,
          count: genCount,
          topic: genTopic,
        }),
      });
      const data = await res.json();
      if (data.error) { setGenResult(`❌ ${data.error}`); return; }
      setGenResult(`✅ Generated ${data.generated}, saved ${data.saved} questions!`);
      await fetchQuestions();
    } catch { setGenResult("❌ Generation failed"); }
    finally { setGenerating(false); }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!user?.id) return;
    try {
      await fetch(`/api/admin/questions?userId=${user.id}&questionId=${questionId}`, {
        method: "DELETE",
      });
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch { setError("Failed to delete"); }
  };

  if (error === "Unauthorized") {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access Denied</div>
        <Link href="/" style={{ color: "var(--accent-primary)" }}>← Back to Home</Link>
      </div>
    );
  }

  const filteredPredictions = predictions.filter(p =>
    predFilter === "ALL" ? true : p.status === predFilter
  );

  const totalQuestions = questionStats.reduce((sum, s) => sum + s._count.id, 0);

  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Header */}
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
        background: "#ff658411",
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⚡ Admin Panel</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Manage content • Generate questions
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Main Tabs */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 20,
          background: "var(--bg-card)", padding: 4, borderRadius: 12,
        }}>
          {[
            { value: "predictions", label: "🎯 Predictions" },
            { value: "questions", label: "🧠 Question Bank" },
          ].map((tab) => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value as never)} style={{
              flex: 1, padding: "10px 8px", borderRadius: 10, border: "none",
              background: activeTab === tab.value ? "var(--accent-primary)" : "transparent",
              color: activeTab === tab.value ? "white" : "var(--text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && error !== "Unauthorized" && (
          <div style={{
            marginBottom: 12, padding: 12, borderRadius: 10,
            background: "#ff658422", border: "1px solid #ff658444",
            fontSize: 13, color: "#ff6584",
          }}>
            ❌ {error}
          </div>
        )}

        {/* ── PREDICTIONS TAB ── */}
        {activeTab === "predictions" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total", value: predictions.length, color: "var(--text-primary)" },
                { label: "Active", value: predictions.filter(p => p.status === "ACTIVE").length, color: "#00c9a7" },
                { label: "Resolved", value: predictions.filter(p => p.status === "RESOLVED").length, color: "#6c63ff" },
              ].map((stat) => (
                <div key={stat.label} className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, marginBottom: 2 }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{
              display: "flex", gap: 8, marginBottom: 16,
              background: "var(--bg-card)", padding: 4, borderRadius: 12,
            }}>
              {(["ALL", "ACTIVE", "RESOLVED"] as const).map((f) => (
                <button key={f} onClick={() => setPredFilter(f)} style={{
                  flex: 1, padding: "8px", borderRadius: 10, border: "none",
                  background: predFilter === f ? "var(--accent-primary)" : "transparent",
                  color: predFilter === f ? "white" : "var(--text-secondary)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  {f}
                </button>
              ))}
            </div>

            {predLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                Loading...
              </div>
            ) : filteredPredictions.map((prediction) => {
              const isExpired = new Date(prediction.endsAt) < new Date();
              const result = results[prediction.id];
              return (
                <div key={prediction.id} className="card" style={{
                  marginBottom: 12,
                  border: `1px solid ${STATUS_COLORS[prediction.status]}44`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {CATEGORY_ICONS[prediction.category]} {prediction.category}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[prediction.status] }}>
                      {prediction.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                    {prediction.title}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                    <span>👥 {prediction._count.predictions}</span>
                    <span>{timeLeft(prediction.endsAt)}</span>
                    <span>by {prediction.creator.username}</span>
                  </div>

                  {result && (
                    <div style={{
                      marginBottom: 10, padding: 10, borderRadius: 8,
                      background: "#00c9a711", border: "1px solid #00c9a744",
                      fontSize: 12,
                    }}>
                      ✅ {result.correctAnswer} correct • {result.winnersCount}/{result.totalPredictions} winners • +{result.totalPaid} PPA
                    </div>
                  )}

                  {prediction.status === "ACTIVE" && (
                    isExpired ? (
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600 }}>
                          MARK CORRECT ANSWER:
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleResolve(prediction.id, "Yes")}
                            disabled={resolving === prediction.id}
                            style={{
                              flex: 1, padding: "12px", borderRadius: 10,
                              border: "2px solid #00c9a7", background: "#00c9a722",
                              color: "#00c9a7", fontSize: 14, fontWeight: 700,
                              cursor: "pointer", opacity: resolving === prediction.id ? 0.5 : 1,
                            }}>
                            {resolving === prediction.id ? "..." : "✅ YES"}
                          </button>
                          <button onClick={() => handleResolve(prediction.id, "No")}
                            disabled={resolving === prediction.id}
                            style={{
                              flex: 1, padding: "12px", borderRadius: 10,
                              border: "2px solid #ff6584", background: "#ff658422",
                              color: "#ff6584", fontSize: 14, fontWeight: 700,
                              cursor: "pointer", opacity: resolving === prediction.id ? 0.5 : 1,
                            }}>
                            {resolving === prediction.id ? "..." : "❌ NO"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: 10, borderRadius: 8,
                        background: "#ffd70011", border: "1px solid #ffd70044",
                        fontSize: 12, color: "#ffd700", textAlign: "center",
                      }}>
                        ⏳ {timeLeft(prediction.endsAt)}
                      </div>
                    )
                  )}

                  {prediction.status === "RESOLVED" && !result && (
                    <div style={{
                      padding: 10, borderRadius: 8,
                      background: "#6c63ff11", border: "1px solid #6c63ff44",
                      fontSize: 12, color: "#6c63ff", textAlign: "center",
                    }}>
                      ✅ Already resolved
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── QUESTION BANK TAB ── */}
        {activeTab === "questions" && (
          <>
            {/* Stats */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
                QUESTION BANK — {totalQuestions} TOTAL
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {questionStats.map((s) => (
                  <div key={s.category} style={{
                    padding: "4px 10px", borderRadius: 20,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}>
                    {CATEGORY_ICONS[s.category]} {s.category}: <strong>{s._count.id}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Generator */}
            <div className="card" style={{ marginBottom: 16, border: "1px solid #6c63ff44" }}>
              <div style={{ fontSize: 13, color: "var(--accent-primary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
                🤖 AI QUESTION GENERATOR
              </div>

              {/* Category */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>Category</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => setGenCategory(cat)} style={{
                      padding: "5px 10px", borderRadius: 16,
                      border: `1px solid ${genCategory === cat ? "var(--accent-primary)" : "var(--border)"}`,
                      background: genCategory === cat ? "#6c63ff22" : "transparent",
                      color: genCategory === cat ? "var(--accent-primary)" : "var(--text-secondary)",
                      fontSize: 11, cursor: "pointer",
                    }}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>Difficulty</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["EASY", "MEDIUM", "HARD"].map((d) => (
                    <button key={d} onClick={() => setGenDifficulty(d)} style={{
                      flex: 1, padding: "8px", borderRadius: 10,
                      border: `1px solid ${genDifficulty === d ? DIFFICULTY_COLORS[d] : "var(--border)"}`,
                      background: genDifficulty === d ? DIFFICULTY_COLORS[d] + "22" : "transparent",
                      color: genDifficulty === d ? DIFFICULTY_COLORS[d] : "var(--text-secondary)",
                      fontSize: 12, cursor: "pointer",
                    }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  How many? ({genCount})
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[5, 10, 20, 30].map((n) => (
                    <button key={n} onClick={() => setGenCount(n)} style={{
                      flex: 1, padding: "8px", borderRadius: 10,
                      border: `1px solid ${genCount === n ? "var(--accent-primary)" : "var(--border)"}`,
                      background: genCount === n ? "#6c63ff22" : "transparent",
                      color: genCount === n ? "var(--accent-primary)" : "var(--text-secondary)",
                      fontSize: 12, cursor: "pointer",
                    }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Topic Focus (optional)
                </div>
                <input
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="e.g. Bitcoin, NBA playoffs, AI companies..."
                  style={{
                    width: "100%", background: "var(--bg-secondary)",
                    border: "1px solid var(--border)", borderRadius: 10,
                    padding: "10px 12px", color: "var(--text-primary)",
                    fontSize: 13, outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>

              {genResult && (
                <div style={{
                  marginBottom: 10, padding: 10, borderRadius: 8,
                  background: genResult.startsWith("✅") ? "#00c9a711" : "#ff658411",
                  border: `1px solid ${genResult.startsWith("✅") ? "#00c9a744" : "#ff658444"}`,
                  fontSize: 13, color: genResult.startsWith("✅") ? "#00c9a7" : "#ff6584",
                }}>
                  {genResult}
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handleGenerate}
                disabled={generating}
                style={{ opacity: generating ? 0.6 : 1 }}
              >
                {generating ? "🤖 Generating..." : `Generate ${genCount} Questions with AI`}
              </button>
            </div>

            {/* Filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
              {["ALL", ...CATEGORIES].map((cat) => (
                <button key={cat} onClick={() => setQuestionFilter(cat)} style={{
                  padding: "5px 12px", borderRadius: 16, border: "none",
                  background: questionFilter === cat ? "var(--accent-primary)" : "var(--bg-card)",
                  color: questionFilter === cat ? "white" : "var(--text-secondary)",
                  fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Questions List */}
            {qLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                Loading questions...
              </div>
            ) : questions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                <div style={{ fontSize: 14 }}>No questions yet. Use the AI generator above!</div>
              </div>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 10, background: DIFFICULTY_COLORS[q.difficulty] + "22",
                        color: DIFFICULTY_COLORS[q.difficulty],
                      }}>
                        {q.difficulty}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: "var(--bg-secondary)", color: "var(--text-secondary)",
                      }}>
                        {CATEGORY_ICONS[q.category]} {q.category}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      style={{
                        background: "none", border: "none",
                        color: "#ff6584", cursor: "pointer", fontSize: 14,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>
                    {q.text}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {q.options.map((opt, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 8,
                        background: opt === q.correctAnswer ? "#00c9a722" : "var(--bg-secondary)",
                        color: opt === q.correctAnswer ? "#00c9a7" : "var(--text-secondary)",
                        border: `1px solid ${opt === q.correctAnswer ? "#00c9a744" : "var(--border)"}`,
                      }}>
                        {opt === q.correctAnswer ? "✓ " : ""}{opt}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}