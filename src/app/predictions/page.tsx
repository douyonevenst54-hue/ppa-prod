import Link from "next/link";

const mockPredictions = [
  {
    id: "1",
    title: "Will ETH surpass $4,000 by Friday?",
    category: "FINANCE",
    participants: 142,
    endsAt: "2026-04-25T00:00:00Z",
    difficulty: "Contested",
  },
  {
    id: "2",
    title: "Will the Lakers make the playoffs this season?",
    category: "SPORTS",
    participants: 389,
    endsAt: "2026-04-30T00:00:00Z",
    difficulty: "Likely",
  },
  {
    id: "3",
    title: "Will Apple release an AI device in 2026?",
    category: "TECH",
    participants: 271,
    endsAt: "2026-06-01T00:00:00Z",
    difficulty: "Contested",
  },
  {
    id: "4",
    title: "Will Bitcoin hit $100K before June?",
    category: "FINANCE",
    participants: 512,
    endsAt: "2026-05-31T00:00:00Z",
    difficulty: "Unlikely",
  },
  {
    id: "5",
    title: "Will a major country ban TikTok in 2026?",
    category: "POLITICS",
    participants: 198,
    endsAt: "2026-12-31T00:00:00Z",
    difficulty: "Likely",
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

const DIFFICULTY_COLORS: Record<string, string> = {
  Contested: "#ffd700",
  Likely: "#00c9a7",
  Unlikely: "#ff6584",
};

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

export default function PredictionsPage() {
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🧠 Prediction Arena</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Stake your knowledge. Earn PPA.
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Filter Tabs */}
        <div style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          overflowX: "auto",
          paddingBottom: 4,
        }}>
          {["All", "Finance", "Sports", "Tech", "Politics"].map((tab) => (
            <button key={tab} style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: tab === "All" ? "none" : "1px solid var(--border)",
              background: tab === "All" ? "var(--accent-primary)" : "var(--bg-card)",
              color: "white",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Prediction Cards */}
        {mockPredictions.map((prediction) => (
          <div key={prediction.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="badge" style={{
                background: CATEGORY_COLORS[prediction.category] + "22",
                color: CATEGORY_COLORS[prediction.category],
              }}>
                {CATEGORY_ICONS[prediction.category]} {prediction.category}
              </span>
              <span className="badge" style={{
                background: DIFFICULTY_COLORS[prediction.difficulty] + "22",
                color: DIFFICULTY_COLORS[prediction.difficulty],
              }}>
                {prediction.difficulty}
              </span>
            </div>

            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
              {prediction.title}
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 14,
              fontSize: 12,
              color: "var(--text-secondary)",
            }}>
              <span>👥 {prediction.participants} participants</span>
              <span>⏱ {timeLeft(prediction.endsAt)}</span>
            </div>

            <Link href={`/predictions/${prediction.id}`}>
              <button className="btn-primary">Predict</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}