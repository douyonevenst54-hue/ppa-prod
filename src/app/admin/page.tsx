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

const CATEGORY_ICONS: Record<string, string> = {
  FINANCE: "💹",
  SPORTS: "⚽",
  TECH: "💻",
  POLITICS: "🏛️",
  SOCIAL: "💬",
  GENERAL: "🧠",
};

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
  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ResolveResult>>({});
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");

  const fetchPredictions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/predictions?userId=${user.id}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setPredictions(data.predictions || []);
    } catch {
      setError("Failed to load predictions");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const handleResolve = async (contentId: string, correctAnswer: string) => {
    if (!user?.id || resolving) return;
    setResolving(contentId);

    try {
      const res = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          contentId,
          correctAnswer,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setResults(prev => ({ ...prev, [contentId]: data }));
      await fetchPredictions();
    } catch {
      setError("Failed to resolve prediction");
    } finally {
      setResolving(null);
    }
  };

  const filtered = predictions.filter(p =>
    filter === "ALL" ? true : p.status === filter
  );

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading admin panel...
      </div>
    );
  }

  if (error === "Unauthorized") {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access Denied</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Admin access only.
        </div>
        <Link href="/" style={{ display: "block", marginTop: 16, color: "var(--accent-primary)" }}>
          ← Back to Home
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
        display: "flex", alignItems: "center", gap: 12,
        background: "#ff658411",
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⚡ Admin Panel</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Resolve predictions • Manage content
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total", value: predictions.length, color: "var(--text-primary)" },
            { label: "Active", value: predictions.filter(p => p.status === "ACTIVE").length, color: "#00c9a7" },
            { label: "Resolved", value: predictions.filter(p => p.status === "RESOLVED").length, color: "#6c63ff" },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 16,
          background: "var(--bg-card)", padding: 4, borderRadius: 12,
        }}>
          {(["ALL", "ACTIVE", "RESOLVED"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flex: 1, padding: "8px", borderRadius: 10, border: "none",
              background: filter === f ? "var(--accent-primary)" : "transparent",
              color: filter === f ? "white" : "var(--text-secondary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              {f}
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

        {/* Predictions List */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            No predictions found.
          </div>
        ) : (
          filtered.map((prediction) => {
            const isExpired = new Date(prediction.endsAt) < new Date();
            const result = results[prediction.id];

            return (
              <div key={prediction.id} className="card" style={{
                marginBottom: 12,
                border: `1px solid ${STATUS_COLORS[prediction.status]}44`,
              }}>

                {/* Top */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {CATEGORY_ICONS[prediction.category]} {prediction.category}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: STATUS_COLORS[prediction.status],
                  }}>
                    {prediction.status}
                  </span>
                </div>

                {/* Title */}
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                  {prediction.title}
                </div>

                {/* Meta */}
                <div style={{
                  display: "flex", gap: 12, fontSize: 12,
                  color: "var(--text-secondary)", marginBottom: 12,
                }}>
                  <span>👥 {prediction._count.predictions} predictions</span>
                  <span>{timeLeft(prediction.endsAt)}</span>
                  <span>by {prediction.creator.username}</span>
                </div>

                {/* Resolve Result */}
                {result && (
                  <div style={{
                    marginBottom: 10, padding: 10, borderRadius: 8,
                    background: "#00c9a711", border: "1px solid #00c9a744",
                    fontSize: 12,
                  }}>
                    ✅ Resolved: <strong>{result.correctAnswer}</strong> correct •{" "}
                    {result.winnersCount}/{result.totalPredictions} winners •{" "}
                    +{result.totalPaid} PPA paid out
                  </div>
                )}

                {/* Resolve Buttons */}
                {prediction.status === "ACTIVE" && (
                  <div>
                    {isExpired ? (
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600 }}>
                          MARK CORRECT ANSWER:
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleResolve(prediction.id, "Yes")}
                            disabled={resolving === prediction.id}
                            style={{
                              flex: 1, padding: "12px",
                              borderRadius: 10, border: "2px solid #00c9a7",
                              background: "#00c9a722", color: "#00c9a7",
                              fontSize: 14, fontWeight: 700, cursor: "pointer",
                              opacity: resolving === prediction.id ? 0.5 : 1,
                            }}
                          >
                            {resolving === prediction.id ? "..." : "✅ YES"}
                          </button>
                          <button
                            onClick={() => handleResolve(prediction.id, "No")}
                            disabled={resolving === prediction.id}
                            style={{
                              flex: 1, padding: "12px",
                              borderRadius: 10, border: "2px solid #ff6584",
                              background: "#ff658422", color: "#ff6584",
                              fontSize: 14, fontWeight: 700, cursor: "pointer",
                              opacity: resolving === prediction.id ? 0.5 : 1,
                            }}
                          >
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
                        ⏳ Prediction still active — {timeLeft(prediction.endsAt)}
                      </div>
                    )}
                  </div>
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
          })
        )}
      </div>
    </div>
  );
}