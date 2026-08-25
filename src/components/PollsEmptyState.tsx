'use client';

/**
 * Polls empty state.
 *
 * "No polls found / Try a different search or category" on a primary nav tab is
 * a dead end. An empty screen is an invitation to act, so this one routes to the
 * thing that fixes it.
 */

export default function PollsEmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-base font-medium text-slate-200">
          No polls match those filters
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-16 text-center">
      <p className="text-base font-medium text-slate-200">
        No polls running right now
      </p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
        Polls are written by players. Ask a question and see how the community
        splits.
      </p>
      <a
        href="/creator?type=poll"
        className="mt-5 inline-block rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
      >
        Write the first poll
      </a>
    </div>
  );
}
