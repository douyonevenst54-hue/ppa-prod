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

async function getPredictions() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/predictions`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return data.predictions || [];
  } catch {
    return [];
  }
}

export default async function PredictionsPage() {
  const predictions = await getPredictions();

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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🧠 Prediction Arena</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Stake your knowledge. Earn PPA.</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {["All", "Finance", "Sports", "Tech", "Politics"].map((tab) => (
            <button key={tab} style={{
              padding: "6px 14px", borderRadius: 20,
              border: tab === "All" ? "none" : "1px solid var(--border)",
              background: tab === "All" ? "var(--accent-primary)" : "var(--bg-card)",
              color: "white", fontSize: 13, fontWeight: 500,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {tab}
            </button>
          ))}
        </div>

        {predictions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            No predictions available yet.
          </div>
        ) : (
          predictions.map((prediction: {
            id: string;
            title: string;
            category: string;
            participantCount: number;
            endsAt: string;
          }) => (
            <div key={prediction.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="badge" style={{
                  background: CATEGORY_COLORS[prediction.category] + "22",
                  color: CATEGORY_COLORS[prediction.category],
                }}>
                  {CATEGORY_ICONS[prediction.category]} {prediction.category}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  ⏱ {timeLeft(prediction.endsAt)}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                {prediction.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
                👥 {prediction.participantCount} participants
              </div>
              <Link href={`/predictions/${prediction.id}`}>
                <button className="btn-primary">Predict</button>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}