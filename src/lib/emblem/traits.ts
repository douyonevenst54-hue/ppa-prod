/**
 * Deterministic trait derivation.
 *
 * ── WHY DETERMINISTIC ─────────────────────────────────────────────────────
 *
 * Every visual property is derived from the user's id and their record. Nothing
 * is rolled at mint time, nothing is stored that can't be recomputed. Two
 * consequences worth keeping:
 *
 *   1. Regenerate from scratch any time — after a bug, a redesign, a migration
 *      — and every Emblem comes back identical. No image files to host, no
 *      "metadata pointing to offline servers", which is how a large share of
 *      2021-era collections quietly died.
 *   2. Nobody can reroll. The Emblem you get is a function of who you are and
 *      what you did. There is no pull, no reveal, no luck.
 *
 * ── THE VISUAL SYSTEM ─────────────────────────────────────────────────────
 *
 * Caribbean and Haitian visual traditions, used structurally rather than as
 * decoration. Haitian art is characterised by saturated colour against deep
 * ground, dense repeating pattern, and symbolic line work — vèvè, the drawn
 * ceremonial diagrams, are geometric, symmetrical and meaning-bearing, which
 * makes them the right formal reference for a sigil that encodes a record.
 *
 * The intent is a system with roots, not a costume. No flags, no clichés, no
 * borrowed sacred iconography used as decoration — the reference is to the
 * formal language (symmetry, density, palette), not to specific religious
 * symbols.
 */

import { Realm, RealmStanding } from "./realms";

/* ------------------------------------------------------------------ */
/* Seeded PRNG — xmur3 seed into sfc32. Small, fast, well-distributed. */
/* ------------------------------------------------------------------ */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function seededRandom(seed: string): () => number {
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

export interface Palette {
  name: string;
  ground: string;
  deep: string;
  primary: string;
  accent: string;
  glow: string;
}

/**
 * One palette per realm. Saturated figure against deep ground, which is the
 * dominant relationship in Haitian painting and also happens to sit naturally
 * against PPA's existing #0a0a0f background.
 */
export const REALM_PALETTES: Record<Realm, Palette> = {
  THINK: {
    name: "Indigo Night",
    ground: "#0b0b18",
    deep: "#1a1b3a",
    primary: "#6c63ff",
    accent: "#9d8cff",
    glow: "#c4bbff",
  },
  PREDICT: {
    name: "Sea Glass",
    ground: "#04140f",
    deep: "#0d2e26",
    primary: "#00c9a7",
    accent: "#4fe3c6",
    glow: "#a8f5e6",
  },
  CREATE: {
    name: "Mango Dusk",
    ground: "#160c04",
    deep: "#3a1f0b",
    primary: "#ff9f43",
    accent: "#ffc478",
    glow: "#ffe0b8",
  },
  COMPETE: {
    name: "Hibiscus",
    ground: "#170609",
    deep: "#3d0f1b",
    primary: "#ff6584",
    accent: "#ff93a8",
    glow: "#ffd0d9",
  },
  EXPLORE: {
    name: "Turquoise Coast",
    ground: "#03101a",
    deep: "#0a2c42",
    primary: "#3ba9dd",
    accent: "#76cdf0",
    glow: "#c2eaff",
  },
  CONNECT: {
    name: "Bougainvillea",
    ground: "#120618",
    deep: "#2e1140",
    primary: "#b06cff",
    accent: "#cf9dff",
    glow: "#e8d3ff",
  },
  LEAD: {
    name: "Gold Leaf",
    ground: "#15100a",
    deep: "#3a2c10",
    primary: "#ffd700",
    accent: "#ffe766",
    glow: "#fff6c2",
  },
};

/* ------------------------------------------------------------------ */
/* Traits                                                              */
/* ------------------------------------------------------------------ */

/** Lattice styles. Dense repeating geometry, symmetrical about the vertical. */
export const LATTICES = ["radial", "woven", "spiral", "tidal", "crystalline"] as const;
export type Lattice = (typeof LATTICES)[number];

/** Frame treatments, unlocked by overall level rather than chosen. */
export const FRAMES = ["none", "thin", "double", "toothed", "crowned"] as const;
export type Frame = (typeof FRAMES)[number];

export interface EmblemTraits {
  palette: Palette;
  paletteName: string;
  lattice: Lattice;
  /** 3-8. Rotational symmetry of the sigil. */
  fold: number;
  /** 0-1. How dense the background pattern is. */
  density: number;
  frame: Frame;
  /** Realms at level 3+ appear as orbiting marks around the sigil. */
  orbits: Realm[];
  /** Earned, not rolled. */
  pioneer: boolean;
  /** 0-35. */
  level: number;
  primary: Realm;
}

function frameFor(level: number): Frame {
  if (level >= 28) return "crowned";
  if (level >= 20) return "toothed";
  if (level >= 12) return "double";
  if (level >= 5) return "thin";
  return "none";
}

export function deriveTraits(args: {
  userId: string;
  primary: Realm;
  level: number;
  standings: RealmStanding[];
  pioneer: boolean;
}): EmblemTraits {
  // Seeded on the user only — so the look of an Emblem stays recognisably
  // *theirs* as it evolves. Level changes the frame and the orbits; it does
  // not reshuffle their identity.
  const rng = seededRandom(`ppa-emblem:${args.userId}`);

  const lattice = pick(rng, LATTICES);
  const fold = 3 + Math.floor(rng() * 6);
  const density = 0.35 + rng() * 0.4;

  const palette = REALM_PALETTES[args.primary];

  return {
    palette,
    paletteName: palette.name,
    lattice,
    fold,
    density,
    frame: frameFor(args.level),
    orbits: args.standings.filter((s) => s.level >= 3).map((s) => s.realm),
    pioneer: args.pioneer,
    level: args.level,
    primary: args.primary,
  };
}

/** NFT-standard attribute list. Used by the metadata endpoint. */
export function traitsToAttributes(
  traits: EmblemTraits,
  standings: RealmStanding[],
) {
  return [
    { trait_type: "Realm", value: traits.primary },
    { trait_type: "Palette", value: traits.paletteName },
    { trait_type: "Lattice", value: traits.lattice },
    { trait_type: "Fold", value: traits.fold },
    { trait_type: "Frame", value: traits.frame },
    { trait_type: "Pioneer", value: traits.pioneer ? "Yes" : "No" },
    { display_type: "number", trait_type: "Emblem Level", value: traits.level },
    ...standings.map((s) => ({
      display_type: "number" as const,
      trait_type: `${s.realm} Level`,
      value: s.level,
    })),
  ];
}
