"use client";

/**
 * /support-ppa — what staking toward PPA does, and the supporter perks.
 *
 * The page is honest first: staking boosts PPA in the Pi directory, the Pi
 * comes back, nobody pays a reward. Perks are recognition and early access.
 * It renders fully with the feature flag off — it just shows no tier.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiJson, NotSignedInError } from "@/lib/pi-session";
import {
  PERKS,
  STAKER_TIERS,
  STAKING_DISCLOSURE,
  TIER_COLORS,
  TIER_LABELS,
  TIER_MEANINGS,
  TIER_THRESHOLDS,
  type StakerTier,
} from "@/lib/ppa/staker";

interface StakerResponse {
  enabled: boolean;
  tier: StakerTier;
  tierLabel: string;
  tierMeaning: string;
  effectiveStake: number;
  checkedAt: string | null;
  graceEndsAt: string | null;
  refreshError: string | null;
  next: { tier: StakerTier; label: string; needed: number } | null;
  perks: { id: string; title: string; description: string }[];
}

const PAID_TIERS = STAKER_TIERS.filter((t) => t !== "NONE") as Exclude<StakerTier, "NONE">[];

function formatStake(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function SupportPpaPage() {
  const [data, setData] = useState<StakerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      const res = await apiJson<StakerResponse>(`/api/staker${refresh ? "?refresh=1" : ""}`);
      setData(res);
    } catch (e) {
      setError(
        e instanceof NotSignedInError ? e.message : "Couldn't load your supporter status. Try again in a moment.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tierColor = data ? TIER_COLORS[data.tier] : TIER_COLORS.NONE;

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0 12px" }}>
        <Link href="/profile" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Support PPA</h1>
      </div>

      {/* What staking is */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>How staking helps</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 10 }}>
          In the Pi Browser, open the Ecosystem Directory, find PPA and stake Pi toward it. The more Pi
          staked, and the longer, the higher PPA appears — so more Pioneers find it.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          To say thank you, PPA gives supporters recognition and early access. Your stake is checked about
          once a day.
        </p>
      </div>

      {/* Your status */}
      {error && (
        <div className="card" style={{ marginBottom: 16, fontSize: 13, color: "var(--accent-secondary)" }}>
          {error}
        </div>
      )}

      {data && data.enabled && (
        <div
          className="card"
          style={{ marginBottom: 16, border: `1px solid ${tierColor}55`, background: `${tierColor}11` }}
        >
          <div style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: 1, fontWeight: 600 }}>
            YOUR SUPPORTER TIER
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: tierColor, margin: "6px 0 2px" }}>
            {data.tierLabel}
          </div>
          {data.tierMeaning && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>{data.tierMeaning}</div>
          )}
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Effective stake: <strong style={{ color: "var(--text-primary)" }}>{formatStake(data.effectiveStake)}</strong>
          </div>

          {data.graceEndsAt && (
            <div style={{ fontSize: 12, color: "var(--accent-gold)", marginTop: 8 }}>
              Your stake has dropped below this tier. You keep it until{" "}
              {new Date(data.graceEndsAt).toLocaleDateString()} — re-stake before then to hold on to it.
            </div>
          )}

          {data.next && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
              {formatStake(data.next.needed)} more effective stake reaches {data.next.label}.
            </div>
          )}

          {data.refreshError && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
              Couldn&apos;t reach Pi just now — showing your last known status.
            </div>
          )}

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-primary"
            style={{ width: "100%", marginTop: 14, opacity: refreshing ? 0.6 : 1 }}
          >
            {refreshing ? "Checking…" : "I just staked — check again"}
          </button>
          {data.checkedAt && (
            <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", marginTop: 6 }}>
              Last checked {new Date(data.checkedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {data && !data.enabled && (
        <div className="card" style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Supporter tiers are coming soon. You can already stake toward PPA in the Ecosystem Directory —
          your support counts from the day you start.
        </div>
      )}

      {/* All tiers */}
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: 1, margin: "8px 0" }}>
        SUPPORTER TIERS
      </div>
      {PAID_TIERS.map((tier) => {
        const unlocked = PERKS.filter((p) => p.minTier === tier);
        const current = data?.enabled && data.tier === tier;
        return (
          <div
            key={tier}
            className="card"
            style={{
              marginBottom: 10,
              border: `1px solid ${TIER_COLORS[tier]}${current ? "aa" : "33"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TIER_COLORS[tier] }}>
                {TIER_LABELS[tier]}
                {current && <span style={{ fontSize: 11, marginLeft: 8, color: "var(--text-secondary)" }}>YOU</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {formatStake(TIER_THRESHOLDS[tier])}+ effective stake
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 10px" }}>
              {TIER_MEANINGS[tier]}
            </div>
            {tier !== "ZANMI" && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                Everything in {TIER_LABELS[PAID_TIERS[PAID_TIERS.indexOf(tier) - 1]]}, plus:
              </div>
            )}
            {unlocked.map((perk) => (
              <div key={perk.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{perk.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>{perk.description}</div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Disclosure */}
      <div
        className="card"
        style={{ marginTop: 16, border: "1px solid #ffd70044", background: "#ffd70011" }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Before you stake</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>{STAKING_DISCLOSURE}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 8 }}>
          Perks never change your rank, reputation, rewards or prediction results. Only stake Pi you
          won&apos;t need during the lock period.
        </div>
      </div>
    </div>
  );
}
