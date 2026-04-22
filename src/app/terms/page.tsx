import Link from "next/link";

export default function TermsPage() {
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
        <div style={{ fontSize: 18, fontWeight: 700 }}>Terms of Service</div>
      </div>

      <div style={{ padding: 16, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: 14 }}>
        <div style={{ fontSize: 12, marginBottom: 20, color: "var(--text-secondary)" }}>
          Last updated: April 21, 2026
        </div>

        {[
          {
            title: "Acceptance of Terms",
            content: "By using Pap-Pad-App, you agree to these Terms of Service. If you do not agree, please do not use the app."
          },
          {
            title: "Eligibility",
            content: "You must have a verified Pi Network account to use Pap-Pad-App. You must be of legal age in your jurisdiction to participate in skill-based competitions."
          },
          {
            title: "PPA Tokens",
            content: "PPA tokens are in-app utility tokens with no monetary value. They cannot be exchanged for real currency. PPA is earned through skill-based activities including challenges, predictions, and polls. We reserve the right to adjust token economics at any time."
          },
          {
            title: "Skill-Based Platform",
            content: "Pap-Pad-App is a skill-based platform. Rewards are determined by accuracy, consistency, and contribution — not random chance. Results are based on real-world outcomes and user performance."
          },
          {
            title: "User Content",
            content: "Content you create through the Creator Hub must be accurate, appropriate, and not misleading. We reserve the right to remove content that violates these standards."
          },
          {
            title: "Prohibited Activities",
            content: "You may not create multiple accounts, use bots or automated tools, collude with other users, or attempt to manipulate the platform's reward systems."
          },
          {
            title: "Termination",
            content: "We reserve the right to suspend or terminate accounts that violate these terms. PPA balances in terminated accounts are forfeited."
          },
          {
            title: "Disclaimer",
            content: "Pap-Pad-App is provided as-is. We make no guarantees about uptime, token value, or platform continuity. Participation is at your own risk."
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              {section.title}
            </div>
            <div>{section.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}