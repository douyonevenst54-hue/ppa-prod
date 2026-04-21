import Link from "next/link";

const mockChallenges = [
  {
    id: "1",
    title: "Daily Quiz",
    topic: "General Knowledge",
    difficulty: "MEDIUM",
    questions: 5,
    seconds: 60,
    reward: 50,
    category: "GENERAL",
  },
  {
    id: "2",
    title: "Finance Fast",
    topic: "Crypto & Markets",
    difficulty: "HARD",
    questions: 7,
    seconds: 90,
    reward: 120,
    category: "FINANCE",
  },
  {
    id: "3",
    title: "Sports Blitz",
    topic: "Sports Trivia",
    difficulty: "EASY",
    questions: 5,
    seconds: 60,
    reward: 30,
    category: "SPORTS",
  },
  {
    id: "4",
    title: "Tech IQ",
    topic: "Technology",
    difficulty: "HARD",
    questions: 10,
    seconds: 120,
    reward: 200,
    category: "TECH",
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#00c9a7",
  MEDIUM: "#ffd700",
  HARD: "#ff6584",
};

const CATEGORY_COLORS: Record<string, string> = {
  FINANCE: "#00c9a7",
  SPORTS: "#ff6584",
  TECH: "#6c63ff",
  POLITICS: "#ffd700",
  SOCIAL: "#ff9f43",
  GENERAL: "#a0a0b8",
};

const CATEGORY_ICONS: Record<string, string> = {
  FINANCE: "💹",
  SPORTS: "⚽",
  TECH: "💻",
  POLITICS: "🏛️",
  SOCIAL: "💬",
  GENERAL: "🧠",
};

export default function ChallengesPage() {
  return (
    <div style={{ padding: "0 0 80px 0" }}>

      {/* Header */}
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
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🎯 Challenges</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Test your knowledge. Earn PPA.
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Stats Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}>
          {[
            { label: "Streak", value: "3 🔥" },
            { label: "Accuracy", value: "0%" },
            { label: "PPA Earned", value: "100" },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Challenge Cards */}
        {mockChallenges.map((challenge) => (
          <div key={challenge.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>{CATEGORY_ICONS[challenge.category]}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{challenge.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{challenge.topic}</div>
                </div>
              </div>
              <span className="badge" style={{
                background: DIFFICULTY_COLORS[challenge.difficulty] + "22",
                color: DIFFICULTY_COLORS[challenge.difficulty],
              }}>
                {challenge.difficulty}
              </span>
            </div>

            <div style={{
              display: "flex",
              gap: 16,
              marginBottom: 14,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}>
              <span>📝 {challenge.questions} questions</span>
              <span>⏱ {challenge.seconds}s</span>
              <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>
                +{challenge.reward} PPA
              </span>
            </div>

            <Link href={`/challenges/${challenge.id}`}>
              <button className="btn-primary">Play</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}