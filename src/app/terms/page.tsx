/**
 * /terms — DRAFT.
 *
 * Written to describe how the app actually works and to be readable by a user,
 * not to be filed as-is. Have a Massachusetts attorney read it before Mainnet.
 * Do not paste a generic template over this: a template will describe a product
 * you no longer operate, and inaccurate terms are worse than plain ones.
 */

import Link from "next/link";
import LegalDoc, { Section } from "@/components/LegalDoc";

export const metadata = { title: "Terms of Service — Pap-Pad-App" };

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="August 26, 2026">
      <Section title="What PPA is">
        Pap Pad App is a prediction, polling, and knowledge-challenge platform for
        the Pi Network community. You answer timed questions, make calls on future
        events, vote in polls, and publish content for other players.
      </Section>

      <Section title="PPA tokens have no cash value">
        <p style={{ marginBottom: 10 }}>
          PPA is an in-app credit. You can buy PPA with Pi at a published rate
          (1,000 PPA per 1 Pi) and spend it inside the app.
        </p>
        <p style={{ marginBottom: 10, color: "var(--accent-gold)" }}>
          PPA cannot be exchanged back into Pi, cryptocurrency, cash, or anything
          else of value. It cannot be transferred to another account, sold, or
          withdrawn. Top-ups are final and non-refundable.
        </p>
        <p>
          We may change the purchase rate, the cost of in-app features, and the
          amount of PPA awarded for activity. Changes apply going forward, not
          retroactively to PPA you already hold.
        </p>
      </Section>

      <Section title="This is not gambling">
        <p style={{ marginBottom: 10 }}>
          Predictions are free to enter. Nothing is staked, nothing is debited for
          a wrong call, and because PPA has no cash value and cannot be converted
          into anything of value, playing PPA does not put money at risk and does
          not pay out money.
        </p>
        <p>
          We do not operate a casino, a sportsbook, a lottery, or a sweepstakes.
          Where we run a prize tournament, entry is free, the prize is fixed and
          announced in advance, and results are decided by demonstrated skill.
        </p>
      </Section>

      <Section title="Who can use it">
        You must be 18 or older and hold a valid Pi Network account. One account
        per person. We may suspend or close accounts that use automation, exploit
        scoring bugs, create multiple accounts to farm rewards, or abuse the
        referral system.
      </Section>

      <Section title="Content you publish">
        You keep ownership of polls, predictions, and challenges you write. You
        give us permission to display them in the app. Do not post content that is
        illegal, harassing, or that targets a private individual.
      </Section>

      <Section title="Closing your account">
        You can delete your account at any time from Profile. Deleting removes
        your PPA balance permanently. See the{" "}
        <Link href="/privacy" style={{ color: "var(--accent-primary)" }}>
          Privacy Policy
        </Link>{" "}
        for what happens to your data.
      </Section>

      <Section title="No warranty, and limits on liability">
        PPA is provided as is. We do not guarantee the app will be available
        without interruption or free of errors. To the extent the law allows, our
        total liability to you is limited to the amount of Pi you spent in the app
        in the twelve months before the claim.
      </Section>

      <Section title="Governing law">
        These terms are governed by the laws of the Commonwealth of Massachusetts,
        United States. Nothing here limits any right you have under the consumer
        protection law of your own country or state.
      </Section>

      <Section title="Contact">
        Questions about these terms:{" "}
        <a href="mailto:support@pappad.app" style={{ color: "var(--accent-primary)" }}>
          support@pappad.app
        </a>
      </Section>
    </LegalDoc>
  );
}
