"use client";

/**
 * Top up PPA — replaces the two-tab "PPA Exchange" (Buy / Redeem) screen.
 *
 * The old screen's problem wasn't the layout, it was that the numbers didn't
 * reconcile with the disclosure underneath them: it charged a 22.4% spread and
 * printed "3% burn fee applied". So the centre of this screen is a receipt that
 * adds up in public, line by line, before the user commits. Nothing is deducted
 * that isn't printed.
 *
 * There is no Redeem tab, and no code path to one.
 */

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/lib/pi-session";

const PI_TO_PPA = 1000;
const TIERS = [0.5, 1, 2, 5];
const IS_TESTNET = process.env.NEXT_PUBLIC_PI_NETWORK !== "mainnet";

type Status = "idle" | "paying" | "done" | "error";

export default function TopUpPanel() {
  const { user, refreshUser } = useAuth();
  const [selected, setSelected] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const ppaAmount = Math.round(selected * PI_TO_PPA);

  async function startTopUp() {
    const Pi = window.Pi;
    if (!Pi) {
      setStatus("error");
      setMessage("Open PPA in Pi Browser to top up.");
      return;
    }

    setStatus("paying");
    setMessage("");

    try {
      Pi.createPayment(
        {
          amount: selected,
          memo: `Top up ${ppaAmount.toLocaleString()} PPA`,
          metadata: { kind: "topup", ppaAmount },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            const res = await apiFetch("/api/ppa/topup/approve", {
              method: "POST",
              body: JSON.stringify({ paymentId }),
            });
            if (!res.ok) throw new Error("Approval failed");
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            const res = await apiFetch("/api/ppa/topup/complete", {
              method: "POST",
              body: JSON.stringify({ paymentId, txid }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error("Completion failed");
            await refreshUser();
            setStatus("done");
            setMessage(`${data.credited.toLocaleString()} PPA added to your balance.`);
          },
          onCancel: () => {
            setStatus("idle");
            setMessage("Top up cancelled. Nothing was charged.");
          },
          onError: () => {
            setStatus("error");
            setMessage("The payment didn't go through. Nothing was charged.");
          },
        },
      );
    } catch {
      setStatus("error");
      setMessage("The payment didn't go through. Nothing was charged.");
    }
  }

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "7px 0",
    fontSize: 14,
  } as const;

  return (
    <div style={{ padding: 16 }}>
      {/* Balance */}
      <div className="card" style={{ marginBottom: 16, textAlign: "center", padding: "20px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: 1, marginBottom: 4 }}>
          CURRENT BALANCE
          {IS_TESTNET && (
            <span
              style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 20,
                background: "#ffd70022",
                color: "var(--accent-gold)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
              }}
              title="Running on Pi Testnet. Payments use Test-Pi, which has no value."
            >
              TESTNET
            </span>
          )}
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-gold)" }}>
          {(user?.ppaBalance ?? 0).toLocaleString()}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>PPA</div>
      </div>

      {/* Amount */}
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
        CHOOSE AN AMOUNT
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => setSelected(tier)}
            disabled={status === "paying"}
            aria-pressed={tier === selected}
            style={{
              flex: 1,
              padding: "14px 8px",
              borderRadius: 12,
              border: `2px solid ${tier === selected ? "var(--accent-primary)" : "var(--border)"}`,
              background: tier === selected ? "#6c63ff22" : "var(--bg-card)",
              color: tier === selected ? "var(--accent-primary)" : "var(--text-secondary)",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tier}π
          </button>
        ))}
      </div>

      {/* The receipt. Every line that affects the total is printed. */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
          WHAT YOU GET
        </div>
        <div style={rowStyle}>
          <span style={{ color: "var(--text-secondary)" }}>You pay</span>
          <span>{selected.toFixed(4)}π</span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: "var(--text-secondary)" }}>
            Rate (1π = {PI_TO_PPA.toLocaleString()} PPA)
          </span>
          <span>×{PI_TO_PPA.toLocaleString()}</span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: "var(--text-secondary)" }}>Fees</span>
          <span>None</span>
        </div>
        <div
          style={{
            ...rowStyle,
            borderTop: "1px solid var(--border)",
            marginTop: 8,
            paddingTop: 12,
          }}
        >
          <span style={{ fontWeight: 600 }}>You receive</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-gold)" }}>
            {ppaAmount.toLocaleString()} PPA
          </span>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={startTopUp}
        disabled={status === "paying"}
        style={{ opacity: status === "paying" ? 0.6 : 1 }}
      >
        {status === "paying"
          ? "Waiting for Pi..."
          : `Top up ${ppaAmount.toLocaleString()} PPA for ${selected}π`}
      </button>

      {message && (
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            textAlign: "center",
            color: status === "error" ? "var(--accent-secondary)" : "#00c9a7",
          }}
        >
          {message}
        </div>
      )}

      {/* Above the fold of the action, not buried in Terms. */}
      <div
        className="card"
        style={{
          marginTop: 16,
          background: "#ffd70011",
          border: "1px solid #ffd70033",
        }}
      >
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--accent-gold)" }}>
          PPA is a non-refundable in-app credit. It has no cash value and cannot
          be exchanged back into Pi or any other currency.
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 8 }}>
          Top-ups are final. PPA cannot be transferred to another account.{" "}
          <a href="/terms" style={{ color: "var(--text-secondary)", textDecoration: "underline" }}>
            Read the terms
          </a>
          .
        </div>
      </div>
    </div>
  );
}
