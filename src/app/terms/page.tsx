/**
 * /terms
 *
 * Written by the operator to describe how the app actually works, in language
 * a player can read. Not reviewed by a lawyer — so it claims nothing it cannot
 * support, and describes the product rather than reciting boilerplate.
 *
 * That makes accuracy the whole job. A generic template would describe a
 * product that is not this one, and terms that misdescribe the product are
 * worse than plain terms: every inaccuracy is a statement to a user that turns
 * out not to be true.
 *
 * KEEP IT CURRENT. This page drifted once already — it was written in August
 * and still described predictions and polls after daily challenges, reputation
 * tiers, emblems, the ecosystem directory and supporter tiers had all shipped.
 * When a feature changes what a player gets or gives up, it changes this page.
 */

import Link from "next/link";
import LegalDoc, { Section } from "@/components/LegalDoc";

export const metadata = { title: "Terms of Service — Pap-Pad-App" };

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="October 24, 2026">
      <Section title="What PPA is">
        <p style={{ marginBottom: 10 }}>
          Pap Pad App is a knowledge game for the Pi Network community. Each day
          there is one set of five questions per difficulty, and everyone gets
          the same set — which is what makes the leaderboard comparable. You can
          also make calls on future events, vote in polls, and publish content
          for other players.
        </p>
        <p>
          Each daily tier can be played once per day. A new set arrives at
          midnight UTC.
        </p>
      </Section>

      <Section title="PPA is a credit, and has no cash value">
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

      <Section title="Reputation and tiers">
        <p style={{ marginBottom: 10 }}>
          Answering correctly builds a reputation score, which unlocks harder
          daily tiers. Playing consistently and accurately also raises your
          player tier, which slightly increases the PPA awarded for a round.
        </p>
        <p style={{ marginBottom: 10, color: "var(--accent-gold)" }}>
          Reputation is recognition of what you have done. It is not currency
          and not a claim on anything. It cannot be spent, transferred, sold or
          redeemed, and it is not a promise of any future distribution,
          allocation or airdrop. We are not offering anything in exchange for
          accumulating it.
        </p>
        <p>
          Daily limits apply to how much PPA can be awarded, per activity and in
          total. If a limit shortens a payout we say so on the result screen.
        </p>
      </Section>

      <Section title="Emblems">
        An emblem is a visual record of how you have played, across seven
        realms. It is non-transferable: it cannot be bought, sold, sent to
        another account or traded, and it carries no cash value. It is a record,
        not an asset.
      </Section>

      <Section title="Other apps we link to">
        The ecosystem directory lists apps submitted by their developers. We
        check that a listing is well-formed and that its link is a plain https
        address, and we read submissions before publishing them. That is not an
        endorsement, an audit, or a guarantee of anything. Those apps are
        operated by other people under their own terms, and what you do there is
        between you and them. Look before you sign in or send anything anywhere.
      </Section>

      <Section title="Supporter tiers">
        If you stake Pi toward PPA in Pi Network&apos;s Ecosystem Directory, you
        may receive a supporter tier and recognition or early access inside this
        app. Neither Pi Network nor PPA pays any reward, interest, PPA or other
        value for staking, and a supporter tier grants no PPA, no multiplier, no
        reputation and no advantage in any ranking. Your Pi is staked with Pi
        Network under their terms, not ours.
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
