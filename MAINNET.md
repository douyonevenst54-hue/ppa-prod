# Going to Mainnet without disturbing Testnet

## The constraint that shapes everything

The Developer Portal fixes the network when a project is registered: *"once
you've registered the app, this option cannot be changed."* PPA's current
project is Testnet — the Pi directory shows the **Testnet App** badge. So
Mainnet means a **second Developer Portal project**, not a setting change.

And a new project cannot claim a URL another project already holds: the verified
URL *"cannot match the URL that is verified of another Developer Portal
Project."* The Testnet project currently holds `pappad.app`. That single fact
decides the order of the whole migration.

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

## The order, and why

The URL constraint means Testnet has to let go of `pappad.app` before Mainnet
can take it. Doing this in the wrong order leaves you unable to verify the
domain you actually want.

1. **Give Testnet its own hostname.** Add `testnet.pappad.app` in Vercel and
   point the existing project at it. Keep `pappad.app` resolving for now.
2. **Re-verify Testnet on the new hostname** in its Developer Portal project
   (the validation key file moves with it). `pappad.app` is now free.
3. **Create the Mainnet Developer Portal project.** Select Mainnet at
   registration — this cannot be changed later.
4. **Verify `pappad.app`** on the Mainnet project.
5. **Generate the Mainnet API key.** Do not reuse the testnet one.
6. **New Neon database**, then `npx prisma migrate deploy`.
7. **New Vercel project** from the same repo, mainnet env, domain `pappad.app`.
8. **Seed content** (below), then run `scripts/preflight.ts` against it.

Step 2 is the risky one. Until it completes, `pappad.app` is verified by a
project you are about to repoint — do it when you can watch it, not the night
before the Summit.

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
