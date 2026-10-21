import Link from "next/link";
import HomeClient from "@/components/HomeClient";
import StreakCard from "@/components/StreakCard";
import { HomeDashboard } from "@/components/HomeDashboard";

/**
 * Home.
 *
 * The signed-in half of this screen moved into HomeDashboard, a client
 * component, because this page is rendered on the server with no session and
 * therefore could never say anything about the person reading it. That is why
 * it used to carry a hardcoded leaderboard of invented usernames and a
 * "Earn up to N PPA" figure multiplied out in the browser, neither of which
 * was connected to anything real.
 *
 * What is left here is the genuinely public part: an open prediction anyone
 * can see, and the way through to the rest of the app.
 */

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

interface FeaturedPrediction {
  id: string;
  title: string;
  category: string;
  endsAt: string;
  participantCount: number;
}

async function getFeaturedPrediction(): Promise<FeaturedPrediction | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/predictions`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return data.predictions?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const prediction = await getFeaturedPrediction();

  return (
    <div style={{ padding: "0 0 80px 0", minHeight: "100vh" }}>

      <HomeClient />

      <div style={{ padding: 16 }}>

        <HomeDashboard />

        {/*
          StreakCard is the only thing that renders the daily check-in, which
          is what awards STREAK PPA — so it stays until that earn path moves
          somewhere else. It does now overlap with the dashboard's week strip:
          the strip shows which days were played, this asks you to claim a day.
          Worth collapsing into one, which is a product decision rather than a
          tidy-up.
        */}
        <StreakCard />

        {prediction && (
          <section className="card" style={{ marginBottom: 14, padding: 20 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10,
            }}>
              <span className="badge" style={{
                background: CATEGORY_COLORS[prediction.category] + "22",
                color: CATEGORY_COLORS[prediction.category],
              }}>
                {CATEGORY_ICONS[prediction.category]} {prediction.category}
              </span>
              <span style={{
                fontSize: 12, color: "var(--text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}>
                {timeLeft(prediction.endsAt)}
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
              {prediction.title}
            </div>
            <div style={{
              fontSize: 13, color: "var(--text-secondary)", marginBottom: 16,
              fontVariantNumeric: "tabular-nums",
            }}>
              {prediction.participantCount} taking a view
            </div>

            <Link href={`/predictions/${prediction.id}`}>
              <button className="btn-primary">Make your call</button>
            </Link>
          </section>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { icon: "🧠", label: "Predictions", href: "/predictions", color: "#6c63ff" },
            { icon: "🎯", label: "Challenges", href: "/challenges", color: "#ff6584" },
            { icon: "🗳️", label: "Polls", href: "/polls", color: "#00c9a7" },
            { icon: "🎨", label: "Creator hub", href: "/creator", color: "#ffd700" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="card" style={{
                textAlign: "center", padding: "20px 12px",
                cursor: "pointer", borderColor: item.color + "44",
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
