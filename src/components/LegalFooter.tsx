/**
 * Legal footer.
 *
 * In the recording there was no route to terms, privacy, or support anywhere in
 * 2:37 of navigation. Mount this in the root layout so it appears on every page,
 * above the bottom nav.
 */

import { SUPPORT_EMAIL, TOKEN_DISCLOSURE } from '@/lib/ppa/policy';

export default function LegalFooter() {
  return (
    <footer className="border-t border-white/5 px-4 pb-28 pt-6 text-center">
      <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500">
        {TOKEN_DISCLOSURE}
      </p>
      <nav
        aria-label="Legal and support"
        className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400"
      >
        <a href="/terms" className="underline-offset-2 hover:underline">
          Terms
        </a>
        <a href="/privacy" className="underline-offset-2 hover:underline">
          Privacy
        </a>
        <a href="/support" className="underline-offset-2 hover:underline">
          Support
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="underline-offset-2 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </nav>
      <p className="mt-3 text-xs text-slate-600">18+ &middot; Play responsibly</p>
    </footer>
  );
}
