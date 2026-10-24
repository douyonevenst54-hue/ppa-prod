# Pi Sign-In — playing PPA outside Pi Browser

## What changed and why

Until now PPA had one door. The only way in was `window.Pi.authenticate()`
from the Pi SDK, which exists only inside Pi Browser. Everyone else got a page
they could look at and not use.

That is a ceiling on promotion, and it sits exactly where promotion happens: a
link posted on X, sent in a message, or opened on a laptop lands on a dead end.
Worse, it landed there slowly — see "the fifteen seconds" below.

Pi Sign-In removes the ceiling. It is Pi's own OAuth 2.0 server at
`accounts.pinet.com`, described in Pi's docs as being for a site that "runs in
an ordinary browser (desktop or mobile)". This is the supported path, not a
workaround.

It also stays inside the Mainnet listing requirement to **"Use Only Pi
Authentication"**. A Google or email login would break that rule. Pi Sign-In is
Pi authentication, so an open web version does not cost anything on the Mainnet
path. ([Mainnet listing requirements](https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/mainnetListingRequirements/))

## The one thing it cannot do

**The `payments` scope is not available to Pi Sign-In.** Only `username` and
`wallet_address` are.

So a web session can play the daily challenge, earn PPA, build reputation and
tier, hold a balance and appear on the leaderboard. It **cannot** buy PPA with
Pi.

This is treated as a boundary to show, not a gap to paper over:

- `usePiPayment.createPayment()` refuses a web session before anything visible
  happens.
- `TopUpPanel` does not render amount buttons for a web session. It explains
  where top-ups happen instead, and says the balance and streak are the same
  account.
- `getSessionOrigin()` is the single source of that answer, and it is tracked
  explicitly at sign-in rather than sniffed.

The shape this gives PPA is a reasonable one: the free game opens to everyone,
the paid door stays inside Pi.

## The fifteen seconds

Worth recording, because the cause was a comment that had been wrong for a
while.

`usePiAuth` waited up to 6 seconds for `window.Pi` to appear, "because the SDK
is only injected in Pi Browser". It isn't. `layout.tsx` loads
`sdk.minepi.com/pi-sdk.js` in **every** browser, so `window.Pi` appears on an
ordinary desktop too — the object is there, the native bridge behind it is not.

So the poll succeeded almost immediately, `authenticate()` was called against
nothing, and the real wait was the 15-second timeout underneath it. For that
whole time `PiBrowserBanner` held a full-screen "Connecting to Pi Network..."
in front of the app, and what it finally revealed was a banner telling the
visitor to use a different browser.

Three changes:

- The app renders immediately; auth resolves behind it. A 2px bar reports
  progress instead of a full-screen loader.
- The SDK timeout is 6 seconds, and `apiFetch`'s silent re-auth has a timeout
  at all — it previously had none, so a non-Pi browser could hang there
  indefinitely.
- `isPiBrowser()` no longer means "window.Pi exists". A session's origin is
  recorded when it is established, because an `authenticate()` call that
  returned is the only thing that proves the bridge is real.

## Setting it up

### 1. Get the client ID

Developer Portal → your app → **Pi Sign-In** → **oAuth Client ID**.

Each Developer Portal project has its own. The Mainnet project's client ID is
not the Testnet one.

### 2. Register the redirect URI

Same screen → **Redirect URIs** → Edit. Register:

```
https://<your verified domain>/auth/callback
```

**Production redirect URIs require a verified domain.** Until the domain is
verified in the portal, Pi accepts only loopback URIs — `http://localhost:3000`,
`127.0.0.1`, `[::1]`. That is what local development uses, so the flow is
testable before the domain is verified.

### 3. Set the environment variable

```
NEXT_PUBLIC_PI_CLIENT_ID=<the oAuth Client ID>
```

Leaving it **empty switches web sign-in off**, and the app behaves exactly as
it did before: Pi Browser only, and no sign-in offered to anyone who cannot
use it. A door that leads nowhere is worse than no door, so nothing is shown
unless this is set.

### 4. Try it locally

```bash
npm run dev
# open http://localhost:3000 in an ordinary browser — NOT Pi Browser
```

Expected: the app renders at once, a bar appears at the top offering **Sign
in**, and pressing it goes to Pi and comes back signed in. Check the profile
screen shows your real Pi username, and that the top-up screen explains itself
rather than offering amounts.

## How the flow works

1. `startWebSignIn()` generates a `state`, stores it and the return path in
   `sessionStorage`, and sends the browser to
   `accounts.pinet.com/oauth/authorize?response_type=token&...`.
2. Pi signs the Pioneer in and redirects to `/auth/callback` with the access
   token **in the URL fragment**. A fragment is never sent to a server, which
   is why the callback is a client screen.
3. `/auth/callback` reads the fragment, **strips it from the address bar
   before any network call**, checks the returned `state` against the stored
   one, and hands the token to `completeWebSignIn()`.
4. That POSTs to `/api/auth/pi` — the same route the SDK path uses. The server
   validates against `GET api.minepi.com/v2/me` exactly as before. **No server
   change was needed**, because Pi's docs prescribe the same validation for
   both token types.

### The security bits, and why they are there

- **State check.** A callback arriving with nothing stored is refused rather
  than trusted. That is precisely the shape of handing someone a link carrying
  an attacker's token, to sign the victim into an account the attacker
  controls.
- **Fragment stripped first.** An access token in `location.hash` ends up in
  session history and in anything that later reads the URL. It exists there
  for as close to zero time as possible.
- **`safeReturnTo()`.** The return path is passed through a same-site check, so
  a poisoned value cannot turn the callback into an open redirect for a
  phishing link. Protocol-relative `//evil.example` is the one that slips past
  a naive `startsWith("/")`, and it has a test.
- **No refresh token.** Implicit flow issues none, so a web session cannot be
  renewed silently. `apiFetch` does not try; it surfaces `NotSignedInError` and
  the UI offers the round trip.

### Where the web token lives, and the trade

Pi Browser tokens stay in memory: losing one on reload costs a single silent
re-auth, so there is no reason to write it down.

Web tokens are mirrored into `sessionStorage`, because there is no silent
re-auth to fall back on — held in memory alone, every reload would bounce the
player out to Pi and back, including a reload mid-quiz.

That is a real trade and worth naming. A token in `sessionStorage` is readable
by any script injected into the page, where a token in a closure is not.
Against that: it is scoped to one tab, dies with it, is not shared with other
tabs, expires on its own, and grants username-level identity rather than
payments — the scope Pi Sign-In cannot issue at all. The alternative is an app
that signs you out whenever you refresh, which mostly produces people who stay
signed out.

## Where the code is

| File | What it holds |
| --- | --- |
| `src/lib/pi-oauth.ts` | Pure: URL building, fragment parsing, state check, `safeReturnTo`. No window, no fetch, no storage. |
| `src/lib/web-signin.ts` | The side effects — storage and the redirect. |
| `src/app/auth/callback/page.tsx` | The return screen, and the order of operations that makes it safe. |
| `src/lib/pi-session.ts` | Session origin, token storage, `apiFetch`. |
| `src/hooks/usePiAuth.ts` | SDK first, redirect as fallback; `completeWebSignIn`. |
| `__tests__/pi-oauth.test.ts` | 32 tests on the pure parts. |
| `__tests__/pi-session-origin.test.ts` | 12 tests on the origin rules the payment gate depends on. |

Reference: [Pi Sign-In docs](https://github.com/pi-apps/pi-platform-docs/blob/master/pi-sign-in.md)
