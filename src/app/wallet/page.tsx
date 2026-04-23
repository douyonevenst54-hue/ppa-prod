"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  source: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  todayEarned: number;
  todaySpent: number;
  transactions: Transaction[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const txDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (txDate.getTime() === today.getTime()) return `Today, ${time}`;
  if (txDate.getTime() === yesterday.getTime()) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
}

function formatSource(source: string): string {
  if (source.startsWith("challenge_")) return "Challenge Completed";
  if (source.startsWith("prediction_correct")) return "Prediction Correct ✅";
  if (source.startsWith("prediction")) return "Prediction Stake";
  if (source.startsWith("streak_day")) {
    const day = source.split("_")[2];
    return `Streak Day ${day} 🔥`;
  }
  if (source === "poll") return "Poll Vote";
  if (source.startsWith("pi_payment_reward")) return "Pi Payment Reward";
  if (source.startsWith("pi_exchange_buy")) return "Bought PPA with Pi";
  if (source.startsWith("pi_exchange_redeem")) return "Redeemed PPA for Pi";
  if (source === "pi_payment") return "Pi Payment";
  return source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " ");
}

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchWallet();
  }, [user?.id]);

  async function fetchWallet() {
    try {
      const res = await fetch(`/api/wallet?userId=${user?.id}`);
      const data = await res.json();
      setWallet(data);
    } catch (err) {
      console.error("Failed to fetch wallet:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading wallet...
      </div>
    );
  }

  const balance = user?.ppaBalance || 0;
  const todayEarned = wallet?.todayEarned || 0;
  const todaySpent = wallet?.todaySpent || 0;
  const transactions = wallet?.transactions || [];

  return (
    <div style={{ padding: "0 0 80px 0" }}>

      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>💰 PPA Wallet</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Your earned balance</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Balance Card */}
        <div className="card" style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid #6c63ff44",
          textAlign: "center",
          padding: "28px 16px",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: 1 }}>
            CURRENT BALANCE
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: "var(--accent-gold)", marginBottom: 4 }}>
            {balance.toLocaleString()}
          </div>
          <div style={{ fontSize: 16, color: "var(--text-secondary)" }}>PPA Tokens</div>
        </div>

        {/* Today Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Earned Today", value: `+${todayEarned}`, color: "#00c9a7" },
            { label: "Spent Today", value: `-${todaySpent}`, color: "#ff6584" },
            { label: "Net Today", value: `${todayEarned - todaySpent >= 0 ? "+" : ""}${todayEarned - todaySpent}`, color: "var(--accent-gold)" },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Link href="/predictions">
            <div className="card" style={{
              textAlign: "center", padding: "16px 12px",
              cursor: "pointer", border: "1px solid #6c63ff44",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🧠</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-primary)" }}>
                Use in Predictions
              </div>
            </div>
          </Link>
          <Link href="/challenges">
            <div className="card" style={{
              textAlign: "center", padding: "16px 12px",
              cursor: "pointer", border: "1px solid #ff658444",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎯</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ff6584" }}>
                Play Challenges
              </div>
            </div>
          </Link>
        </div>

        {/* Exchange Button */}
        <Link href="/wallet/exchange">
          <div className="card" style={{
            textAlign: "center", padding: "16px 12px",
            cursor: "pointer", border: "1px solid #ffd70044",
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>⚡</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-gold)" }}>
              PPA ⇄ Pi Exchange
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              Buy PPA with $Pi or redeem PPA for $Pi
            </div>
          </div>
        </Link>

        {/* Transaction History */}
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          RECENT ACTIVITY
        </div>

        {transactions.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div>No transactions yet. Start playing to earn PPA!</div>
          </div>
        ) : (
          <div className="card" style={{ padding: "4px 16px" }}>
            {transactions.map((tx, i) => (
              <div key={tx.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: i < transactions.length - 1
                  ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: tx.amount > 0 ? "#00c9a722" : "#ff658422",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 16, flexShrink: 0,
                  }}>
                    {tx.type === "burn" ? "🔥" : tx.amount > 0 ? "⬆️" : "⬇️"}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {formatSource(tx.source)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {formatDate(tx.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: tx.type === "burn" ? "#ff9f43" :
                         tx.amount > 0 ? "#00c9a7" : "#ff6584",
                }}>
                  {tx.amount > 0 && tx.type !== "burn" ? "+" : ""}
                  {tx.amount} PPA
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legal Note */}
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 10,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          fontSize: 12, color: "var(--text-secondary)",
          textAlign: "center", lineHeight: 1.5,
        }}>
          🔒 PPA is an in-app utility token earned through skill.
          Used exclusively within Pap-Pad-App.
        </div>

      </div>
    </div>
  );
}