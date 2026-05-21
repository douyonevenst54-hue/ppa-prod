# PPA — Force Re-auth Button

Adds a "Re-authorize with Pi" button so you can trigger a fresh Pi consent dialog from within the app — without needing to revoke access on Pi's side (which the Pi Browser UI hides).

| File | Replace at |
|---|---|
| `usePiAuth.ts` | `src/hooks/usePiAuth.ts` |
| `AuthProvider.tsx` | `src/components/AuthProvider.tsx` |
| `profile-page.tsx` | `src/app/profile/page.tsx` |
| `wallet-exchange-page.tsx` | `src/app/wallet/exchange/page.tsx` |

## What changed

### `usePiAuth.ts`
- **`signOut()`** — now aggressively clears all `pi_*` / `ppa_*` keys from localStorage and clears sessionStorage too (was only clearing one key).
- **New `forceReauth()`** — clears local session, then calls `window.Pi.authenticate(["username", "payments", "wallet_address"], ...)` directly. This is the cleanest way to force Pi to re-show its consent screen. If Pi caches the old grant and silently approves, at minimum our app state is reset and the user can retry; if Pi prompts, the user grants the new scope.

### `AuthProvider.tsx`
- Exposes `forceReauth` through the auth context so any component can call it.

### `src/app/profile/page.tsx`
- New "ACCOUNT" section at the bottom with two cards:
  - **🔐 Re-authorize Pi access** — primary button, explains why and triggers `forceReauth()`
  - **👋 Sign out** — secondary button, calls `signOut()` and returns to "Connecting to Pi Network..." (the next page load will re-auth)

### `src/app/wallet/exchange/page.tsx`
- After a failed redeem (status starts with ❌), an inline "💡 Try re-authorizing" card appears with a button right there. Saves a trip to Profile.

## Deploy

```bash
cd /c/Users/douyo/ppa-prod
# Drop in the 4 files at the paths above

npm run build
# Expected: ✓ Compiled successfully

git add src/hooks/usePiAuth.ts src/components/AuthProvider.tsx src/app/profile/page.tsx src/app/wallet/exchange/page.tsx
git status
git commit -m "feat(auth): add force-reauth button to trigger new Pi scope grant"
git push
```

Wait ~3 min for Vercel.

## Test sequence in Pi Browser

### Path A — From Profile (cleaner)

1. Open `ppa-prod.vercel.app` in Pi Browser
2. Tap **Profile** tab
3. Scroll to bottom, find **ACCOUNT** section
4. Tap **🔐 Re-authorize with Pi**
5. The Pi consent dialog should appear — **look for "Wallet Address" in the list of permissions**
6. Tap **Allow**
7. You should be returned to the app, signed in fresh
8. Navigate to **Wallet → Exchange → Redeem PPA → 5K → Redeem button**
9. ✅ Should now show "3.88π sent to your Pi wallet!"

### Path B — From the failure itself

1. Try the redeem first
2. When it fails with ❌ Pi payout failed
3. Tap the **🔐 Re-authorize with Pi** button that appears
4. Same flow as above

## If Pi STILL doesn't show the wallet_address prompt

Pi's consent caching is sometimes aggressive. Two fallbacks:

### Fallback 1: Reload the page hard
After tapping re-authorize, Pi may have silently approved with the existing grant. Try:
- Pi Browser → menu → **"Reload"** or pull-down to refresh
- Or close the tab entirely and reopen

### Fallback 2: Wait + try again
Pi sometimes invalidates cached grants after some idle time. Wait an hour and try the re-authorize button again.

### Fallback 3 (last resort): Different test user
If Pi just refuses to re-prompt for you specifically:
- Sign into PPA with a different Pi account (a friend's, or create a new test Pioneer account)
- That user will go through fresh auth and get the wallet_address scope from the start
- Their redeem will work, proving the underlying flow is correct
- For your account specifically, you'd need to find Pi's "revoke app" option (eventually they'll surface this in Pi Browser settings)

## What to look for after deploy

Run this curl to confirm the new button code is in the bundle:

```bash
for chunk in $(curl -s https://ppa-prod.vercel.app/profile -L | grep -oE '/_next/static/chunks/[^"]+\.js' | head -20); do
  if curl -s "https://ppa-prod.vercel.app$chunk" | grep -q "forceReauth"; then
    echo "FOUND in $chunk"
  fi
done
```

Should print at least one "FOUND" line.