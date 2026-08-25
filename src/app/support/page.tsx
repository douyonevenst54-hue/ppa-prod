/**
 * /support — the contact route Pi listing review looks for, and the page a
 * confused user needs when a top-up doesn't land.
 */

import LegalFooter from '@/components/LegalFooter';
import { SUPPORT_EMAIL } from '@/lib/ppa/policy';

export const metadata = { title: 'Support — Pap Pad App' };

const FAQ = [
  {
    q: 'My top-up didn\u2019t arrive.',
    a: 'Pi payments can take a minute to settle. Reopen the app and check your balance. If it still hasn\u2019t landed after ten minutes, write to us with the time and amount and we\u2019ll trace it.',
  },
  {
    q: 'Can I turn PPA back into Pi?',
    a: 'No. PPA is an in-app credit with no cash value and there is no way to convert it back into Pi or any other currency. Only top up what you want to spend inside the app.',
  },
  {
    q: 'Why am I not on the leaderboard?',
    a: 'The accuracy board ranks players with at least ten resolved predictions, so a single lucky call can\u2019t outrank a long record. Keep playing and you\u2019ll appear.',
  },
  {
    q: 'How is reputation calculated?',
    a: 'Reputation combines your challenge accuracy, how consistently you play, and how much other players engage with content you publish.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Profile \u2192 Privacy \u2192 Delete account. Your identifiers are erased immediately and your PPA balance is gone permanently.',
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-dvh bg-[#0A0A11]">
      <article className="mx-auto max-w-2xl px-5 pb-12 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Support
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
          Write to{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-300 underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          . Include your Pi username so we can find your account. We reply within
          two business days.
        </p>

        <h2 className="mt-9 text-base font-semibold text-white">
          Common questions
        </h2>
        <dl className="mt-4 space-y-5">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
            >
              <dt className="text-sm font-medium text-white">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>

        <section className="mt-9 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-sm font-semibold text-white">Playing healthily</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            PPA is built to be fun, not compulsive. If playing stops feeling
            that way &mdash; for you or someone you know &mdash; free and
            confidential help is available in Massachusetts at 1-800-327-5050 or{' '}
            <a
              href="https://gamblinghelplinema.org"
              className="text-indigo-300 underline underline-offset-2"
            >
              gamblinghelplinema.org
            </a>
            .
          </p>
        </section>
      </article>
      <LegalFooter />
    </main>
  );
}
