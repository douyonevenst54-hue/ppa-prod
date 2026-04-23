"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface PublicUser {
  id: string;
  username: string;
  tier: string;
  accuracyRate: number;
  reputationScore: number;
  streakDays: number;
  longestStreak: number;
  totalPredictions: number;
  correctPredictions: number;
  createdAt: string;
  createdContent: {
    id: string;
    title: string;
    type: string;
    category: string;
    participantCount: number;
    endsAt: string;
  }[];
  _count: {
    createdContent: number;
    predictions: number;
    pollVotes: number;
  };
}

const TIER_COLORS: Record<string, string> = {
  NEWCOMER: "#a0a0b8",
  MEMBER: "#6c63ff",
  TRUSTED: "#00c9a7",
  EXPERT: "#ffd700",
  ELITE: "#ff6584",
};

const TIER_LABELS: Record<string, string> = {
  NEWCOMER: "Newcomer",
  MEMBER: "Member",
  TRUSTED: "Trusted",
  EXPERT: "Expert",
  ELITE: "Elite",
};

const CATEGORY_ICONS: Record<string, string> = {
  FINANCE: "💹",
  SPORTS: "⚽",
  TECH: "💻",
  POLITICS: "🏛️",
  SOCIAL: "💬",
  GENERAL: "🧠",
};

const TYPE_ICONS: Record<string, string> = {
  prediction: "🎯",
  poll: "🗳️",
  challenge: "⚡",
};

function getStreakMultiplier(streakDays: number): string {
  if (streakDays >= 30) return "2.0×";
  if (streakDays >= 14) return "1.8×";
  if (streakDays >= 7) return "1.5×";
  if (streakDays >= 3) return "1.2×";
  return "1.0×";
}

function getMemberSince(createdAt: string): string {
  const date = new Date(createdAt);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  async function fetchProfile() {
    try {
      const res = await fetch(`/api/profile/${username}`);
      const data = await res.json();
      if (data.error) {
        setNotFound(true);
      } else {
        setProfile(data.user);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80, color: "var(--text-secondary)" }}>
        Loading profile...
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          User not found
        </div>
        <Link href="/" style={{ color: "var(--accent-primary)" }}>
          ← Back to Home
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.username === profile.username;
  const accuracy = Math.round((profile.accuracyRate || 0) * 100);
  const tierColor = TIER_COLORS[profile.tier] || "#a0a0b8";

  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Header */}
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {isOwnProfile ? "My Profile" : "Profile"}
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Avatar + Name */}
        <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: tierColor + "22",
            border: `3px solid ${tierColor}`,
            display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 32,
            margin: "0 auto 12px",
          }}>
            🧠
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {profile.username}
            {isOwnProfile && (
              <span style={{ fontSize: 13, color: "var(--accent-primary)", marginLeft: 8, fontWeight: 400 }}>
                (you)
              </span>
            )}
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "6px 16px", borderRadius: 20,
            fontSize: 13, fontWeight: 600,
            background: tierColor + "22", color: tierColor,
          }}>
            ⭐ {TIER_LABELS[profile.tier]}
          </span>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
            Member since {getMemberSince(profile.createdAt)}
          </div>
        </div>

        {/* Core Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            {
              label: "Accuracy",
              value: `${accuracy}%`,
              color: accuracy >= 75 ? "#00c9a7" : accuracy >= 50 ? "#ffd700" : "#ff6584",
              icon: "🎯",
            },
            {
              label: "Reputation",
              value: profile.reputationScore.toFixed(1),
              color: "#6c63ff",
              icon: "⭐",
            },
            {
              label: "Best Streak",
              value: `${profile.longestStreak}🔥`,
              color: "#ff9f43",
              icon: "🔥",
            },
            {
              label: "Multiplier",
              value: getStreakMultiplier(profile.streakDays),
              color: "#00c9a7",
              icon: "⚡",
            },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "16px 8px" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Activity Stats */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            ACTIVITY
          </div>
          {[
            { label: "Total Predictions", value: profile._count.predictions },
            { label: "Correct Predictions", value: profile.correctPredictions },
            { label: "Accuracy Rate", value: `${accuracy}%` },
            { label: "Poll Votes", value: profile._count.pollVotes },
            { label: "Content Created", value: profile._count.createdContent },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "1px solid var(--border)",
              fontSize: 14,
            }}>
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span style={{ fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Recent Content */}
        {profile.createdContent.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
              CREATED CONTENT
            </div>
            {profile.createdContent.map((content) => (
              <div key={content.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {TYPE_ICONS[content.type]} {content.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {CATEGORY_ICONS[content.category]} {content.category}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
                  {content.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  👥 {content.participantCount} participants
                </div>
              </div>
            ))}
          </>
        )}

        {/* Own Profile Actions */}
        {isOwnProfile && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <Link href="/wallet">
              <div className="card" style={{
                textAlign: "center", padding: "16px 12px",
                cursor: "pointer", border: "1px solid #ffd70044",
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>💰</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-gold)" }}>Wallet</div>
              </div>
            </Link>
            <Link href="/leaderboard">
              <div className="card" style={{
                textAlign: "center", padding: "16px 12px",
                cursor: "pointer", border: "1px solid #6c63ff44",
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🏆</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-primary)" }}>Rankings</div>
              </div>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}