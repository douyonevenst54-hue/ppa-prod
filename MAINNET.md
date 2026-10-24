# Going to Mainnet without disturbing Testnet

## What is actually fixed, and what is not

The Developer Portal fixes the network when a project is registered: *"once
you've registered the app, this option cannot be changed."* PPA's current
project is Testnet — the Pi directory shows the **Testnet App** badge. So
Mainnet means a **second Developer Portal project**, not a setting change.
That part is unavoidable.

The URL is not a problem. App Info says **Hosting: Self Hosted**, URL
`https://ppa-prod.vercel.app`, Development URL `https://pappad.app`. PiNet is
also Active and App Studio publishes a third address,
`https://pappadappnpn9819.pinet.com`. None of these is a verified custom domain
in the Vercel sense, so nothing has to be released and there is no sequencing
trap. The only constraint on the domain is
Vercel's: `pappad.app` can live on one Vercel project at a time, so moving it
means removing it from the Testnet project and adding it to the Mainnet one —
a short gap in service, deliberately taken.

**One thing does follow the domain.** The Testnet Ecosystem Listing's
*Privacy Policy URL* and *Terms of Service URL* were changed from
`https://ppa-prod.vercel.app/{privacy,terms}` to `https://pappad.app/{privacy,terms}`
(both pending Pi review as of 2026-10-24). Those are links in the listing, not
a verified host — but once `pappad.app` points at the Mainnet deployment, the
**Testnet** listing's legal links will serve the **Mainnet** deployment's pages.

The text is identical, because both deployments build from this repo, so
nothing a player reads would be wrong. It is still untidy, and the fix is one
field: after the domain moves, set the Testnet listing's two legal URLs back to
`https://ppa-prod.vercel.app/...`, which keeps working. Each deployment then
links its own pages. Do this after the current review clears, not during it.

