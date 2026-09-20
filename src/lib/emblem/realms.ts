/**
 * The Seven Realms.
 *
 * An Emblem is a record of what someone has actually done in PPA. Every input
 * below is a counter that already exists and is already written by a gated,
 * ledgered path — so an Emblem cannot be bought, faked, or granted. It can only
 * be earned, and the chain can prove it.
 *
 * That constraint is the whole design. The data above says the only NFT-shaped
 * things that held value were the ones with real brand equity and real utility;
 * everything purely speculative went to zero. An Emblem that is provably earned
 * is the version of this idea with something underneath it.
 *
 * ── PIONEER IS NOT A REALM ────────────────────────────────────────────────
 *
 * The original sketch had eight characters but seven realms. Pioneer doesn't
 * belong with the others: the rest are things you do, Pioneer is when you
 * arrived. It's a trait (see traits.ts), not a realm — you can't level it up
 * and you can't lose it.
 */

export const REALMS = [
  "THINK",
  "PREDICT",
  "CREATE",
  "COMPETE",
  "EXPLORE",
  "CONNECT",
  "LEAD",
] as const;

export type Realm = (typeof REALMS)[number];

export interface RealmDef {
  key: Realm;
  name: string;
  /** What the player is being recognised for, in their words not ours. */
  blurb: string;
  /** Level thresholds, 1-5. Index 0 is the score needed for level 1. */
  thresholds: [number, number, number, number, number];
}

export const REALM_DEFS: Record<Realm, RealmDef> = {
  THINK: {
    key: "THINK",
    name: "The Thinker",
    blurb: "Knowledge challenges answered correctly",
    thresholds: [10, 50, 150, 400, 1000],
  },
  PREDICT: {
    key: "PREDICT",
    name: "The Predictor",
    blurb: "Calls made, and made well",
    thresholds: [5, 25, 75, 200, 500],
  },
  CREATE: {
    key: "CREATE",
    name: "The Creator",
    blurb: "Polls, predictions and challenges published",
    thresholds: [1, 5, 15, 40, 100],
  },
  COMPETE: {
    key: "COMPETE",
    name: "The Challenger",
    blurb: "Volume and consistency under the clock",
    thresholds: [25, 100, 300, 750, 2000],
  },
  EXPLORE: {
    key: "EXPLORE",
    name: "The Explorer",
    blurb: "Breadth across categories and apps",
    thresholds: [2, 4, 6, 8, 10],
  },
  CONNECT: {
    key: "CONNECT",
    name: "The Connector",
    blurb: "Votes cast and community joined",
    thresholds: [5, 25, 75, 200, 500],
  },
  LEAD: {
    key: "LEAD",
    name: "The Champion",
    blurb: "Standing, streaks and tier",
    // Much higher than the count-based realms on purpose: LEAD is a composite
    // (tier + best streak + reputation), so its raw score runs an order of
    // magnitude larger. With the old thresholds every established player came
    // out as The Champion and the other six realms never surfaced.
    thresholds: [60, 140, 240, 380, 600],
  },
};

/** Raw inputs, all from columns that already exist. */
export interface RealmInputs {
  correctChallenges: number;
  totalChallenges: number;
  correctPredictions: number;
  totalPredictions: number;
  accuracyRate: number;
  reputationScore: number;
  contentCreated: number;
  pollVotes: number;
  /** Distinct Content.category the user has engaged with. */
  categoriesTouched: number;
  /** Distinct ecosystem apps the user has transacted with. */
  appsTouched: number;
  streakDays: number;
  longestStreak: number;
  tier: string;
}

const TIER_RANK: Record<string, number> = {
  NEWCOMER: 0,
  MEMBER: 1,
  TRUSTED: 2,
  EXPERT: 3,
  ELITE: 4,
};

/**
 * Score each realm from the user's record.
 *
 * Scores are deliberately monotonic — they can rise and stall, never fall.
 * An Emblem that could regress would punish someone for taking a month off,
 * and the point is to record a history, not to police attendance.
 */
export function scoreRealms(input: RealmInputs): Record<Realm, number> {
  // PREDICT rewards being right, not just showing up: correct calls carry
  // most of it, with reputation (which is confidence-weighted) on top.
  const predict =
    input.correctPredictions * 1.0 + Math.max(0, input.reputationScore) * 0.5;

  // LEAD is standing rather than activity — tier, best streak, reputation.
  const lead =
    (TIER_RANK[input.tier] ?? 0) * 25 +
    input.longestStreak * 2 +
    Math.max(0, input.reputationScore);

  return {
    THINK: input.correctChallenges,
    PREDICT: Math.round(predict),
    CREATE: input.contentCreated,
    COMPETE: input.totalChallenges,
    EXPLORE: input.categoriesTouched + input.appsTouched,
    CONNECT: input.pollVotes,
    LEAD: Math.round(lead),
  };
}

/** 0 = not yet started, 1-5 = attained. */
export function levelFor(realm: Realm, score: number): number {
  const t = REALM_DEFS[realm].thresholds;
  let level = 0;
  for (let i = 0; i < t.length; i++) {
    if (score >= t[i]) level = i + 1;
  }
  return level;
}

/** Points to the next threshold, or null at level 5. */
export function nextThreshold(realm: Realm, score: number): number | null {
  const t = REALM_DEFS[realm].thresholds;
  const next = t.find((v) => v > score);
  return next ?? null;
}

export interface RealmStanding {
  realm: Realm;
  score: number;
  level: number;
  next: number | null;
}

export function standings(input: RealmInputs): RealmStanding[] {
  const scores = scoreRealms(input);
  return REALMS.map((realm) => ({
    realm,
    score: scores[realm],
    level: levelFor(realm, scores[realm]),
    next: nextThreshold(realm, scores[realm]),
  }));
}

/**
 * The realm the Emblem presents as.
 *
 * LEAD is excluded unless it is the ONLY realm at its level. Standing is a
 * consequence of the other six rather than a thing you do, so letting it win
 * ties made almost every developed Emblem read as The Champion — which tells a
 * viewer nothing about how that person actually plays.
 *
 * Highest level wins; ties break on how far past the threshold the score sits,
 * so a player deep into level 3 THINK outranks one who just crossed into
 * level 3 CONNECT. Ties beyond that fall back to REALMS order, which keeps the
 * result deterministic — the same record always renders the same Emblem.
 */
export function primaryRealm(input: RealmInputs): Realm {
  const all = standings(input);
  const contenders = all.filter((s) => s.realm !== "LEAD");
  const topNonLead = Math.max(...contenders.map((s) => s.level));
  const lead = all.find((s) => s.realm === "LEAD")!;

  // LEAD only presents when it clearly outranks everything else.
  const list = lead.level > topNonLead ? all : contenders;

  let best = list[0];
  let bestDepth = -1;

  for (const s of list) {
    const t = REALM_DEFS[s.realm].thresholds;
    const floor = s.level > 0 ? t[s.level - 1] : 0;
    const ceil = s.level < 5 ? t[s.level] : t[4] * 2;
    const depth = ceil > floor ? (s.score - floor) / (ceil - floor) : 1;

    if (s.level > best.level || (s.level === best.level && depth > bestDepth)) {
      best = s;
      bestDepth = depth;
    }
  }

  return best.realm;
}

/** Overall Emblem level: the sum of realm levels, 0-35. */
export function emblemLevel(input: RealmInputs): number {
  return standings(input).reduce((sum, s) => sum + s.level, 0);
}
