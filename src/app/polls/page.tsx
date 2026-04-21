import Link from "next/link";

const mockPolls = [
  {
    id: "1",
    question: "Which crypto will outperform in Q2 2026?",
    category: "FINANCE",
    totalVotes: 1243,
    trending: true,
    endsAt: "2026-04-28T00:00:00Z",
    options: ["Bitcoin", "Ethereum", "Solana", "BNB"],
  },
  {
    id: "2",
    question: "Best sport to predict outcomes in?",
    category: "SPORTS",
    totalVotes: 876,
    trending: false,
    endsAt: "2026-04-30T00:00:00Z",
    options: ["Football", "Basketball", "Tennis", "MMA"],
  },
  {
    id: "3",
    question: "Will AI replace most jobs by 2030?",
    category: "TECH",
    totalVotes: 2109,
    trending: true,
    endsAt: "2026-05-01T00:00:00Z",
    options: ["Definitely Yes", "Probably Yes", "Probably No", "Definitely No"],
  },
  {
    id: "4",
    question: "Which Pi app will dominate in 2026?",
    category: "SOCIAL",
    totalVotes: 541,
    trending: true,
    endsAt: "2026-05-15T00:00:00Z",
    options: ["PPA", "LoPiPo", "Pi Browser", "Other"],
  },
  {
    id: "5",
    question: "Best programming language for blockchain?",
    category: "TECH",
    totalVotes: 734,
    trending: false,
    endsAt: "2026-05-10T00:00:00Z",
    options: ["Rust", "Solidity", "TypeScript", "Go"],
  },
];

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

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

export default function PollsPage() {
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🗳️ Polls</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Vote. Influence. Earn PPA.
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Poll Cards */}
        {mockPolls.map((poll) => (
          <div key={poll.id} className="card" style={{ marginBottom: 12 }}>

            {/* Top Row */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="badge" style={{
                background: CATEGORY_COLORS[poll.category] + "22",
                color: CATEGORY_COLORS[poll.category],
              }}>
                {CATEGORY_ICONS[poll.category]} {poll.category}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {poll.trending && (
                  <span className="badge" style={{
                    background: "#ff6584222",
                    color: "#ff6584",
                  }}>
                    🔥 Trending
                  </span>
                )}
              </div>
            </div>

            {/* Question */}
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
              {poll.question}
            </div>

            {/* Options Preview */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 12,
            }}>
              {poll.options.map((option) => (
                <span key={option} style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}>
                  {option}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
              fontSize: 12,
              color: "var(--text-secondary)",
            }}>
              <span>🗳️ {poll.totalVotes.toLocaleString()} votes</span>
              <span>⏱ {timeLeft(poll.endsAt)}</span>
            </div>

            <Link href={`/polls/${poll.id}`}>
              <button className="btn-primary">Vote</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}