Sources: [Developer Portal docs](https://pi-apps.github.io/pi-sdk-docs/platform/DeveloperPortal),
[Community Developer Guide](https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/gettingStartedChecklist/).
Pi's process changes; your own Developer Portal checklist is authoritative.

## One repository, two deployments

Do **not** fork the repo.

Two copies of this codebase would diverge, and every fix would need applying
twice. This month alone that would have meant duplicating the admin auth fix
across three routes, the mixed-day rotation fix, the tier promotion, the Pi API
timeout handling. A fix applied once and missed once is worse than no fix,
because you believe you are covered.

The repo is already built for this. Everything that differs between networks is
an environment variable:

| Variable | Testnet | Mainnet |
| --- | --- | --- |
| `NEXT_PUBLIC_PI_NETWORK` | `testnet` | `mainnet` |
| `PI_API_KEY` | testnet project key | **mainnet project key** |
| `DATABASE_URL` | existing Neon database | **new Neon database** |
| `NEXT_PUBLIC_APP_URL` | `https://ppa-prod.vercel.app` | `https://pappad.app` |
| `CRON_SECRET` | its own | its own |
| `PPA_ADMIN_USERNAMES` | `douyonevenst54` | `douyonevenst54` |
| `PPA_ALLOW_PLAINTEXT_KEYS` | `false` | `false` |

A testnet API key in a mainnet app makes payments fail silently-ish — the guide
calls this out specifically.

So: one GitHub repo, two Vercel projects pointed at it, two Neon databases, two
Developer Portal projects, two hostnames.

## The order

1. **Create the Mainnet Developer Portal project.** Select Mainnet at
   registration — this cannot be changed later.
2. **Complete the hosting step**, which is what unlocks the App Wallet step.
3. **App wallet** (see the open question at the end).
4. **Generate the Mainnet API key.** Do not reuse the testnet one; the guide
   warns that payments fail if you do.
5. **New Neon database**, then `npx prisma migrate deploy`.
6. **New Vercel project** from the same repo with the mainnet environment.
   Deploy it on its temporary Vercel URL first and check it works.
7. **Verify `pappad.app`** on the Mainnet project once the app is answering
   there.
8. **Move the domain**: remove `pappad.app` from the Testnet Vercel project,
   add it to the Mainnet one. Short gap in service — do it deliberately.
9. **Seed content** (below), then run `scripts/preflight.ts` against it.

Nothing here is irreversible except step 1, where the network choice is
permanent for that project.

**Pi Sign-In needs no Redirect URI.** The portal shows an oAuth Client ID and
"No redirect URIs configured yet", which looks like an unfinished step and is
not one. That client ID is for the OAuth implicit flow, used when a site signs
a Pioneer in from *outside* Pi Browser. PPA does not use it: every session comes
from `window.Pi.authenticate()` in the Pi SDK (`src/hooks/usePiAuth.ts`,
`src/lib/pi-session.ts`), and the server validates the returned access token
against Pi with `PI_API_KEY` (`resolvePiUserId` in `src/lib/auth.ts`). No
`client_id` or `redirect_uri` appears anywhere in the codebase. Leave it empty
on both projects unless PPA is ever opened to browsers other than Pi's.

## The Mainnet database starts empty

Copy the content, not the balances.

Testnet PPA was bought with Test-Pi. The largest balance in the testnet database
is around 27,800 PPA, created by top-ups that cost nobody anything. Carrying
that into Mainnet would mean real Pioneers meeting a leaderboard whose top
entries were funded with play money, and a ledger whose genesis is "we imported
some numbers."

A fresh chain says something much simpler and is much easier to defend: every
PPA on Mainnet was earned or bought here, and the chain proves it from zero.

What to carry across, using tooling that already exists:

```bash
# questions — the 450-question pool, 150 per difficulty, 25 per cell
npx tsx --env-file=.env.mainnet scripts/import-questions.ts data/question-pool.json --apply
npx tsx --env-file=.env.mainnet scripts/import-questions.ts data/question-batch-002.csv --apply
npx tsx --env-file=.env.mainnet scripts/import-questions.ts data/question-batch-003.csv --apply

# the ecosystem directory
npx tsx --env-file=.env.mainnet scripts/listings.ts add --file data/my-apps.json --apply

# then confirm
npx tsx --env-file=.env.mainnet scripts/preflight.ts
```

What not to carry: users, balances, the ledger, challenge results, streaks,
tiers, emblems. All of it is testnet history and belongs to the testnet app.

## What this costs you

**The reviews do not transfer.** 4.7 from 15 reviews is attached to the Testnet
listing. The Mainnet listing starts at nothing. That is a real loss and there is
no way around it — worth knowing before you start, not after.

One mitigation: keep the Testnet app alive and listed rather than deleting it.
It remains a working demo, and the rating stays where it is.

## Two doors to Mainnet, and one of them costs 30%

PPA now exists on two Pi surfaces at once:

| | Developer Portal project | App Studio |
| --- | --- | --- |
| Hosting | Self Hosted (`ppa-prod.vercel.app`) | `pappadappnpn9819.pinet.com` |
| Wallet | Connected App Wallet `GCDP4…53AMP` | Testnet Wallet `GCHJUUW…ZC4GU` |
| Status | Ecosystem Listing **In Review** | **Published** |

The App Studio route was taken because the Developer Portal review did not move
for months, and it worked — the app is published and reachable today. That was
the right call for access.

It carries a price that only appears on Mainnet. App Studio's Revenue Dashboard
states it plainly:

> **Testnet Apps:** You receive 100% of revenue.
> **Mainnet Apps:** You receive 70% of the Pi generated from item sales. 30%
> goes to Pi Network to support the App Studio platform.

On Testnet this costs nothing, which is why it has not been felt. On Mainnet it
is a permanent 30% cut of **PPA's only revenue line** — Pi paid for PPA top-ups
at 1,000 PPA per 1 Pi. Nothing else in this app earns.

**This is not yet established, and should be before choosing a route.** Two
things are unverified: whether a Pi top-up through the Pi payment SDK counts as
an "item sale" under that policy, and whether the split attaches to the App
Studio project specifically or to the app however it is reached. The second
matters most — if a self-hosted Developer Portal Mainnet project is outside the
split, then the door PPA walks through on Mainnet day decides whether it keeps
100% or 70% of every top-up, forever.

Worth an explicit question to Pi developer support before the Mainnet project
is created, because the network choice at registration is permanent and this is
the most expensive decision on the list.

## A2U is not on the path to Mainnet

App-to-user payments — the app sending Pi to a Pioneer — are not required for a
Mainnet listing. Nothing in the Developer Portal checklist asks for them, and
PPA was deliberately stripped of them (`ff91e05`, "Remove dead A2U code").

A2U is the mechanism of redemption, and redemption is the single thing the
whole compliance position rests on not having. From `src/lib/ppa/policy.ts`:

> No cash-out means no "prize" in the gambling sense, which collapses the
> consideration + chance + prize analysis for staked predictions. No redeemable
> stored value materially weakens the argument that the app transmits monetary
> value under MGL c. 169B.

Those two sentences are load-bearing for: staked predictions being a game
rather than wagering, PPA not being transmitted monetary value under
Massachusetts money transmission law, and the Howey analysis staying
uninteresting. Every surface now agrees with them — `/terms`, the 410 on
`/api/ppa/redeem`, the staking disclosure, the directory description, the
footer on the daily challenge screen.

Building A2U would contradict all of it, two weeks before showing the app to
the Pi ecosystem. It moves away from Mainnet, not toward it.

**The one case that is not redemption** is a refund: returning someone's Pi
when a top-up fails or is disputed. That is undoing a payment rather than
cashing out a balance, and it is defensible. It is also narrow, rare, and
exactly the kind of thing to put in front of the Massachusetts attorney who is
already going to read `/terms` — not to build first and ask about afterwards.

If redemption itself ever becomes desirable, the order is: counsel, then
licensing analysis, then code. Not the reverse.

## The app wallet: mostly resolved

**The Testnet project already has one.** App Info → **Connected App Wallet:
`GCDP4…53AMP`**. It is not in the "Manage your app" list, which is why reading
that list and concluding the step did not exist was wrong — twice. The field
lives under App Info, together with Hosting (**Self Hosted**, not PiNet — PiNet
being Active is a separate publishing surface) and Development URL
(`https://pappad.app`).

So the step is not a mystery and not a blocker. What remains open is narrow: a
Mainnet project needs a Mainnet wallet, and whether the portal derives one or
you link your KYC'd one is answered by that screen when you reach it. Jhon
connected the current one during the App Studio move, so the mechanism is
already something he has done once.

The older uncertainty, kept because the docs still read this way:

- The community guide's "Developer Wallet" section says only *"This feature is
  coming soon and will be updated once it's available."*
- The platform docs say to *"Follow the instruction to create the app and
  connect it to your app"* without saying whether you create a new wallet or
  link an existing one.
- For legacy projects they say transactions go to *"the wallet address of the
  developer who creates the new project page"*, which must have been created in
  a Mainnet Migration — i.e. a KYC'd wallet.

A personal wallet that has passed KYC satisfies the underlying requirement.
Whether the app gets its own wallet derived in the portal, or simply uses the
developer's, is answered by the checklist once you reach that step. Do not plan
around a guess.

Note that PPA has no A2U payouts — redemption is permanently disabled — so the
app wallet only ever receives top-ups. Nothing flows out of it.
