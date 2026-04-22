"use client";

import { useState } from "react";
import { usePiPayment } from "@/hooks/usePiPayment";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

export default function TestPaymentPage() {
  const { user } = useAuth();
  const { createPayment } = usePiPayment();
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleTestPayment = async () => {
    if (!user) {
      setStatus("❌ Please sign in first");
      return;
    }

    setLoading(true);
    setStatus("⏳ Initiating payment...");

    createPayment({
      amount: 0.001,
      memo: "PPA Test Payment — Step 10 Verification",
      metadata: { type: "test", userId: user.id },
      userId: user.id,
      ppaReward: 50,
      onSuccess: () => {
        setStatus("✅ Payment successful! +50 PPA added to your balance.");
        setLoading(false);
      },
      onCancel: () => {
        setStatus("⚠️ Payment cancelled.");
        setLoading(false);
      },
      onError: (error) => {
        setStatus(`❌ Error: ${error}`);
        setLoading(false);
      },
    });
  };

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>⚡ Pi Payment Test</div>
      </div>

      <div style={{ padding: 16 }}>

        <div className="card" style={{
          marginBottom: 20,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid #6c63ff44",
          textAlign: "center",
          padding: "32px 16px",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Step 10 Verification
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            This processes a real Pi payment to complete
            the Pi Developer Portal onboarding checklist.
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          {[
            { label: "Amount", value: "0.001 π" },
            { label: "Memo", value: "PPA Test Payment" },
            { label: "PPA Reward", value: "+50 PPA" },
            { label: "User", value: user?.username || "Not signed in" },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 14,
            }}>
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span style={{ fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {status && (
          <div className="card" style={{
            marginBottom: 16,
            textAlign: "center",
            fontSize: 15,
            fontWeight: 600,
            color: status.startsWith("✅") ? "#00c9a7" : 
                   status.startsWith("❌") ? "#ff6584" : 
                   "var(--accent-gold)",
          }}>
            {status}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleTestPayment}
          disabled={loading || !user}
          style={{
            opacity: loading || !user ? 0.5 : 1,
            cursor: loading || !user ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Process Test Payment (0.001 π)"}
        </button>

        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          ⚠️ Must be opened in Pi Browser to process payment.
          This uses Pi Testnet — no real Pi is spent.
        </div>

      </div>
    </div>
  );
}