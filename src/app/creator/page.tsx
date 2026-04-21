import Link from "next/link";

const mockStats = {
  totalCreated: 0,
  totalEarned: 0,
  engagementRate: 0,
};

export default function CreatorPage() {
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🎨 Creator Hub</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Create content. Earn when others engage.
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}>
          {[
            { label: "Created", value: mockStats.totalCreated },
            { label: "PPA Earned", value: mockStats.totalEarned },
            { label: "Engagement", value: `${mockStats.engagementRate}%` },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-gold)", marginBottom: 2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Create Options */}
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          CREATE NEW
        </div>

        {[
          {
            href: "/creator/new/prediction",
            icon: "🧠",
            title: "Create Prediction",
            desc: "Post a yes/no or multiple choice prediction for the community",
            color: "#6c63ff",
            reward: "Earn 2 PPA per participant",
          },
          {
            href: "/creator/new/poll",
            icon: "🗳️",
            title: "Create Poll",
            desc: "Ask the community anything — opinions, preferences, predictions",
            color: "#00c9a7",
            reward: "Earn 1 PPA per vote",
          },
          {
            href: "/creator/new/challenge",
            icon: "🎯",
            title: "Create Challenge",
            desc: "Build a quiz challenge with your own questions",
            color: "#ff6584",
            reward: "Earn 3 PPA per player",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="card" style={{
              marginBottom: 12,
              border: `1px solid ${item.color}44`,
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: item.color + "22",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: item.color }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, lineHeight: 1.4 }}>
                    {item.desc}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--accent-gold)", fontWeight: 600 }}>
                    💰 {item.reward}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: "var(--text-secondary)" }}>›</div>
              </div>
            </div>
          </Link>
        ))}

        {/* Info Card */}
        <div className="card" style={{
          background: "#6c63ff11",
          border: "1px solid #6c63ff44",
          marginTop: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--accent-primary)" }}>
            ⭐ How Creator Earnings Work
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Every time someone interacts with your content — votes, plays, or predicts — you earn PPA automatically.
            Higher engagement = more PPA. Quality content climbs the feed organically.
          </div>
        </div>

      </div>
    </div>
  );
}