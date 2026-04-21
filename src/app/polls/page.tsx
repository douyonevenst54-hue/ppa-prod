import Link from "next/link";

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

async function getPolls() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/polls`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return data.polls || [];
  } catch {
    return [];
  }
}

export default async function PollsPage() {
  const polls = await getPolls();

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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🗳️ Polls</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Vote. Influence. Earn PPA.</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {polls.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            No polls available yet.
          </div>
        ) : (
          polls.map((poll: {
            id: string;
            title: string;
            category: string;
            participantCount: number;
            endsAt: string;
            pollOptions: { id: string; text: string }[];
          }) => (
            <div key={poll.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="badge" style={{
                  background: CATEGORY_COLORS[poll.category] + "22",
                  color: CATEGORY_COLORS[poll.category],
                }}>
                  {CATEGORY_ICONS[poll.category]} {poll.category}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  ⏱ {timeLeft(poll.endsAt)}
                </span>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                {poll.title}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {poll.pollOptions?.map((option) => (
                  <span key={option.id} style={{
                    padding: "4px 10px", borderRadius: 20,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    fontSize: 12, color: "var(--text-secondary)",
                  }}>
                    {option.text}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>🗳️ {poll.participantCount.toLocaleString()} votes</span>
              </div>

              <Link href={`/polls/${poll.id}`}>
                <button className="btn-primary">Vote</button>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}