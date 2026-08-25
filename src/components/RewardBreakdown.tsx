'use client';

/**
 * Challenge / prediction results breakdown.
 *
 * Fixes `+-4 PPA` at the root: multipliers are rendered as multipliers ("1.05x")
 * and deltas as signed values, with the sign applied exactly once by
 * formatSignedPPA. The old card rendered a multiplier's effect as a signed
 * delta, then prefixed a literal "+", which is where `+-4` came from.
 *
 * Also renders the capped case honestly. If the daily emission cap trimmed the
 * payout, say so — a total that doesn't match the lines above it reads as a bug.
 */

import { formatSignedPPA, formatMultiplier, formatPPA } from '@/lib/ppa/format';
import type { RewardLine } from '@/lib/ppa/rewards';

export default function RewardBreakdown({
  lines,
  total,
  earned,
  balance,
  secondsTaken,
  capped,
}: {
  lines: RewardLine[];
  total: number;
  earned: number;
  balance: number;
  secondsTaken: number;
  capped?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          PPA earned
        </div>

        <dl className="mt-3 space-y-2 text-sm">
          {lines.map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="text-slate-400">{line.label}</dt>
              <dd className="shrink-0 tabular-nums text-slate-200">
                {line.kind === 'delta'
                  ? formatSignedPPA(line.value)
                  : formatMultiplier(line.factor)}
              </dd>
            </div>
          ))}

          <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
            <dt className="font-medium text-white">Total</dt>
            <dd className="text-xl font-semibold tabular-nums text-amber-300">
              {formatSignedPPA(earned)}
            </dd>
          </div>
        </dl>

        {capped && (
          <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs leading-relaxed text-slate-400">
            You&rsquo;ve reached today&rsquo;s earning limit, so this round paid{' '}
            {formatPPA(earned)} of {formatPPA(total)} PPA. The limit resets at
            midnight UTC.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm">
        <span className="text-slate-400">Time taken</span>
        <span className="tabular-nums text-slate-200">{secondsTaken}s</span>
      </div>

      <div className="rounded-2xl border border-teal-400/20 bg-teal-400/[0.06] p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-teal-200/60">
          New balance
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-300">
          {formatPPA(balance)} PPA
        </div>
      </div>
    </div>
  );
}
