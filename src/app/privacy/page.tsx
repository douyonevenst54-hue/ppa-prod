import Link from "next/link";

export default function PrivacyPage() {
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
        <div style={{ fontSize: 18, fontWeight: 700 }}>Privacy Policy</div>
      </div>

      <div style={{ padding: 16, color: "var(--text-secondary)", lineHeight: 1.8, fontSize: 14 }}>
        <div style={{ fontSize: 12, marginBottom: 20, color: "var(--text-secondary)" }}>
          Last updated: April 21, 2026
        </div>

        {[
          {
            title: "Information We Collect",
            content: "We collect your Pi Network username and user ID when you authenticate through Pi Browser. We also collect your activity data including predictions, challenge results, poll votes, and PPA token transactions within the app."
          },
          {
            title: "How We Use Your Information",
            content: "Your information is used to provide the Pap-Pad-App service, calculate accuracy scores and reputation, maintain leaderboards, and distribute PPA token rewards. We do not sell your personal information to third parties."
          },
          {
            title: "PPA Tokens",
            content: "PPA is an in-app utility token earned through skill-based activities. It has no cash value and cannot be withdrawn as real currency. PPA is used exclusively within Pap-Pad-App."
          },
          {
            title: "Data Storage",
            content: "Your data is stored securely on encrypted servers. We use industry-standard security measures to protect your information from unauthorized access."
          },
          {
            title: "Third Party Services",
            content: "We use Pi Network for authentication. Please review Pi Network's privacy policy for information about how they handle your data."
          },
          {
            title: "Contact",
            content: "For privacy-related questions, contact us through the Pi Network developer portal or via the app feedback system."
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