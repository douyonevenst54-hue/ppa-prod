import Link from "next/link";

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

// Mock data — replace with real API calls in Phase 2
const mockUser = {
  username: "Jhon_D",
  ppaBalance: 100,
  streakDays: 3,
  tier: "MEMBER",
  accuracyRate: 0,
};

const mockPrediction = {
  id: "1",
  title: "Will ETH surpass $4,000 by Friday?",
  category: "FINANCE",
  participantCount: 142,
  endsAt: "2026-04-25T00:00:00Z",
};

const mockChallenge = {
  id: "1",
  title: "Today's Challenge",
  questions: 5,
  seconds: 60,
  difficulty: "MEDIUM",
  reward: 50,
};

const mockLeaderboard = [
  { rank: 1, username: "Alex_Pi", accuracyRate: 87, tier: "ELITE" },
  { rank: 2, username: "Maria_K", accuracyRate: 82, tier: "EXPERT" },
  { rank: 3, username: "Dev_Jon", accuracyRate: 79, tier: "TRUSTED" },
];

const CATEGORY_COLORS: Record<string, string> = {
  FINANCE: "#00c9a7",
  SPORTS: "#ff6584",
  TECH: "#6c63ff",
  POLITICS: "#ffd700",
  SOCIAL: "#ff9f43",
  GENERAL: "#a0a0b8",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#00c9a7",
  MEDIUM: "#ffd700",
  HARD: "#ff6584",
};

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

export default function HomePage() {
  return (
    <div style={{ padding: "0 0 80px 0", minHeight: "100vh" }}>

      {/* Top Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 16px 12px",
        position: "sticky",
        top: 0,
        background: "var(--bg-primary)",
        zIndex: 10,
        borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
            BALANCE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-gold)" }}>
            {mockUser.ppaBalance} <span style={{ fontSize: 13 }}>PPA</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{mockUser.username}</div>
          <span className="badge" style={{
            background: TIER_COLORS[mockUser.tier] + "22",
            color: TIER_COLORS[mockUser.tier],
            fontSize: 11,
          }}>
            ⭐ {TIER_LABELS[mockUser.tier]}
          </span>
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* Section 1 — Daily Streak */}
        <div className="card" style={{
          marginBottom: 12,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
              Daily Streak
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              🔥 {mockUser.streakDays} Days
            </div>
          </div>
          <Link href="/challenges">
            <button className="btn-primary" style={{ width: "auto", padding: "10px 16px", fontSize: 13 }}>
              Complete Today
            </button>
          </Link>
        </div>

        {/* Section 2 — Featured Prediction */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            FEATURED PREDICTION
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="badge" style={{
              background: CATEGORY_COLORS[mockPrediction.category] + "22",
              color: CATEGORY_COLORS[mockPrediction.category],
            }}>
              💹 {mockPrediction.category}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              ⏱ {timeLeft(mockPrediction.endsAt)}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
            {mockPrediction.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
            👥 {mockPrediction.participantCount} participants
          </div>
          <Link href={`/predictions/${mockPrediction.id}`}>
            <button className="btn-primary">Make Your Prediction</button>
          </Link>
        </div>

        {/* Section 3 — Daily Challenge */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            DAILY CHALLENGE
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{mockChallenge.title}</div>
            <span className="badge" style={{
              background: DIFFICULTY_COLORS[mockChallenge.difficulty] + "22",
              color: DIFFICULTY_COLORS[mockChallenge.difficulty],
            }}>
              {mockChallenge.difficulty}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            {mockChallenge.questions} Questions • {mockChallenge.seconds} seconds
          </div>
          <div style={{ fontSize: 13, color: "var(--accent-gold)", marginBottom: 14 }}>
            Earn up to {mockChallenge.reward} PPA
          </div>
          <Link href={`/challenges/${mockChallenge.id}`}>
            <button className="btn-primary">Start Challenge</button>
          </Link>
        </div>

        {/* Section 4 — Leaderboard Preview */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            LEADERBOARD
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          {mockLeaderboard.map((entry) => (
            <div key={entry.rank} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: entry.rank < 3 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: entry.rank === 1 ? "#ffd70022" : entry.rank === 2 ? "#c0c0c022" : "#cd7f3222",
                  color: entry.rank === 1 ? "#ffd700" : entry.rank === 2 ? "#c0c0c0" : "#cd7f32",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}>
                  {entry.rank}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{entry.username}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-primary)" }}>
                {entry.accuracyRate}%
              </div>
            </div>
          ))}
          <Link href="/leaderboard">
            <button className="btn-primary" style={{ marginTop: 12 }}>View Full Rankings</button>
          </Link>
        </div>

        {/* Section 5 — Explore Grid */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
            EXPLORE
          </div>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}>
          {[
            { icon: "🧠", label: "Prediction Arena", href: "/predictions", color: "#6c63ff" },
            { icon: "🎯", label: "Challenges", href: "/challenges", color: "#ff6584" },
            { icon: "🗳️", label: "Polls", href: "/polls", color: "#00c9a7" },
            { icon: "🎨", label: "Creator Hub", href: "/creator", color: "#ffd700" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="card" style={{
                textAlign: "center",
                padding: "20px 12px",
                cursor: "pointer",
                transition: "border-color 0.2s",
                borderColor: item.color + "44",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>
                  {item.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}