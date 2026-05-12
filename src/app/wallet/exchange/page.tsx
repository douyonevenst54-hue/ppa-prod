"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const PI_TO_PPA = 1000;
const PPA_TO_PI = 0.0008;
const BURN_RATE = 0.03;
const MIN_REDEEM = 5000;
const MIN_ACCURACY = 65;  // percentage

export default function ExchangePage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<"buy" | "redeem">("buy");
  const [piAmount, setPiAmount] = useState(1);
  const [ppaAmount, setPpaAmount] = useState(MIN_REDEEM);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const ppaFromPi = piAmount * PI_TO_PPA;
  const netPpa = Math.floor(ppaAmount * (1 - BURN_RATE));
  const piFromPpa = (netPpa * PPA_TO_PI).toFixed(4);
  const accuracyPct = Math.round((user?.accuracyRate || 0) * 100);
  const accuracyOk = accuracyPct >= MIN_ACCURACY;
  const balanceOk = (user?.ppaBalance || 0) >= ppaAmount;

  const handleBuy = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("⏳ Connecting to Pi...");

    try {
      let attempts = 0;
      while (!window.Pi && attempts < 30) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }

      if (!window.Pi) {
        setStatus("❌ Open in Pi Browser to make payments.");
        setLoading(false);
        return;
      }

      window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      });

      await new Promise((r) => setTimeout(r, 500));

      setStatus("⏳ Authenticating with Pi...");
      await window.Pi.authenticate(["username", "payments"], async (payment) => {
        try {
          await fetch("/api/payments/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId: (payment as { identifier: string }).identifier,
            }),
          });
        } catch (e) {
          console.error("Incomplete payment:", e);
        }
      });

      setStatus("⏳ Opening payment dialog...");
      window.Pi.createPayment(
        {
          amount: piAmount,
          memo: `Buy ${ppaFromPi} PPA on Pap-Pad-App`,
          metadata: { type: "buy_ppa", userId: user.id, ppaAmount: ppaFromPi },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId }),
            });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            const res = await fetch("/api/payments/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                direction: "buy",
                userId: user.id,
                amount: piAmount,
                paymentId,
                txid,
              }),
            });
            const data = await res.json();
            if (data.success) {
              await refreshUser();
              setStatus(`✅ Success! +${ppaFromPi} PPA added to your balance.`);
            } else {
              setStatus(`❌ ${data.error}`);
            }
            setLoading(false);
          },
          onCancel: () => {
            setStatus("⚠️ Payment cancelled.");
            setLoading(false);
          },
          onError: (error) => {
            setStatus(`❌ ${error.message}`);
            setLoading(false);
          },
        },
      );
    } catch (err) {
      console.error("Buy error:", err);
      setStatus("❌ Payment failed. Try again.");
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("⏳ Sending Pi to your wallet... (this can take up to 30 seconds)");

    try {
      const res = await fetch("/api/payments/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "redeem",
          userId: user.id,
          amount: ppaAmount,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await refreshUser();
        setStatus(`✅ ${data.piReceived}π sent to your Pi wallet! tx: ${String(data.txid).slice(0, 8)}…`);
      } else {
        setStatus(`❌ ${data.error || "Redemption failed"}`);
      }
    } catch {
      setStatus("❌ Redemption failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link href="/wallet" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>⚡ PPA Exchange</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Convert between $Pi and PPA</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Balance + accuracy */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-gold)" }}>
              {user?.ppaBalance || 0}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>PPA Balance</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#6c63ff" }}>{accuracyPct}%</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Accuracy Rate</div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            background: "var(--bg-card)",
            padding: 4,
            borderRadius: 12,
          }}
        >
          {(["buy", "redeem"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 10,
                border: "none",
                background: tab === t ? "var(--accent-primary)" : "transparent",
                color: tab === t ? "white" : "var(--text-secondary)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t === "buy" ? "Buy PPA" : "Redeem PPA"}
            </button>
          ))}
        </div>

        {/* Buy Tab */}
        {tab === "buy" && (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                YOU PAY ($Pi)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[0.5, 1, 2, 5].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setPiAmount(amt)}
                    style={{
                      flex: 1,
                      padding: "10px 4px",
                      borderRadius: 10,
                      border: `1px solid ${piAmount === amt ? "var(--accent-primary)" : "var(--border)"}`,
                      background: piAmount === amt ? "#6c63ff22" : "var(--bg-secondary)",
                      color: piAmount === amt ? "var(--accent-primary)" : "var(--text-secondary)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {amt}π
                  </button>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{
                marginBottom: 16,
                textAlign: "center",
                background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                border: "1px solid #6c63ff44",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>YOU RECEIVE</div>
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
              <div className="card" style={{ marginBottom: 16, background: "#ff658411", border: "1px solid #ff658444" }}>
                <div style={{ fontSize: 13, color: "#ff6584" }}>
                  ⚠️ You need {MIN_ACCURACY}% accuracy to redeem. Current: {accuracyPct}%
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                REDEEM AMOUNT (PPA)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[5000, 10000, 25000, 50000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setPpaAmount(amt)}
                    style={{
                      flex: 1,
                      padding: "10px 4px",
                      borderRadius: 10,
                      border: `1px solid ${ppaAmount === amt ? "var(--accent-gold)" : "var(--border)"}`,
                      background: ppaAmount === amt ? "#ffd70022" : "var(--bg-secondary)",
                      color: ppaAmount === amt ? "var(--accent-gold)" : "var(--text-secondary)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {amt / 1000}K
                  </button>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{
                marginBottom: 16,
                textAlign: "center",
                background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                border: "1px solid #ffd70044",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>YOU RECEIVE</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#6c63ff" }}>{piFromPpa}π</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                {Math.round(BURN_RATE * 100)}% burn fee applied · Arrives directly to your Pi wallet
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
              {loading ? "Sending Pi..." : `Redeem ${ppaAmount.toLocaleString()} PPA → ${piFromPpa}π`}
            </button>
          </>
        )}

        {/* Status */}
        {status && (
          <div
            className="card"
            style={{
              marginTop: 16,
              textAlign: "center",
              fontSize: 14,
              fontWeight: 600,
              color: status.startsWith("✅") ? "#00c9a7" : status.startsWith("❌") ? "#ff6584" : "var(--accent-gold)",
            }}
          >
            {status}
          </div>
        )}

        {/* Legal note */}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          🔒 PPA is an in-app utility token. Exchange rates are set by the platform treasury and may change.
        </div>
      </div>
    </div>
  );
}
