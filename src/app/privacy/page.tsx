/**
 * /privacy — DRAFT, same caveat as /terms.
 *
 * Every claim here must stay true of the running app. If you add analytics, a
 * third-party SDK, or start storing wallet addresses again, this page changes
 * the same day.
 */

import LegalDoc, { Section } from "@/components/LegalDoc";

export const metadata = { title: "Privacy Policy — Pap-Pad-App" };

const li = { marginBottom: 6 };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="August 26, 2026">
      <Section title="What we collect">
        <ul style={{ paddingLeft: 18 }}>
          <li style={li}>Your Pi Network user ID and username, from Pi when you sign in.</li>
          <li style={li}>
            Your activity: challenge answers and scores, predictions, poll votes,
            streaks, PPA balance and transactions, and content you publish.
          </li>
          <li style={li}>Your confirmation that you meet the minimum age, and when you gave it.</li>
          <li style={li}>Basic technical logs needed to keep the service running.</li>
        </ul>
      </Section>

      <Section title="What we do not collect">
        We do not ask for your legal name, email address, phone number, date of
        birth, physical address, or government ID. We do not store your Pi wallet
        address. We do not use advertising trackers or sell data to anyone.
      </Section>

      <Section title="What is public">
        Your Pi username, tier, streak, accuracy, and reputation appear on public
        leaderboards and on your profile page, along with content you publish. You
        can turn this off in Profile → Privacy, which removes you from all public
        rankings.
      </Section>

      <Section title="Who we share with">
        Pi Network, to authenticate you and process Pi payments. Our hosting and
        database providers, who process data on our instructions. Apps in the PPA
        ecosystem you choose to connect, which receive only your PPA balance and
        user ID. Nobody else, unless the law requires it.
      </Section>

      <Section title="How long we keep it">
        Account data is kept while your account is open. Technical logs are kept
        for 90 days. Transaction records are kept for seven years for accounting
        purposes, de-identified after account deletion.
      </Section>

      <Section title="Your controls">
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          <li style={li}>
            <strong style={{ color: "var(--text-primary)" }}>Download your data</strong> — Profile
            → Privacy. Everything tied to your account, as a JSON file.
          </li>
          <li style={li}>
            <strong style={{ color: "var(--text-primary)" }}>Leave the leaderboards</strong> — Profile → Privacy.
          </li>
          <li style={li}>
            <strong style={{ color: "var(--text-primary)" }}>Delete your account</strong> — Profile
            → Privacy. Your identifiers are erased immediately and your PPA
            balance is gone permanently.
          </li>
        </ul>
        <p>
          One honest limit: PPA transactions are recorded in a hash-chained
          ledger, and removing entries would break the chain that makes the ledger
          verifiable. After deletion those entries remain, but they are
          de-identified and can no longer be linked back to you.
        </p>
      </Section>

      <Section title="Children">
        PPA is not for people under 18. We do not knowingly collect data from
        children. If you believe a child has an account, write to us and we will
        remove it.
      </Section>

      <Section title="Contact">
        Privacy questions and data requests:{" "}
        <a href="mailto:support@pappad.app" style={{ color: "var(--accent-primary)" }}>
          support@pappad.app
        </a>
        . We answer within 30 days.
      </Section>
    </LegalDoc>
  );
}
