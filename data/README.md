# The question pool

The pool is the ceiling on how long PPA can go without repeating itself.

At five questions per challenge per day, a difficulty tier draws from all six
categories on a mixed day and from one category on a themed day. So:

| live questions per difficulty | days before a repeat |
| --- | --- |
| 36 (6 per category) | 7 |
| 78 | 15 |
| 150 | 30 |
| 450 | 90 |

`scripts/import-questions.ts` with no arguments prints the current runway,
including which category/difficulty cell is thinnest — that cell is the one
that repeats first, because a themed day has nowhere else to draw from.

## Adding questions

```bash
npx tsx --env-file=.env scripts/import-questions.ts --template
# author in Excel or Sheets, save as CSV
npx tsx --env-file=.env scripts/import-questions.ts data/my-batch.csv
npx tsx --env-file=.env scripts/import-questions.ts data/my-batch.csv --apply
```

The dry run reports everything and writes nothing. Structural faults abort the
whole batch — a half-imported file is worse than none, because you cannot tell
by looking which half arrived. Questions already in the pool are skipped rather
than treated as faults, so re-importing a file you have added rows to works.

Columns, in any order: `text`, `answer_key`, `options`, `category`,
`difficulty`. `options` is pipe-separated. `option_a`…`option_d` also work.

Categories: `GENERAL`, `TECH`, `FINANCE`, `SOCIAL`, `SPORTS`, `POLITICS`.
Difficulties: `EASY`, `MEDIUM`, `HARD`.

## Anything you have not read yourself

```bash
npx tsx --env-file=.env scripts/import-questions.ts data/batch.csv --apply --review
```

`--review` lands questions at `qualityScore -2`, which keeps them out of
rotation entirely until a person approves them:

```bash
npx tsx --env-file=.env scripts/review-pool.ts --export
# fill the verdict column: ok / bad / fix
npx tsx --env-file=.env scripts/review-pool.ts --apply question-review.csv
```

Use it for anything generated or copied from a source you have not checked line
by line. A wrong answer key is the one defect nothing downstream catches: the
question looks right in the admin list and marks every player wrong, taking
reputation off people who answered correctly. `npm test` checks that every
answer key is one of its options and that nothing is duplicated — it cannot
check whether an answer is *true*.

## Quality scores

| score | meaning | served? |
| --- | --- | --- |
| `100` | hand-checked | yes |
| `0`–`99` | generated or unrated | yes |
| `-1` | rejected: duplicate, broken, or failed review | no |
| `-2` | awaiting human review | no |

Rotation serves `>= 0`. Nothing is ever deleted: `ChallengeResult` rows
reference `questionId`, and a player's record of what they answered is the
thing the emission gate exists to keep honest.

## Files here

- `question-pool.json` — the original 108, nested by category and difficulty
- `question-batch-002.csv` — 126 more, 7 per cell, stable facts only
- `question-template.csv` — written by `--template`, safe to delete

Both shipped files are validated by `__tests__/question-data.test.ts`.

## Writing good questions

Facts that go stale are the trap. Avoid current officeholders, prices, "the
largest/fastest X", and records — a question that was right when written and is
wrong a year later is indistinguishable from a wrong answer key. Prefer
definitions, rules, geography, civics structure, arithmetic and settled history.

Four options, one clearly correct, distractors plausible enough to be worth
reading. `SOCIAL` leans toward community and public health, which is where
locally useful material fits.
