/**
 * /support — the contact route Pi listing review looks for, and the page a
 * confused user needs when a top-up doesn't land.
 */

import LegalDoc, { Section } from "@/components/LegalDoc";

export const metadata = { title: "Support — Pap-Pad-App" };

const FAQ = [
  {
    q: "My top-up didn't arrive.",
    a: "Pi payments can take a minute to settle. Reopen the app and check your balance. If it still hasn't landed after ten minutes, write to us with the time and amount and we'll trace it.",
  },
  {
    q: "Can I turn PPA back into Pi?",
    a: "No. PPA is an in-app credit with no cash value and there is no way to convert it back into Pi or any other currency. Only top up what you want to spend inside the app.",
  },
  {
    q: "Do predictions cost anything?",
    a: "No. Predictions are free to enter and a wrong call costs you no PPA. Your confidence level affects your reputation score, not your balance.",
  },
  {
    q: "Why am I not on the leaderboard?",
    a: "The accuracy board ranks players with at least ten resolved predictions, so a single lucky call can't outrank a long record. Keep playing and you'll appear.",
  },
  {
    q: "How is reputation calculated?",
    a: "Correct calls raise it and wrong ones lower it, weighted by the confidence you chose. A confident correct call moves it most; a confident miss costs the most.",
  },
  {
    q: "How do I delete my account?",
    a: "Profile → Privacy → Delete my account. Your identifiers are erased immediately and your PPA balance is gone permanently.",
  },
];

export default function SupportPage() {
  return (
    <LegalDoc title="Support" updated="August 26, 2026">
      <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 24 }}>
        Write to{" "}
        <a href="mailto:support@pappad.app" style={{ color: "var(--accent-primary)" }}>
          support@pappad.app
        </a>
        . Include your Pi username so we can find your account. We reply within
        two business days.
      </p>

      <Section title="Common questions">
        {FAQ.map((item) => (
          <div key={item.q} className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              {item.q}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {item.a}
            </div>
          </div>
        ))}
      </Section>

      <div
        className="card"
        style={{ border: "1px solid #00c9a744", background: "#00c9a711" }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Playing healthily
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          PPA is built to be fun, not compulsive. If playing stops feeling that
          way — for you or someone you know — free and confidential help is
          available in Massachusetts at 1-800-327-5050 or{" "}
          <a
            href="https://gamblinghelplinema.org"
            style={{ color: "var(--accent-primary)" }}
          >
            gamblinghelplinema.org
          </a>
          .
        </div>
      </div>
    </LegalDoc>
  );
}
