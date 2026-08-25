/**
 * /terms
 *
 * DRAFT. This is written to be accurate to how the app now works and readable by
 * an actual user, not to be a substitute for review by a Massachusetts attorney.
 * Have counsel read it before you submit for Pi ecosystem listing. Do not paste
 * a generic template over it — a template will describe a product you no longer
 * operate, and an inaccurate terms page is worse than a plain one.
 */

import LegalFooter from '@/components/LegalFooter';
import { SUPPORT_EMAIL, MIN_AGE_YEARS, PI_TO_PPA_RATE } from '@/lib/ppa/policy';

export const metadata = { title: 'Terms of Service — Pap Pad App' };

const UPDATED = 'August 25, 2026';

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-[#0A0A11]">
      <article className="mx-auto max-w-2xl px-5 pb-12 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Terms of Service
        </h1>
        <p className="mt-1 text-sm text-slate-500">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">What PPA is</h2>
            <p className="mt-2">
              Pap Pad App is a prediction, polling, and knowledge-challenge
              platform for the Pi Network community. You answer timed questions,
              make calls on future events, vote in polls, and publish content for
              other players.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              PPA tokens have no cash value
            </h2>
            <p className="mt-2">
              PPA is an in-app credit. You can buy PPA with Pi at a published
              rate ({PI_TO_PPA_RATE.toLocaleString()} PPA per 1 Pi) and spend it
              inside the app.
            </p>
            <p className="mt-2 font-medium text-amber-200">
              PPA cannot be exchanged back into Pi, cryptocurrency, cash, or
              anything else of value. It cannot be transferred to another
              account, sold, or withdrawn. Top-ups are final and non-refundable.
            </p>
            <p className="mt-2">
              We may change the purchase rate, the cost of in-app features, and
              the amount of PPA awarded for activity. Changes apply going
              forward, not retroactively to PPA you already hold.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              This is not gambling
            </h2>
            <p className="mt-2">
              Because PPA has no cash value and cannot be converted into
              anything of value, playing PPA does not put money at risk and does
              not pay out money. We do not operate a casino, a sportsbook, a
              lottery, or a sweepstakes.
            </p>
            <p className="mt-2">
              Where we run a prize tournament, entry is free, the prize is fixed
              and announced in advance, and results are decided by demonstrated
              skill. Official rules are published with each tournament.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Who can use it</h2>
            <p className="mt-2">
              You must be {MIN_AGE_YEARS} or older and hold a valid Pi Network
              account. One account per person. We may suspend or close accounts
              that use automation, exploit scoring bugs, create multiple accounts
              to farm rewards, or abuse the referral system.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Content you publish
            </h2>
            <p className="mt-2">
              You keep ownership of polls, predictions, and challenges you
              write. You give us permission to display them in the app. Do not
              post content that is illegal, harassing, or that targets a private
              individual.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Closing your account
            </h2>
            <p className="mt-2">
              You can delete your account at any time from Profile. Deleting
              removes your PPA balance permanently. See the{' '}
              <a href="/privacy" className="text-indigo-300 underline underline-offset-2">
                Privacy Policy
              </a>{' '}
              for what happens to your data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              No warranty, and limits on liability
            </h2>
            <p className="mt-2">
              PPA is provided as is. We do not guarantee the app will be
              available without interruption or free of errors. To the extent
              the law allows, our total liability to you is limited to the
              amount of Pi you spent in the app in the twelve months before the
              claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Governing law
            </h2>
            <p className="mt-2">
              These terms are governed by the laws of the Commonwealth of
              Massachusetts, United States. Nothing here limits any right you
              have under the consumer protection law of your own country or
              state.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p className="mt-2">
              Questions about these terms:{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-indigo-300 underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </article>
      <LegalFooter />
    </main>
  );
}
