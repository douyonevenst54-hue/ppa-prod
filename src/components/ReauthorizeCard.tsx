'use client';

/**
 * "Re-authorize Pi access" — now conditional.
 *
 * Previously mounted unconditionally in Profile, so every user saw a permanent
 * to-do they'd already done. It now renders only when a scope is actually
 * missing, and the copy no longer mentions redemption, which no longer exists.
 *
 * ADAPT: usePiScopes() to whatever tracks granted scopes in your app.
 */

const REQUIRED_SCOPES = ['username', 'payments'] as const;

export default function ReauthorizeCard({
  grantedScopes,
  onReauthorize,
}: {
  grantedScopes: string[];
  onReauthorize: () => void;
}) {
  const missing = REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
  if (missing.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">Reconnect to Pi</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-400">
        PPA needs permission to {missing.includes('payments') ? 'process top-ups' : 'read your Pi username'}.
        Reconnect to keep using the app.
      </p>
      <button
        type="button"
        onClick={onReauthorize}
        className="mt-4 w-full rounded-xl bg-indigo-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
      >
        Reconnect with Pi
      </button>
    </section>
  );
}
