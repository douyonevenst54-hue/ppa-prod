# streak + admin/resolve

```bash
cd ~/ppa-prod
cp <extracted>/src/app/api/streak/route.ts        src/app/api/streak/route.ts
cp <extracted>/src/app/api/admin/resolve/route.ts src/app/api/admin/resolve/route.ts
npx tsc --noEmit
```

Add to Vercel env (optional — defaults to `douyonevenst54`):

```
PPA_ADMIN_USERNAMES=douyonevenst54
```

## Client changes

Both routes now require the Pi access token and ignore `userId`:

```ts
headers: { Authorization: `Bearer ${accessToken}` }
```

`GET /api/streak` no longer takes a `?userId=` — it returns the session user's
streak. Drop the query param wherever it's called.

`POST /api/admin/resolve` now returns `{ remaining, complete }`. The admin UI
should call again while `complete` is false — a large market settles in batches
of 200.

## The one that would have bitten you

`admin/resolve` paid `prediction.potentialReward`. That column is 0 on every row
written since stakes were removed, so **every winner has been marked correct and
paid nothing**. Predictions resolved between the stake removal and now are in
that state.

To find them:

```sql
SELECT c.id, c.title, count(*) AS winners
FROM "Prediction" p
JOIN "Content" c ON c.id = p."contentId"
WHERE p."isCorrect" = true AND p."ppaEarned" = 0
GROUP BY c.id, c.title;
```

If that returns rows and you want to pay them, reset those predictions to
pending and re-run resolve — the per-prediction idempotency key means anything
already paid stays paid:

```sql
UPDATE "Prediction" SET "isCorrect" = NULL
WHERE "isCorrect" = true AND "ppaEarned" = 0;
```

Then POST to `/api/admin/resolve` with the same `contentId` and `correctAnswer`.
The claim step recognises the market is already settled to that answer and
resumes rather than refusing.

## Verify

```bash
npx tsx scripts/verify-ledger.ts
```

Check in once and resolve one small market first — you should see chains grow
past the single snapshot row for the users involved.
