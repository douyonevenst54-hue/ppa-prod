"use client";

import { useState } from "react";

const SPORTS = [
  { value: "soccer", label: "⚽ Soccer", allowDraw: true },
  { value: "basketball", label: "🏀 Basketball", allowDraw: false },
];

interface CreateMatchFormProps {
  userId: string;
  onCreated: () => void;
}

export function CreateMatchForm({ userId, onCreated }: CreateMatchFormProps) {
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState("soccer");
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [rewardPool, setRewardPool] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allowDraw = SPORTS.find((s) => s.value === sport)?.allowDraw ?? true;

  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border, #ffffff22)",
    background: "var(--bg-card)",
    color: "var(--text-primary, #fff)",
    fontSize: 14,
    outline: "none",
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginBottom: 4,
    display: "block",
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sport,
          team1,
          team2,
          // datetime-local has no timezone; convert to ISO in the user's zone.
          startsAt: new Date(startsAt).toISOString(),
          allowDraw,
          rewardPool: Number(rewardPool) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");

      setTeam1("");
      setTeam2("");
      setStartsAt("");
      setRewardPool(0);
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const ready = team1.trim() && team2.trim() && startsAt && !saving;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: "var(--accent-primary)",
          color: "white",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        ➕ Add a match
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        border: "1px solid var(--border, #ffffff22)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
        New match
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={label}>Sport</label>
        <div style={{ display: "flex", gap: 8 }}>
          {SPORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSport(s.value)}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: 10,
                border: "none",
                background:
                  sport === s.value ? "var(--accent-primary)" : "transparent",
                color: sport === s.value ? "white" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Home</label>
          <input
            style={input}
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            placeholder="Team A"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Away</label>
          <input
            style={input}
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            placeholder="Team B"
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={label}>Kickoff (predictions lock at this time)</label>
        <input
          style={input}
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Reward pool (PPA, optional)</label>
        <input
          style={input}
          type="number"
          min={0}
          value={rewardPool}
          onChange={(e) => setRewardPool(Number(e.target.value))}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        Options: {team1 || "Home"}
        {allowDraw ? " · Draw · " : " · "}
        {team2 || "Away"}
        <br />
        Players can enter free (no stake, no reward) or stake PPA for a reward.
      </div>

      {error && (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 10,
            background: "#ff658422",
            border: "1px solid #ff658444",
            fontSize: 12,
            color: "#ff6584",
          }}
        >
          ❌ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setOpen(false)}
          style={{
            flex: 1,
            padding: "11px",
            borderRadius: 10,
            border: "1px solid var(--border, #ffffff22)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!ready}
          style={{
            flex: 1,
            padding: "11px",
            borderRadius: 10,
            border: "none",
            background: ready ? "var(--accent-primary)" : "#ffffff22",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: ready ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Creating..." : "Create match"}
        </button>
      </div>
    </div>
  );
}