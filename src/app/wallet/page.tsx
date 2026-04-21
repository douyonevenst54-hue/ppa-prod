import Link from "next/link";

const mockTransactions = [
  { id: "1", type: "earn", source: "Daily Challenge", amount: 25, date: "Today, 10:32 AM" },
  { id: "2", type: "spend", source: "Prediction Stake", amount: -10, date: "Today, 9:15 AM" },
  { id: "3", type: "earn", source: "Poll Vote", amount: 5, date: "Today, 8:50 AM" },
  { id: "4", type: "earn", source: "Streak Bonus", amount: 15, date: "Yesterday, 11:00 PM" },
  { id: "5", type: "spend", source: "Prediction Stake", amount: -25, date: "Yesterday, 6:30 PM" },
  { id: "6", type: "earn", source: "Prediction Correct", amount: 48, date: "Yesterday, 3:00 PM" },
  { id: "7", type: "earn", source: "Challenge Bonus", amount: 20, date: "Apr 19, 2:15 PM" },
  { id: "8", type: "spend", source: "Prediction Stake", amount: -10, date: "Apr 19, 1:00 PM" },
];

const todayEarned = mockTransactions
  .filter(t => t.date.startsWith("Today") && t.amount > 0)
  .reduce((sum, t) => sum + t.amount, 0);

const todaySpent = mockTransactions
  .filter(t => t.date.startsWith("Today") && t.amount < 0)
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);

export default function WalletPage() {
  return (
    <div style={{ padding: "0 0 80px 0" }}>

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
          <div style={{ fontSize: 20, fontWeight: 700 }}>💰 PPA Wallet</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Your earned balance</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        <div className="card" style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          border: "1px solid #6c63ff44",
          textAlign: "center",
          padding: "28px 16px",
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: 1 }}>
            CURRENT BALANCE
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: "var(--accent-gold)", marginBottom: 4 }}>
            100
          </div>
          <div style={{ fontSize: 16, color: "var(--text-secondary)" }}>PPA Tokens</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Earned Today", value: `+${todayEarned}`, color: "#00c9a7" },
            { label: "Spent Today", value: `-${todaySpent}`, color: "#ff6584" },
            { label: "Net Today", value: `+${todayEarned - todaySpent}`, color: "var(--accent-gold)" },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "12px 8px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Link href="/predictions">
            <div className="card" style={{
              textAlign: "center", padding: "16px 12px",
              cursor: "pointer", border: "1px solid #6c63ff44",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🧠</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-primary)" }}>
                Use in Predictions
              </div>
            </div>
          </Link>
          <Link href="/challenges">
            <div className="card" style={{
              textAlign: "center", padding: "16px 12px",
              cursor: "pointer", border: "1px solid #ff658444",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎯</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ff6584" }}>
                Play Challenges
              </div>
            </div>
          </Link>
        </div>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
          RECENT ACTIVITY
        </div>

        <div className="card" style={{ padding: "4px 16px" }}>
          {mockTransactions.map((tx, i) => (
            <div key={tx.id} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: i < mockTransactions.length - 1
                ? "1px solid var(--border)"
                : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: tx.amount > 0 ? "#00c9a722" : "#ff658422",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  {tx.amount > 0 ? "⬆️" : "⬇️"}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{tx.source}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{tx.date}</div>
                </div>
              </div>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: tx.amount > 0 ? "#00c9a7" : "#ff6584",
              }}>
                {tx.amount > 0 ? "+" : ""}
                {tx.amount} PPA
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          🔒 PPA is an in-app utility token earned through skill.
          Used exclusively within Pap-Pad-App.
        </div>

      </div>
    </div>
  );
}