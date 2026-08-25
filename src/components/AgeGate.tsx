'use client';

/**
 * Age gate, shown once after first Pi authentication.
 *
 * Deliberately not dismissible and deliberately not a date picker: we need to be
 * able to show the user was asked and answered, and storing a date of birth
 * creates a liability with no product use. Declining signs the user out.
 *
 * ADAPT: signOut() to match your auth helper.
 */

import { useState } from 'react';
import { MIN_AGE_YEARS } from '@/lib/ppa/policy';

export default function AgeGate({
  onConfirmed,
  onDeclined,
}: {
  onConfirmed: () => void;
  onDeclined: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/account/attest-age', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    setBusy(false);
    if (res.ok) onConfirmed();
    else setError('That didn\u2019t save. Check your connection and try again.');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121C] p-6">
        <h2 id="age-gate-title" className="text-lg font-semibold text-white">
          Confirm your age
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          PPA is for people {MIN_AGE_YEARS} and over. Confirm your age to continue.
        </p>

        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-indigo-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:opacity-60"
        >
          {busy ? 'Saving\u2026' : `I am ${MIN_AGE_YEARS} or older`}
        </button>

        <button
          type="button"
          onClick={onDeclined}
          className="mt-2 w-full rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          I am under {MIN_AGE_YEARS}
        </button>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
