"use client";

/**
 * Emblem display for the profile screen.
 *
 * Shows the sigil, the realm it presents as, and the seven realm tracks with
 * progress to the next threshold. The progress lines are the point: an Emblem
 * that only showed a finished picture would be a badge, and the thing that
 * makes people care is seeing the next one within reach.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/pi-session";

interface Standing {
  realm: string;
  name: string;
  blurb: string;
  score: number;
  level: number;
  next: number | null;
}

interface EmblemData {
  username: string;
  realm: string;
  realmName: string;
  level: number;
  pioneer: boolean;
  imageUrl: string;
  standings: Standing[];
}

const REALM_ICONS: Record<string, string> = {
  THINK: "🧠",
  PREDICT: "🔮",
  CREATE: "🎨",
  COMPETE: "⚡",
  EXPLORE: "🧭",
  CONNECT: "🤝",
  LEAD: "🏆",
};

export default function EmblemCard() {
  const [data, setData] = useState<EmblemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/emblem")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Loading your emblem...
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 8,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        YOUR EMBLEM
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.imageUrl}
          alt={`${data.realmName} emblem for ${data.username}`}
          style={{ width: "100%", display: "block" }}
        />

        <div style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            Your emblem is built from what you&rsquo;ve actually done. It can&rsquo;t
            be bought or transferred — only earned.
          </div>

          {data.standings
            .slice()
            .sort((a, b) => b.level - a.level || b.score - a.score)
            .map((s) => {
              const pct =
                s.next === null ? 100 : Math.min(100, (s.score / s.next) * 100);
              const lit = s.level > 0;

              return (
                <div key={s.realm} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: lit ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {REALM_ICONS[s.realm]} {s.name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {s.level > 0 ? `Level ${s.level}` : "—"}
                      {s.next !== null && ` · ${s.score}/${s.next}`}
                    </span>
                  </div>

                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: lit ? "var(--accent-primary)" : "var(--text-secondary)",
                        borderRadius: 2,
                        opacity: lit ? 1 : 0.4,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>

                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                    {s.blurb}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
