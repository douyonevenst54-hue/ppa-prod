import Link from "next/link";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#00c9a7",
  MEDIUM: "#ffd700",
  HARD: "#ff6584",
};

const CATEGORY_ICONS: Record<string, string> = {
  FINANCE: "💹",
  SPORTS: "⚽",
  TECH: "💻",
  POLITICS: "🏛️",
  SOCIAL: "💬",
  GENERAL: "🧠",
};

async function getChallenges() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/challenges`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return data.challenges || [];
  } catch {
    return [];
  }
}

export default async function ChallengesPage() {
  const challenges = await getChallenges();

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🎯 Challenges</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Test your knowledge. Earn PPA.</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
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

        {challenges.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            No challenges available yet.
          </div>
        ) : (
          challenges.map((challenge: {
            id: string;
            title: string;
            category: string;
            questions: { difficulty: string }[];
            participantCount: number;
          }) => {
            const difficulty = challenge.questions?.[0]?.difficulty || "MEDIUM";
            const questionCount = challenge.questions?.length || 0;

            return (
              <div key={challenge.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24 }}>{CATEGORY_ICONS[challenge.category]}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{challenge.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{challenge.category}</div>
                    </div>
                  </div>
                  <span className="badge" style={{
                    background: DIFFICULTY_COLORS[difficulty] + "22",
                    color: DIFFICULTY_COLORS[difficulty],
                  }}>
                    {difficulty}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>📝 {questionCount} questions</span>
                  <span>⏱ 15s each</span>
                  <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>+{questionCount * 10} PPA</span>
                </div>

                <Link href={`/challenges/${challenge.id}`}>
                  <button className="btn-primary">Play</button>
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}