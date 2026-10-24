# Going to Mainnet without disturbing Testnet

## What is actually fixed, and what is not

The Developer Portal fixes the network when a project is registered: *"once
you've registered the app, this option cannot be changed."* PPA's current
project is Testnet — the Pi directory shows the **Testnet App** badge. So
Mainnet means a **second Developer Portal project**, not a setting change.
That part is unavoidable.

The URL is not a problem. Pi assigns the Testnet project its own hostname, so
`pappad.app` is not verified by it and nothing has to be released. The only
constraint on the domain is Vercel's: `pappad.app` is currently attached to the
Testnet Vercel project, and a domain can only live on one project at a time. So
moving it means removing it there and adding it to the Mainnet project, which
is a short gap in service rather than a sequencing trap.

Confirm which URL the Testnet project actually has verified before relying on
this — it is one line in the portal, and the whole plan below assumes it is not
`pappad.app`.

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
| `NEXT_PUBLIC_APP_URL` | `https://testnet.pappad.app` | `https://pappad.app` |
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
# questions — the 234-question pool, verified and hand-checked
npx tsx --env-file=.env.mainnet scripts/import-questions.ts data/question-pool.json --apply
npx tsx --env-file=.env.mainnet scripts/import-questions.ts data/question-batch-002.csv --apply

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

## The app wallet: unresolved

The step exists in the Developer Portal checklist and unlocks **after** hosting
is configured. Beyond that the public docs do not explain it:

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
