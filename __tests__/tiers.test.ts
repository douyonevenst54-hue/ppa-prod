import { describe, it, expect } from "vitest";
import {
  TIER_ORDER,
  TIER_RULES,
  tierFor,
  nextTier,
  rankOf,
  challengeAccuracy,
  tierProgress,
} from "@/lib/ppa/tiers";

describe("tierFor", () => {
  it("starts everyone at Newcomer", () => {
    expect(tierFor(0, 0)).toBe("NEWCOMER");
    expect(tierFor(5, 10)).toBe("NEWCOMER");
  });

  it("gives Member for volume alone", () => {
    expect(tierFor(10, 25)).toBe("MEMBER");
    expect(tierFor(0, 25)).toBe("MEMBER");
  });

  it("will not promote past Member on volume alone", () => {
    // 1,000 questions answered at 30% is not expertise, and the top
    // multiplier must not go to whoever tapped through the most questions.
    expect(tierFor(300, 1000)).toBe("MEMBER");
  });

  it("requires the accuracy floor at every tier above Member", () => {
    expect(tierFor(59, 100)).toBe("MEMBER"); // 59% — just under 60
    expect(tierFor(60, 100)).toBe("TRUSTED");
    expect(tierFor(209, 300)).toBe("TRUSTED"); // 69.7%
    expect(tierFor(210, 300)).toBe("EXPERT");
    expect(tierFor(599, 750)).toBe("EXPERT"); // 79.9%
    expect(tierFor(600, 750)).toBe("ELITE");
  });

  it("places the real player from the screenshot in Trusted", () => {
    // 95 of 110 is 86%: past the 100-question bar, short of 300.
    expect(tierFor(95, 110)).toBe("TRUSTED");
  });

  it("never returns a tier outside the ladder", () => {
    for (const [c, a] of [[0, 0], [1, 1], [50, 50], [999, 1000], [0, 999]]) {
      expect(TIER_ORDER).toContain(tierFor(c, a));
    }
  });

  it("does not divide by zero", () => {
    expect(challengeAccuracy(0, 0)).toBe(0);
    expect(tierFor(0, 0)).toBe("NEWCOMER");
  });
});

describe("nextTier", () => {
  it("promotes when the numbers earn it", () => {
    expect(nextTier("NEWCOMER", 95, 110)).toBe("TRUSTED");
  });

  it("never demotes", () => {
    // Reached Expert, then accuracy slipped. The bar was genuinely met at the
    // time, and cutting someone's earning rate for answering more questions
    // is the opposite of what the tier is for.
    expect(nextTier("EXPERT", 60, 400)).toBe("EXPERT");
    expect(nextTier("ELITE", 0, 1)).toBe("ELITE");
  });

  it("leaves a tier alone when nothing changed", () => {
    expect(nextTier("TRUSTED", 95, 110)).toBe("TRUSTED");
  });

  it("moves more than one step at once when earned", () => {
    // A backfill over an account that played a long time before tiers existed
    // must land on the right rung, not merely the next one up.
    expect(nextTier("NEWCOMER", 700, 800)).toBe("ELITE");
  });
});

describe("rankOf", () => {
  it("orders the ladder", () => {
    expect(rankOf("NEWCOMER")).toBeLessThan(rankOf("MEMBER"));
    expect(rankOf("MEMBER")).toBeLessThan(rankOf("TRUSTED"));
    expect(rankOf("TRUSTED")).toBeLessThan(rankOf("EXPERT"));
    expect(rankOf("EXPERT")).toBeLessThan(rankOf("ELITE"));
  });

  it("treats an unknown tier as the bottom rather than throwing", () => {
    expect(rankOf("SOMETHING_ELSE")).toBe(0);
  });
});

describe("tierProgress", () => {
  it("counts the questions still needed", () => {
    const p = tierProgress("NEWCOMER", 5, 10);
    expect(p).not.toBeNull();
    expect(p!.next).toBe("MEMBER");
    expect(p!.answeredToGo).toBe(15);
  });

  it("stops counting at zero and names the accuracy bar instead", () => {
    // Enough questions answered, accuracy short: more questions won't help.
    const p = tierProgress("MEMBER", 50, 120);
    expect(p!.next).toBe("TRUSTED");
    expect(p!.answeredToGo).toBe(0);
    expect(p!.accuracyNeeded).toBe(0.6);
  });

  it("returns null at the top of the ladder", () => {
    expect(tierProgress("ELITE", 900, 1000)).toBeNull();
  });
});

describe("the rules themselves", () => {
  it("lists every tier exactly once, highest first", () => {
    expect(TIER_RULES.map((r) => r.tier)).toEqual([...TIER_ORDER].reverse());
  });

  it("raises both bars monotonically as the ladder goes up", () => {
    const ascending = [...TIER_RULES].reverse();
    for (let i = 1; i < ascending.length; i++) {
      expect(ascending[i].answered).toBeGreaterThanOrEqual(ascending[i - 1].answered);
      expect(ascending[i].accuracy).toBeGreaterThanOrEqual(ascending[i - 1].accuracy);
    }
  });

  it("keeps every accuracy floor a real proportion", () => {
    for (const r of TIER_RULES) {
      expect(r.accuracy).toBeGreaterThanOrEqual(0);
      expect(r.accuracy).toBeLessThanOrEqual(1);
    }
  });
});
