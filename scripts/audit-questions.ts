/**
 * Audit the question pool for structural problems.
 *
 *   npx tsx --env-file=.env.local scripts/audit-questions.ts
 *   npx tsx --env-file=.env.local scripts/audit-questions.ts --quarantine
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The seeder validates what IT writes. It does not validate what was already
 * in the table — and the pool now holds questions from two sources: 103 that
 * were hand-checked, and ~111 that an AI generator produced before it was
 * removed.
 *
 * A generated question with a wrong "correct" answer is invisible from the
 * outside. It looks exactly like a good one. A player answers correctly, is
 * marked wrong, and loses reputation they earned — and nobody finds out,
 * because there is no complaint path for "the quiz was wrong".
 *
 * This checks every question in the table for the failures that are detectable
 * mechanically, and flags the generated ones so you can read them yourself.
 * It cannot tell you whether an answer is factually right. Only a person can.
 *
 * `--quarantine` sets qualityScore to -1 on anything structurally broken, which
 * excludes it from rotation without deleting it. Nothing is ever deleted here.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const QUARANTINE = process.argv.includes("--quarantine");

/** Hand-seeded questions carry this. Anything else predates the pool. */
const HAND_CHECKED = 100;

interface Problem {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  reason: string;
}

function optionsOf(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map((o) => String(o));
  return null;
}

async function main() {
  // Only questions that can actually reach a player. Reading the whole table
  // made every quarantined row show up as a duplicate of the copy that
  // replaced it, so the audit reported eight problems that were in fact eight
  // fixes. An audit has to describe what players see, not what the table
  // remembers.
  const benched = await prisma.question.count({
    where: { qualityScore: { lt: 0 } },
  });

  const all = await prisma.question.findMany({
    where: { qualityScore: { gte: 0 } },
    select: {
      id: true,
      text: true,
      options: true,
      correctAnswer: true,
      category: true,
      difficulty: true,
      qualityScore: true,
      timesServed: true,
      timesAnswered: true,
      timesCorrect: true,
    },
  });

  const broken: Problem[] = [];
  const suspicious: Problem[] = [];

  const byText = new Map<string, string[]>();

  for (const q of all) {
    const opts = optionsOf(q.options);
    const base = {
      id: q.id,
      text: q.text,
      category: q.category,
      difficulty: q.difficulty,
    };

    // --- structural: these make a question unanswerable ---------------
    if (!opts) {
      broken.push({ ...base, reason: "options is not an array" });
      continue;
    }
    if (opts.length < 2) {
      broken.push({ ...base, reason: `only ${opts.length} option(s)` });
      continue;
    }
    if (!opts.includes(q.correctAnswer)) {
      broken.push({ ...base, reason: "correctAnswer is not among the options" });
      continue;
    }
    if (new Set(opts).size !== opts.length) {
      broken.push({ ...base, reason: "duplicate options" });
      continue;
    }
    if (opts.some((o) => o.trim() === "")) {
      broken.push({ ...base, reason: "blank option" });
      continue;
    }
    if (q.text.trim() === "") {
      broken.push({ ...base, reason: "blank question text" });
      continue;
    }

    // --- suspicious: playable, but worth a human read -----------------
    if (q.qualityScore !== HAND_CHECKED) {
      // Generated. Served questions with a very low success rate are the most
      // likely to have a wrong answer key — players keep "failing" a question
      // they actually got right.
      // Against timesAnswered, not timesServed. timesServed counts the days a
      // question appeared in a challenge; a question served on ten days that
      // nobody played would otherwise read as 0% correct and be flagged as a
      // broken answer key.
      const rate = q.timesAnswered > 0 ? q.timesCorrect / q.timesAnswered : null;
      if (q.timesAnswered >= 5 && rate !== null && rate < 0.15) {
        suspicious.push({
          ...base,
          reason: `only ${Math.round(rate * 100)}% correct over ${q.timesAnswered} answers — answer key may be wrong`,
        });
      }
    }

    const dupes = byText.get(q.text) ?? [];
    dupes.push(q.id);
    byText.set(q.text, dupes);
  }

  for (const [text, ids] of byText) {
    if (ids.length > 1) {
      suspicious.push({
        id: ids.join(", "),
        text,
        category: "-",
        difficulty: "-",
        reason: `${ids.length} copies of the same question`,
      });
    }
  }

  const generated = all.filter((q) => q.qualityScore !== HAND_CHECKED).length;
  const handChecked = all.length - generated;

  console.log(`\nQUESTION POOL AUDIT`);
  console.log("─".repeat(70));
  console.log(`  ${all.length} in rotation · ${handChecked} hand-checked · ${generated} generated`);
  console.log(`  ${benched} benched (quarantined or awaiting review, never served)\n`);

  if (broken.length === 0) {
    console.log("  No structural problems.\n");
  } else {
    console.log(`  ${broken.length} BROKEN (unanswerable):\n`);
    for (const p of broken) {
      console.log(`    ${p.category}/${p.difficulty}  ${p.reason}`);
      console.log(`      ${p.text.slice(0, 70)}`);
    }
    console.log("");
  }

  if (suspicious.length > 0) {
    console.log(`  ${suspicious.length} worth reading yourself:\n`);
    for (const p of suspicious) {
      console.log(`    ${p.reason}`);
      console.log(`      ${p.text.slice(0, 70)}`);
    }
    console.log("");
  }

  if (QUARANTINE && broken.length > 0) {
    const ids = broken.map((b) => b.id);
    const { count } = await prisma.question.updateMany({
      where: { id: { in: ids } },
      data: { qualityScore: -1 },
    });
    console.log(`  Quarantined ${count} question(s) — qualityScore set to -1.`);
    console.log(`  They stay in the table but are excluded from rotation.\n`);
  } else if (broken.length > 0) {
    console.log(`  Re-run with --quarantine to exclude them from rotation.\n`);
  }

  console.log(`  What this CANNOT check: whether an answer is factually right.`);
  console.log(`  ${generated} generated questions need a human read before you`);
  console.log(`  trust them to score a player's reputation.\n`);

  process.exit(broken.length > 0 && !QUARANTINE ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
