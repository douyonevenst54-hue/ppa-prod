"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface EcosystemApp {
  id: string;
  name: string;
  slug: string;
  description: string;
  url: string;
  category: string;
  totalEarned: number;
  totalSpent: number;
  userCount: number;
  status: string;
}

interface EcosystemStats {
  totalApps: number;
  totalUsers: number;
  totalPPAInCirculation: number;
  totalTransactions: number;
  totalEarned: number;
  totalSpent: number;
}

const APP_ICONS: Record<string, string> = {
  "pap-pad-app": "🧠",
  "lopipo": "🎰",
  default: "⚡",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#00c9a7",
  INACTIVE: "#a0a0b8",
  SUSPENDED: "#ff6584",
};

export default function EcosystemPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<EcosystemStats | null>(null);
  const [apps, setApps] = useState<EcosystemApp[]>([]);
  const [loading, setLoading] = useState(true);

  // Register app form
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", url: "", category: "GENERAL",
  });
  const [registering, setRegistering] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEcosystem();
  }, []);

  async function fetchEcosystem() {
    try {
      const res = await fetch("/api/ecosystem/stats");
      const data = await res.json();
      setStats(data.ecosystem);
      setApps(data.apps || []);
    } catch (err) {
      console.error("Failed to fetch ecosystem:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!user?.id) return;
    setRegistering(true);
    setError("");

    try {
      const res = await fetch("/api/ecosystem/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...form }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setNewApiKey(data.apiKey);
      await fetchEcosystem();
      setShowRegister(false);
    } catch {
      setError("Failed to register app");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Header */}
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
        background: "#6c63ff11",
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⚡ PPA Ecosystem</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            One token. Multiple apps. Infinite utility.
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* New API Key Alert */}
        {newApiKey && (
          <div style={{
            marginBottom: 16, padding: 14, borderRadius: 12,
            background: "#00c9a711", border: "1px solid #00c9a744",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#00c9a7", marginBottom: 6 }}>
              ✅ App registered! Save your API key:
            </div>
            <div style={{
              fontFamily: "monospace", fontSize: 11,
              background: "var(--bg-secondary)", padding: 8,
              borderRadius: 8, wordBreak: "break-all",
              color: "var(--accent-gold)",
            }}>
              {newApiKey}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
              ⚠️ This key will not be shown again. Copy it now.
            </div>
          </div>
        )}

        {/* Global Stats */}
        {!loading && stats && (
          <>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
              ECOSYSTEM OVERVIEW
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Apps", value: stats.totalApps, icon: "🏗️", color: "#6c63ff" },
                { label: "Users", value: stats.totalUsers.toLocaleString(), icon: "👥", color: "#00c9a7" },
                { label: "PPA Supply", value: stats.totalPPAInCirculation.toLocaleString(), icon: "💰", color: "#ffd700" },
                { label: "Transactions", value: stats.totalTransactions.toLocaleString(), icon: "⚡", color: "#ff9f43" },
              ].map((stat) => (
                <div key={stat.label} className="card" style={{ textAlign: "center", padding: "14px 8px" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* PPA Flow */}
            <div className="card" style={{ marginBottom: 16, background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
                PPA FLOW
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#00c9a7" }}>
                    +{stats.totalEarned.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Total Earned</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ffd700" }}>
                    {stats.totalPPAInCirculation.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Circulating</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ff6584" }}>
                    -{stats.totalSpent.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Total Spent</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Apps List */}
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
          REGISTERED APPS
        </div>

        {apps.map((app) => (
          <div key={app.id} className="card" style={{
            marginBottom: 12,
            border: `1px solid ${STATUS_COLORS[app.status]}44`,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#6c63ff22",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 22, flexShrink: 0,
              }}>
                {APP_ICONS[app.slug] || APP_ICONS.default}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{app.name}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px",
                    borderRadius: 10,
                    background: STATUS_COLORS[app.status] + "22",
                    color: STATUS_COLORS[app.status],
                  }}>
                    {app.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.4 }}>
                  {app.description}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-secondary)" }}>
                  <span>👥 {app.userCount} users</span>
                  <span>💰 {app.totalEarned.toLocaleString()} earned</span>
                  <span>🔥 {app.totalSpent.toLocaleString()} spent</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {apps.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)", fontSize: 13 }}>
            No apps registered yet.
          </div>
        )}

        {/* Register New App (Admin only) */}
        {user?.username === "douyonevenst54" && (
          <>
            <div style={{ marginTop: 8, marginBottom: 12 }}>
              <button
                className="btn-primary"
                onClick={() => setShowRegister(!showRegister)}
                style={{ background: showRegister ? "var(--bg-card)" : undefined }}
              >
                {showRegister ? "Cancel" : "➕ Register New App"}
              </button>
            </div>

            {showRegister && (
              <div className="card" style={{ border: "1px solid #6c63ff44" }}>
                <div style={{ fontSize: 13, color: "var(--accent-primary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
                  REGISTER APP
                </div>

                {[
                  { key: "name", placeholder: "Pap-Pad-App", label: "App Name" },
                  { key: "slug", placeholder: "pap-pad-app", label: "Slug (unique ID)" },
                  { key: "url", placeholder: "https://ppa-prod.vercel.app", label: "App URL" },
                ].map((field) => (
                  <div key={field.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {field.label}
                    </div>
                    <input
                      value={form[field.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      style={{
                        width: "100%", background: "var(--bg-secondary)",
                        border: "1px solid var(--border)", borderRadius: 10,
                        padding: "10px 12px", color: "var(--text-primary)",
                        fontSize: 13, outline: "none", fontFamily: "inherit",
                      }}
                    />
                  </div>
                ))}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Description
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What does this app do?"
                    rows={2}
                    style={{
                      width: "100%", background: "var(--bg-secondary)",
                      border: "1px solid var(--border)", borderRadius: 10,
                      padding: "10px 12px", color: "var(--text-primary)",
                      fontSize: 13, outline: "none", fontFamily: "inherit",
                      resize: "none",
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    marginBottom: 10, padding: 10, borderRadius: 8,
                    background: "#ff658422", fontSize: 12, color: "#ff6584",
                  }}>
                    ❌ {error}
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={handleRegister}
                  disabled={registering || !form.name || !form.slug || !form.url}
                  style={{ opacity: registering ? 0.6 : 1 }}
                >
                  {registering ? "Registering..." : "Register App"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Info */}
        <div className="card" style={{
          marginTop: 16,
          background: "#6c63ff11",
          border: "1px solid #6c63ff44",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--accent-primary)" }}>
            ⚡ How PPA Ecosystem Works
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Every registered app shares the same PPA token supply.
            Users earn and spend PPA across all apps using one balance.
            More apps = more utility = higher PPA value.
          </div>
        </div>

      </div>
    </div>
  );
}