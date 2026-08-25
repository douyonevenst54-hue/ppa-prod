'use client';

/**
 * Top up PPA — replaces the two-tab "PPA Exchange" (Buy / Redeem) screen.
 *
 * Design intent: the old screen's problem wasn't the layout, it was that the
 * numbers didn't reconcile with the disclosure underneath them. So the centre of
 * this screen is a receipt that adds up in public, line by line, before the user
 * commits. Nothing is deducted that isn't printed.
 *
 * There is no Redeem tab, and there is no code path to one.
 *
 * ADAPT: usePiSdk / useUser hooks to match your existing client helpers.
 */

import { useState } from 'react';
import {
  PI_TO_PPA_RATE,
  TOPUP_TIERS_PI,
  TOKEN_DISCLOSURE,
} from '@/lib/ppa/policy';
import { formatPPA, formatPi } from '@/lib/ppa/format';

type Status = 'idle' | 'paying' | 'done' | 'error';

/**
 * No `declare global` here on purpose. src/hooks/usePiAuth.ts already declares
 * Window.Pi with a precise type; a second declaration with `any` collides
 * (TS2717). We read it through that existing global instead.
 */

export default function TopUpPanel({
  balance,
  onBalanceChange,
}: {
  balance: number;
  onBalanceChange: (next: number) => void;
}) {
  const [selected, setSelected] = useState<number>(1);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  const ppaAmount = Math.round(selected * PI_TO_PPA_RATE);

  async function startTopUp() {
    const Pi = window.Pi;
    if (!Pi) {
      setStatus('error');
      setMessage('Open PPA in Pi Browser to top up.');
      return;
    }

    setStatus('paying');
    setMessage('');

    try {
      Pi.createPayment(
        {
          amount: selected,
          memo: `Top up ${formatPPA(ppaAmount)} PPA`,
          metadata: { kind: 'topup', ppaAmount },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            const res = await fetch('/api/ppa/topup/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId }),
            });
            if (!res.ok) throw new Error('Approval failed');
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            const res = await fetch('/api/ppa/topup/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, txid }),
            });
            if (!res.ok) throw new Error('Completion failed');
            const data = await res.json();
            onBalanceChange(data.balance);
            setStatus('done');
            setMessage(`${formatPPA(data.credited)} PPA added to your balance.`);
          },
          onCancel: () => {
            setStatus('idle');
            setMessage('Top up cancelled. Nothing was charged.');
          },
          onError: () => {
            setStatus('error');
            setMessage('The payment didn\u2019t go through. Nothing was charged.');
          },
        },
      );
    } catch {
      setStatus('error');
      setMessage('The payment didn\u2019t go through. Nothing was charged.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-28 pt-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Top up PPA
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Add credit to play challenges, enter predictions, and publish content.
        </p>
      </header>

      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Current balance
        </div>
        <div className="mt-1 text-3xl font-semibold text-amber-300">
          {formatPPA(balance)}{' '}
          <span className="text-base font-medium text-amber-300/70">PPA</span>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs uppercase tracking-wider text-slate-500">
          Choose an amount
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {TOPUP_TIERS_PI.map((tier) => {
            const active = tier === selected;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setSelected(tier)}
                aria-pressed={active}
                disabled={status === 'paying'}
                className={[
                  'rounded-xl border px-3 py-3 text-sm font-medium transition',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400',
                  active
                    ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                    : 'border-white/5 bg-white/[0.03] text-slate-300 hover:border-white/15',
                ].join(' ')}
              >
                {tier}&#960;
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* The receipt. Every line that affects the total is printed here. */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          What you get
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="text-slate-400">You pay</dt>
            <dd className="tabular-nums text-slate-200">{formatPi(selected)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-slate-400">
              Rate (1&#960; = {formatPPA(PI_TO_PPA_RATE)} PPA)
            </dt>
            <dd className="tabular-nums text-slate-200">
              &#215;{formatPPA(PI_TO_PPA_RATE)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-slate-400">Fees</dt>
            <dd className="tabular-nums text-slate-200">None</dd>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
            <dt className="font-medium text-white">You receive</dt>
            <dd className="text-2xl font-semibold tabular-nums text-amber-300">
              {formatPPA(ppaAmount)} PPA
            </dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        onClick={startTopUp}
        disabled={status === 'paying'}
        className="w-full rounded-xl bg-indigo-500 px-4 py-4 text-base font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:opacity-60"
      >
        {status === 'paying'
          ? 'Waiting for Pi\u2026'
          : `Top up ${formatPPA(ppaAmount)} PPA for ${selected}\u03C0`}
      </button>

      {message && (
        <p
          role="status"
          className={
            status === 'error'
              ? 'text-sm text-rose-300'
              : 'text-sm text-teal-300'
          }
        >
          {message}
        </p>
      )}

      {/* Placed above the fold of the action, not buried in Terms. */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
        <p className="text-sm leading-relaxed text-amber-100/90">
          {TOKEN_DISCLOSURE}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/60">
          Top-ups are final. PPA cannot be transferred to another account.{' '}
          <a href="/terms" className="underline underline-offset-2">
            Read the terms
          </a>
          .
        </p>
      </div>
    </div>
  );
}