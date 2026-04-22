"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { usePiPayment } from "@/hooks/usePiPayment";

const PI_TO_PPA = 1000;
const MIN_REDEEM = 5000;
const MIN_ACCURACY = 65;

export default function ExchangePage() {
  const { user } = useAuth();
  const { createPayment } = usePiPayment();
  const [tab, setTab] = useState<"buy" | "redeem">("buy");
  const [piAmount, setPiAmount] = useState(1);
  const [ppaAmount, setPpaAmount] = useState(5000);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const ppaFromPi = piAmount * PI_TO_PPA;
  const piFromPpa = ((ppaAmount * 0.97) * 0.0008).toFixed(4);
  const accuracyOk = (user?.accuracyRate || 0) * 100 >= MIN_ACCURACY;
  const balanceOk = (user?.ppaBalance || 0) >= ppaAmount;

  const handleBuy = () => {
    if (!user) return;
    setLoading(true);
    setStatus("⏳ Opening Pi payment...");

    createPayment({
      amount: piAmount,
      memo: `Buy ${ppaFromPi} PPA on Pap-Pad-App`,
      metadata: { type: "buy_ppa", userId: user.id, ppaAmount: ppaFromPi },
      userId: user.id,
      onSuccess: () => {
        setStatus(`✅ Success! +${ppaFromPi} PPA added to your balance.`);
        setLoading(false);
      },
      onCancel: () => {
        setStatus("⚠️ Payment cancelled.");
        setLoading(false);
      },
      onError: (err) => {
        setStatus(`❌ ${err}`);
        setLoading(false);
      },
    });
  };

  const handleRedeem = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("⏳ Processing redemption...");

    try {
      const res = await fetch("/api/payments/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          direction: "redeem",
          amount: ppaAmount,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus(`✅ Redemption queued! ${piFromPpa}π will arrive within 24h.`);
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch {
      setStatus("❌ Redemption failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/wallet" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>⚡ PPA Exchange</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Convert between $Pi and PPA
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Balance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-gold)" }}>
              {user?.ppaBalance || 0}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>PPA Balance</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#6c63ff" }}>
              {Math.round((user?.accuracyRate || 0) * 100)}%
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Accuracy Rate</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 16,
          background: "var(--bg-card)", padding: 4, borderRadius: 12,
        }}>
          {(["buy", "redeem"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              border: "none",
              background: tab === t ? "var(--accent-primary)" : "transparent",
              color: tab === t ? "white" : "var(--text-secondary)",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              {t === "buy" ? "Buy PPA" : "Redeem PPA"}
            </button>
          ))}
        </div>

        {/* Buy Tab */}
        {tab === "buy" && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
                YOU PAY ($Pi)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[0.5, 1, 2, 5].map((amt) => (
                  <button key={amt} onClick={() => setPiAmount(amt)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 10,
                    border: `1px solid ${piAmount === amt ? "var(--accent-primary)" : "var(--border)"}`,
                    background: piAmount === amt ? "#6c63ff22" : "var(--bg-secondary)",
                    color: piAmount === amt ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 13, cursor: "pointer",
                  }}>
                    {amt}π
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{
              marginBottom: 16, textAlign: "center",
              background: "linear-gradient(135deg, #1a1a2e, #16213e)",
              border: "1px solid #6c63ff44",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                YOU RECEIVE
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-gold)" }}>
                {ppaFromPi.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>PPA Tokens</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                Rate: 1π = {PI_TO_PPA} PPA
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleBuy}
              disabled={loading}
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              {loading ? "Processing..." : `Buy ${ppaFromPi.toLocaleString()} PPA for ${piAmount}π`}
            </button>
          </>
        )}

        {/* Redeem Tab */}
        {tab === "redeem" && (
          <>
            {!accuracyOk && (
              <div className="card" style={{
                marginBottom: 16, background: "#ff658411",
                border: "1px solid #ff658444",
              }}>
                <div style={{ fontSize: 13, color: "#ff6584" }}>
                  ⚠️ You need {MIN_ACCURACY}% accuracy to redeem. Current: {Math.round((user?.accuracyRate || 0) * 100)}%
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
                REDEEM AMOUNT (PPA)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[5000, 10000, 25000, 50000].map((amt) => (
                  <button key={amt} onClick={() => setPpaAmount(amt)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 10,
                    border: `1px solid ${ppaAmount === amt ? "var(--accent-gold)" : "var(--border)"}`,
                    background: ppaAmount === amt ? "#ffd70022" : "var(--bg-secondary)",
                    color: ppaAmount === amt ? "var(--accent-gold)" : "var(--text-secondary)",
                    fontSize: 11, cursor: "pointer",
                  }}>
                    {(amt/1000)}K
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{
              marginBottom: 16, textAlign: "center",
              background: "linear-gradient(135deg, #1a1a2e, #16213e)",
              border: "1px solid #ffd70044",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                YOU RECEIVE
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#6c63ff" }}>
                {piFromPpa}π
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                3% burn fee applied • Arrives within 24h
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleRedeem}
              disabled={loading || !accuracyOk || !balanceOk}
              style={{
                opacity: loading || !accuracyOk || !balanceOk ? 0.4 : 1,
                cursor: loading || !accuracyOk || !balanceOk ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Processing..." : `Redeem ${ppaAmount.toLocaleString()} PPA → ${piFromPpa}π`}
            </button>
          </>
        )}

        {/* Status */}
        {status && (
          <div className="card" style={{
            marginTop: 16, textAlign: "center",
            fontSize: 14, fontWeight: 600,
            color: status.startsWith("✅") ? "#00c9a7" :
                   status.startsWith("❌") ? "#ff6584" : "var(--accent-gold)",
          }}>
            {status}
          </div>
        )}

        {/* Legal note */}
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 10,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          fontSize: 12, color: "var(--text-secondary)",
          textAlign: "center", lineHeight: 1.5,
        }}>
          🔒 PPA is an in-app utility token. Exchange rates are set by the platform treasury and may change.
        </div>

      </div>
    </div>
  );
}