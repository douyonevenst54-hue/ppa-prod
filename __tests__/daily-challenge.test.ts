import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  DIFFICULTIES,
  TIER_UNLOCKS,
  QUESTIONS_PER_CHALLENGE,
  categoryForDay,
  selectQuestionIds,
  pickFromCandidates,
  tierStatus,
  unlockedDifficulties,
  challengeTitle,
  utcDateKey,
} from "@/lib/ppa/daily-challenge";
import { challengeReputationDelta, CHALLENGE_REPUTATION } from "@/lib/ppa/rewards";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${String(i).padStart(3, "0")}`);
/** Candidates all served the same number of times, i.e. a fresh pool. */
const fresh = (n: number, timesServed = 0) =>
  ids(n).map((id) => ({ id, timesServed }));
const days = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  );

describe("categoryForDay", () => {
  it("is deterministic for the same day and difficulty", () => {
    for (const d of days(20)) {
      for (const diff of DIFFICULTIES) {
        expect(categoryForDay(d, diff)).toBe(categoryForDay(d, diff));
      }
    }
  });

  it("returns null for mixed days — the case that must be handled", () => {
    // This is the contract that was broken in production: the caller passed
    // this null straight into a Prisma `where`, which means IS NULL, matched
    // no rows, and silently skipped the challenge. Mixed days are the
    // MAJORITY, so a caller that ignores null breaks most days.
    const results = days(300).flatMap((d) => DIFFICULTIES.map((diff) => categoryForDay(d, diff)));
    const mixed = results.filter((r) => r === null).length;
    expect(mixed).toBeGreaterThan(results.length * 0.5);
  });

  it("themed days land on roughly a third, and always a real category", () => {
    const results = days(300).flatMap((d) => DIFFICULTIES.map((diff) => categoryForDay(d, diff)));
    const themed = results.filter((r) => r !== null);
    expect(themed.length / results.length).toBeGreaterThan(0.2);
    expect(themed.length / results.length).toBeLessThan(0.45);
    for (const c of themed) expect(CATEGORIES).toContain(c!);
  });

  it("does not give all three tiers the same subject every day", () => {
    const sameAcrossTiers = days(120).filter((d) => {
      const [a, b, c] = DIFFICULTIES.map((diff) => categoryForDay(d, diff));
      return a === b && b === c;
    });
    expect(sameAcrossTiers.length).toBeLessThan(120 * 0.6);
  });
});

describe("pickFromCandidates", () => {
  it("is deterministic for a seed", () => {
    const pool = fresh(40);
    expect(pickFromCandidates("seed-a", pool)).toEqual(pickFromCandidates("seed-a", pool));
  });

  it("gives different sets for different seeds", () => {
    const pool = fresh(40);
    const a = pickFromCandidates("seed-a", pool).join();
    const b = pickFromCandidates("seed-b", pool).join();
    expect(a).not.toBe(b);
  });

  it("returns exactly count ids, all from the pool, no repeats", () => {
    const pool = fresh(40);
    const picked = pickFromCandidates("s", pool);
    expect(picked).toHaveLength(QUESTIONS_PER_CHALLENGE);
    expect(new Set(picked).size).toBe(picked.length);
    for (const id of picked) expect(pool.map((c) => c.id)).toContain(id);
  });

  it("returns everything when the pool is no bigger than the set", () => {
    const pool = fresh(5);
    expect(pickFromCandidates("s", pool).sort()).toEqual(ids(5).sort());
    expect(pickFromCandidates("s", fresh(3))).toHaveLength(3);
  });

  it("never reaches past a question that is still owed a turn", () => {
    // Six questions never asked, the rest asked once. Every draw must come
    // from the six, whatever the seed — that is the property that keeps the
    // pool cycling instead of replaying favourites.
    const unserved = ids(6);
    const pool = [
      ...unserved.map((id) => ({ id, timesServed: 0 })),
      ...ids(54).slice(6).map((id) => ({ id, timesServed: 1 })),
    ];
    const owed = new Set(unserved);

    for (const seed of ["a", "b", "c", "d", "e", "f", "g"]) {
      const picked = pickFromCandidates(seed, pool);
      expect(picked).toHaveLength(QUESTIONS_PER_CHALLENGE);
      for (const id of picked) expect(owed.has(id)).toBe(true);
    }
  });

  it("spills into the next group only when a group runs short", () => {
    // Two unserved, five needed: it takes both, then fills from the once-asked.
    const pool = [
      { id: "fresh-a", timesServed: 0 },
      { id: "fresh-b", timesServed: 0 },
      ...ids(20).map((id) => ({ id, timesServed: 1 })),
    ];
    const picked = pickFromCandidates("s", pool);
    expect(picked).toHaveLength(QUESTIONS_PER_CHALLENGE);
    expect(picked).toContain("fresh-a");
    expect(picked).toContain("fresh-b");
  });

  it("selectQuestionIds is pickFromCandidates under a day/difficulty seed", () => {
    const pool = fresh(40);
    const date = "2026-03-04";
    expect(selectQuestionIds(date, "HARD", pool)).toEqual(
      pickFromCandidates(`ppa-pick:${date}:HARD`, pool),
    );
  });

  it("asks every question once before asking any of them twice", () => {
    // 36 live questions per difficulty on a mixed day (6 categories x 6), and
    // serving a question increments timesServed. Seven days at five a day is
    // 35 draws, so all 35 must be distinct.
    //
    // The first implementation scored 28 here: its 67% window let a question
    // return two days after being asked. That was the "same old questions"
    // bug, and this is the assertion that pins it.
    const served = new Map(ids(36).map((id) => [id, 0]));
    const seen = new Set<string>();

    for (const d of days(7)) {
      const candidates = [...served.entries()]
        .map(([id, timesServed]) => ({ id, timesServed }))
        .sort((a, b) => a.timesServed - b.timesServed || a.id.localeCompare(b.id));

      const picked = selectQuestionIds(d, "EASY", candidates);
      expect(picked).toHaveLength(QUESTIONS_PER_CHALLENGE);
      for (const id of picked) {
        seen.add(id);
        served.set(id, served.get(id)! + 1);
      }
    }

    expect(seen.size).toBe(35);
    // And nothing was asked twice while something was still waiting.
    expect(Math.max(...served.values())).toBe(1);
  });

  it("starts a second lap only once the first is finished", () => {
    const served = new Map(ids(10).map((id) => [id, 0]));
    for (const d of days(4)) {
      const candidates = [...served.entries()]
        .map(([id, timesServed]) => ({ id, timesServed }))
        .sort((a, b) => a.timesServed - b.timesServed || a.id.localeCompare(b.id));
      for (const id of selectQuestionIds(d, "EASY", candidates)) {
        served.set(id, served.get(id)! + 1);
      }
    }
    // 20 draws from 10 questions: everything asked exactly twice.
    expect([...served.values()].every((n) => n === 2)).toBe(true);
  });
});

describe("tierStatus / unlockedDifficulties", () => {
  it("opens EASY to everyone", () => {
    expect(TIER_UNLOCKS.EASY).toBe(0);
    expect(unlockedDifficulties(0)).toEqual(["EASY"]);
    expect(tierStatus(0).find((t) => t.difficulty === "EASY")!.unlocked).toBe(true);
  });

  it("unlocks at the threshold, not above it", () => {
    expect(unlockedDifficulties(TIER_UNLOCKS.MEDIUM)).toContain("MEDIUM");
    expect(unlockedDifficulties(TIER_UNLOCKS.MEDIUM - 0.1)).not.toContain("MEDIUM");
    expect(unlockedDifficulties(TIER_UNLOCKS.HARD)).toContain("HARD");
  });

  it("reports what is still needed, and zero once unlocked", () => {
    const at4 = tierStatus(4);
    expect(at4.find((t) => t.difficulty === "MEDIUM")!.remaining).toBe(
      TIER_UNLOCKS.MEDIUM - 4,
    );
    expect(at4.find((t) => t.difficulty === "EASY")!.remaining).toBe(0);
    for (const t of tierStatus(999)) expect(t.remaining).toBe(0);
  });

  it("never reports a negative requirement", () => {
    for (const rep of [0, 1, 9.9, 10, 29.9, 30, 1000]) {
      for (const t of tierStatus(rep)) expect(t.remaining).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("challengeReputationDelta", () => {
  it("pays per difficulty for correct answers only", () => {
    expect(
      challengeReputationDelta([
        { isCorrect: true, difficulty: "HARD" },
        { isCorrect: false, difficulty: "HARD" },
      ]),
    ).toBe(CHALLENGE_REPUTATION.HARD);
  });

  it("does not punish a wrong answer", () => {
    const allWrong = DIFFICULTIES.map((d) => ({ isCorrect: false, difficulty: d }));
    expect(challengeReputationDelta(allWrong)).toBe(0);
  });

  it("gives a perfect EASY run exactly 1.0", () => {
    const run = Array.from({ length: QUESTIONS_PER_CHALLENGE }, () => ({
      isCorrect: true,
      difficulty: "EASY",
    }));
    expect(challengeReputationDelta(run)).toBe(1);
  });

  it("keeps MEDIUM reachable in a sane number of days", () => {
    const perfectEasyDay = challengeReputationDelta(
      Array.from({ length: QUESTIONS_PER_CHALLENGE }, () => ({
        isCorrect: true,
        difficulty: "EASY",
      })),
    );
    const days = TIER_UNLOCKS.MEDIUM / perfectEasyDay;
    expect(days).toBeGreaterThan(3);
    expect(days).toBeLessThan(30);
  });

  it("does not accumulate float drift", () => {
    const run = Array.from({ length: 20 }, () => ({ isCorrect: true, difficulty: "EASY" }));
    expect(challengeReputationDelta(run)).toBe(4);
  });

  it("ignores an unknown difficulty rather than producing NaN", () => {
    expect(challengeReputationDelta([{ isCorrect: true, difficulty: "IMPOSSIBLE" }])).toBe(0);
  });
});

describe("challengeTitle / utcDateKey", () => {
  it("names a mixed day instead of rendering null", () => {
    expect(challengeTitle(null, "EASY")).toBe("Daily Mix");
    expect(challengeTitle(null, "HARD")).toContain("Daily Mix");
  });

  it("gives every category and difficulty a title", () => {
    for (const c of CATEGORIES) {
      for (const d of DIFFICULTIES) {
        const t = challengeTitle(c, d);
        expect(t).toBeTruthy();
        expect(t).not.toContain("undefined");
      }
    }
  });

  it("keys the day in UTC, not local time", () => {
    // 23:30 in New York on 14 Oct is already 15 Oct UTC. A local-time key
    // would hand two players different challenges on the same day.
    expect(utcDateKey(new Date("2026-10-15T03:30:00Z"))).toBe("2026-10-15");
    expect(utcDateKey(new Date("2026-10-14T23:59:59Z"))).toBe("2026-10-14");
  });
});
