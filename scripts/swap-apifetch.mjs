/**
 * Codemod: fetch() -> apiFetch() for routes that now require the Pi token.
 *
 *   node scripts/swap-apifetch.mjs          # report only, changes nothing
 *   node scripts/swap-apifetch.mjs --apply  # rewrite
 *
 * ── WHAT IT DOES AND DOESN'T DO ───────────────────────────────────────────
 *
 * Rewrites only calls whose URL is unambiguously an authenticated route, and
 * adds the import if it's missing. It deliberately does NOT touch:
 *
 *   - public reads (/api/leaderboard, /api/predictions/[id], /api/profile/...)
 *   - paths where the same URL is public for GET and authenticated for POST
 *     (/api/polls, /api/challenges, /api/predictions) — those depend on the
 *     method, which isn't reliably visible from the URL alone
 *   - anything that also needs its request body changed
 *
 * Those get listed under REVIEW at the end instead of being guessed at. A
 * codemod that quietly gets one of them wrong is worse than one that asks.
 *
 * Review the result with `git diff` before committing. It's a text transform,
 * not a parser.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Unambiguously authenticated — safe to rewrite on the URL alone. */
const AUTHED = [
  "/api/streak",
  "/api/challenges/submit",
  "/api/polls/vote",
  "/api/predictions/submit",
  "/api/ppa/topup/approve",
  "/api/ppa/topup/complete",
  "/api/payments/approve",
  "/api/payments/complete",
  "/api/payments/exchange",
  "/api/account/",
  "/api/emblem",
  "/api/wallet",
  "/api/me",
  "/api/creator/stats",
  "/api/admin/",
];

/** Public — leave alone. */
const PUBLIC = [
  "/api/leaderboard",
  "/api/profile/",
  "/api/user/",
  "/api/ecosystem/",
  "/api/auth/pi",
  "/api/emblem/", // public image + metadata; the bare /api/emblem above is the owner's
];

/** Same URL, different auth depending on method. Needs a human. */
const AMBIGUOUS = ["/api/polls", "/api/challenges", "/api/predictions"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Matches fetch("..."), fetch('...'), fetch(`...`)
const FETCH_CALL = /\bfetch\(\s*([`'"])([^`'"]*?)\1/g;

const rewritten = [];
const review = [];
const skipped = [];

for (const file of walk(SRC)) {
  // The helper itself, and anything server-side, stays on plain fetch.
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (rel.includes("lib/pi-session")) continue;
  if (rel.includes("/api/")) continue; // server routes call Pi's API, not ours

  const original = readFileSync(file, "utf8");
  let source = original;
  let changed = 0;

  source = source.replace(FETCH_CALL, (match, quote, url) => {
    if (!url.startsWith("/api/")) return match;

    if (PUBLIC.some((p) => url.startsWith(p) && url !== "/api/emblem")) {
      skipped.push(`${rel}  ${url}  (public)`);
      return match;
    }
    if (AMBIGUOUS.some((p) => url === p || url.startsWith(p + "?"))) {
      review.push(`${rel}  ${url}  (public for GET, authed for POST — check the method)`);
      return match;
    }
    if (!AUTHED.some((p) => url.startsWith(p))) {
      review.push(`${rel}  ${url}  (unrecognised — decide yourself)`);
      return match;
    }

    changed++;
    return `apiFetch(${quote}${url}${quote}`;
  });

  if (changed === 0) continue;

  // Add the import if it isn't already there.
  if (!/from ["']@\/lib\/pi-session["']/.test(source)) {
    const lastImport = source.lastIndexOf("\nimport ");
    const insertAt = lastImport === -1
      ? source.indexOf("\n") + 1
      : source.indexOf("\n", source.indexOf(";", lastImport)) + 1;
    source =
      source.slice(0, insertAt) +
      `import { apiFetch } from "@/lib/pi-session";\n` +
      source.slice(insertAt);
  }

  rewritten.push(`${rel}  (${changed} call${changed === 1 ? "" : "s"})`);
  if (APPLY) writeFileSync(file, source, "utf8");
}

const line = (s) => console.log("  " + s);

console.log(`\n${APPLY ? "REWRITTEN" : "WOULD REWRITE"} (${rewritten.length} files)\n`);
rewritten.forEach(line);

if (review.length) {
  console.log(`\nREVIEW BY HAND (${review.length})\n`);
  review.forEach(line);
}

if (skipped.length) {
  console.log(`\nLEFT PUBLIC (${skipped.length})\n`);
  skipped.forEach(line);
}

console.log(
  APPLY
    ? `\nDone. Check 'git diff' before committing, then 'npx tsc --noEmit'.`
    : `\nReport only. Re-run with --apply to write.`,
);

// Body changes the codemod can't make — these routes stopped reading userId
// from the request, so sending it is harmless but the GET query params are not.
console.log(`
ALSO BY HAND — these calls send data the routes no longer accept:

  components/StreakCard.tsx       GET /api/streak?userId=...  -> drop the param
  app/wallet/page.tsx             GET /api/wallet?userId=...  -> drop the param
  app/admin/page.tsx              GET ?userId=... on predictions/questions
  app/admin/page.tsx              POST /api/admin/resolve — drop userId from the body
  app/creator/page.tsx            GET /api/creator/stats?userId=...

The routes resolve the user from the token now. A stale ?userId= either gets
ignored or returns someone else's data, depending on the route — worth removing
rather than leaving to chance.
`);
