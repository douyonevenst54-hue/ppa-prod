/**
 * /privacy
 *
 * DRAFT — same caveat as /terms. Every claim below must stay true of the running
 * app. If you add analytics, a third-party SDK, or start storing wallet
 * addresses again, this page changes the same day.
 */

import LegalFooter from '@/components/LegalFooter';
import { SUPPORT_EMAIL } from '@/lib/ppa/policy';

export const metadata = { title: 'Privacy Policy — Pap Pad App' };

const UPDATED = 'August 25, 2026';

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#0A0A11]">
      <article className="mx-auto max-w-2xl px-5 pb-12 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-slate-500">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">
              What we collect
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                Your Pi Network user ID and username, from Pi when you sign in.
              </li>
              <li>
                Your activity in the app: challenge answers and scores,
                predictions, poll votes, streaks, PPA balance and transactions,
                and content you publish.
              </li>
              <li>
                Your confirmation that you meet the minimum age, and when you
                gave it.
              </li>
              <li>Basic technical logs needed to keep the service running.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              What we do not collect
            </h2>
            <p className="mt-2">
              We do not ask for your legal name, email address, phone number,
              date of birth, physical address, or government ID. We do not store
              your Pi wallet address. We do not use advertising trackers or sell
              data to anyone.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              What is public
            </h2>
            <p className="mt-2">
              Your Pi username, tier, streak, accuracy, and reputation appear on
              public leaderboards and on your profile page, along with content
              you publish. You can turn this off in Profile &rarr; Privacy, which
              removes you from all public rankings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Who we share with
            </h2>
            <p className="mt-2">
              Pi Network, to authenticate you and process Pi payments. Our
              hosting and database providers, who process data on our
              instructions. Apps in the PPA ecosystem you choose to connect,
              which receive only your PPA balance and user ID. Nobody else,
              unless the law requires it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              How long we keep it
            </h2>
            <p className="mt-2">
              Account data is kept while your account is open. Technical logs
              are kept for 90 days. Transaction records are kept for seven years
              for accounting purposes, de-identified after account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Your controls</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <span className="text-white">Download your data</span> — Profile
                &rarr; Privacy &rarr; Download my data. Returns everything tied
                to your account as a JSON file.
              </li>
              <li>
                <span className="text-white">Leave the leaderboards</span> —
                Profile &rarr; Privacy.
              </li>
              <li>
                <span className="text-white">Delete your account</span> —
                Profile &rarr; Privacy. Your identifiers are erased immediately
                and your PPA balance is gone permanently.
              </li>
            </ul>
            <p className="mt-3">
              One honest limit: PPA transactions are recorded in a hash-chained
              ledger, and removing entries would break the chain that makes the
              ledger verifiable. After deletion those entries remain, but they
              are de-identified and can no longer be linked back to you.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Children</h2>
            <p className="mt-2">
              PPA is not for people under 18. We do not knowingly collect data
              from children. If you believe a child has an account, write to us
              and we will remove it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p className="mt-2">
              Privacy questions and data requests:{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-indigo-300 underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>
              . We answer within 30 days.
            </p>
          </section>
        </div>
      </article>
      <LegalFooter />
    </main>
  );
}
