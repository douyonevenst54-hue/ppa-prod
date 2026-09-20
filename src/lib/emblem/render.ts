/**
 * Emblem SVG renderer.
 *
 * Pure function: traits in, SVG string out. No canvas, no image files, no
 * external assets, no IPFS. The image IS the code plus the record, which means
 * an Emblem can never break the way a collection with off-server metadata does.
 *
 * Structure, outermost first:
 *   ground      deep flat field
 *   lattice     dense repeating geometry, the Caribbean textile reference
 *   halo        soft radial light behind the sigil
 *   sigil       n-fold symmetric mark, the core identity
 *   orbits      one node per realm at level 3+
 *   frame       border treatment, earned by overall level
 *   pioneer     a single mark, only for early accounts
 */

import { EmblemTraits } from "./traits";
import { Realm, RealmStanding, REALM_DEFS } from "./realms";
import { seededRandom } from "./traits";

const SIZE = 512;
const C = SIZE / 2;

const REALM_GLYPH: Record<Realm, string> = {
  THINK: "M0,-34 L10,-10 L34,0 L10,10 L0,34 L-10,10 L-34,0 L-10,-10 Z",
  PREDICT: "M0,-34 L30,17 L-30,17 Z",
  CREATE: "M0,-32 C18,-32 32,-18 32,0 C32,18 18,32 0,32 C-18,32 -32,18 -32,0 C-32,-18 -18,-32 0,-32 Z",
  COMPETE: "M-28,-28 L28,-28 L0,8 Z M0,14 L20,34 L-20,34 Z",
  EXPLORE: "M0,-34 L8,-8 L34,0 L8,8 L0,34 L-8,8 L-34,0 L-8,-8 Z",
  CONNECT: "M-24,-14 A14,14 0 1,1 -24,14 A14,14 0 1,1 -24,-14 M24,-14 A14,14 0 1,1 24,14 A14,14 0 1,1 24,-14",
  LEAD: "M0,-36 L11,-11 L36,-11 L16,6 L23,32 L0,17 L-23,32 L-16,6 L-36,-11 L-11,-11 Z",
};

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );
}

/* ---------------------------------------------------------------- */
/* Lattice — the dense repeating field                               */
/* ---------------------------------------------------------------- */

function lattice(traits: EmblemTraits): string {
  const { palette, density, fold } = traits;
  const rng = seededRandom(`lattice:${traits.primary}:${traits.lattice}:${fold}`);
  const op = (0.20 + density * 0.22).toFixed(3);
  const parts: string[] = [];

  switch (traits.lattice) {
    case "radial": {
      const rays = fold * 6;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        parts.push(
          `<line x1="${C}" y1="${C}" x2="${(C + Math.cos(a) * 400).toFixed(1)}" y2="${(C + Math.sin(a) * 400).toFixed(1)}" stroke="${palette.primary}" stroke-width="1.2"/>`,
        );
      }
      for (let r = 40; r < 300; r += 26) {
        parts.push(`<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${palette.accent}" stroke-width="0.7"/>`);
      }
      break;
    }
    case "woven": {
      // Alternating weight is what makes this read as woven cloth rather than
      // as a flat crosshatch texture.
      const step = Math.round(16 + (1 - density) * 14);
      let k = 0;
      for (let i = -SIZE; i < SIZE * 2; i += step) {
        const heavy = k % 3 === 0;
        parts.push(`<line x1="${i}" y1="0" x2="${i + SIZE}" y2="${SIZE}" stroke="${palette.primary}" stroke-width="${heavy ? 3.2 : 1}"/>`);
        parts.push(`<line x1="${i}" y1="${SIZE}" x2="${i + SIZE}" y2="0" stroke="${palette.accent}" stroke-width="${heavy ? 2.2 : 0.8}"/>`);
        k++;
      }
      break;
    }
    case "spiral": {
      for (let arm = 0; arm < fold; arm++) {
        const pts: string[] = [];
        const off = (arm / fold) * Math.PI * 2;
        for (let t = 0; t < 140; t++) {
          const a = off + t * 0.09;
          const r = t * 2.6;
          pts.push(`${(C + Math.cos(a) * r).toFixed(1)},${(C + Math.sin(a) * r).toFixed(1)}`);
        }
        parts.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${palette.primary}" stroke-width="1.1"/>`);
      }
      break;
    }
    case "tidal": {
      const rows = Math.round(10 + density * 14);
      for (let r = 0; r < rows; r++) {
        const y = (r / rows) * SIZE;
        const amp = 8 + rng() * 14;
        const pts: string[] = [];
        for (let x = 0; x <= SIZE; x += 16) {
          pts.push(`${x},${(y + Math.sin((x / SIZE) * Math.PI * fold) * amp).toFixed(1)}`);
        }
        parts.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${r % 2 ? palette.accent : palette.primary}" stroke-width="0.9"/>`);
      }
      break;
    }
    case "crystalline": {
      const step = Math.round(30 + (1 - density) * 24);
      for (let y = -step; y < SIZE + step; y += step) {
        for (let x = -step; x < SIZE + step; x += step) {
          const o = (y / step) % 2 === 0 ? step / 2 : 0;
          parts.push(
            `<polygon points="${x + o},${y - step / 2} ${x + o + step / 2},${y} ${x + o},${y + step / 2} ${x + o - step / 2},${y}" fill="none" stroke="${palette.primary}" stroke-width="0.8"/>`,
          );
        }
      }
      break;
    }
  }

  return `<g opacity="${op}">${parts.join("")}</g>`;
}

/* ---------------------------------------------------------------- */
/* Sigil — n-fold symmetric identity mark                            */
/* ---------------------------------------------------------------- */

function sigil(traits: EmblemTraits): string {
  const { palette, fold, primary } = traits;
  const glyph = REALM_GLYPH[primary];
  const petals: string[] = [];

  // Repeat the realm glyph around the centre. Symmetry is what makes the mark
  // read as a sigil rather than a logo, and it's the formal property the
  // reference traditions share.
  for (let i = 0; i < fold; i++) {
    const angle = (360 / fold) * i;
    petals.push(
      `<g transform="rotate(${angle.toFixed(2)}) translate(0,-62) scale(0.62)" opacity="0.85"><path d="${glyph}" fill="none" stroke="${palette.accent}" stroke-width="3" stroke-linejoin="round"/></g>`,
    );
  }

  return `
  <g transform="translate(${C},${C - 18})">
    ${petals.join("")}
    <circle r="46" fill="${palette.deep}" stroke="${palette.primary}" stroke-width="2.5"/>
    <g transform="scale(0.95)"><path d="${glyph}" fill="${palette.primary}" stroke="${palette.glow}" stroke-width="2" stroke-linejoin="round"/></g>
  </g>`;
}

/* ---------------------------------------------------------------- */
/* Orbits, frame, pioneer                                            */
/* ---------------------------------------------------------------- */

function orbits(traits: EmblemTraits, standings: RealmStanding[]): string {
  if (traits.orbits.length === 0) return "";
  const { palette } = traits;
  const byRealm = new Map(standings.map((s) => [s.realm, s.level]));
  const n = traits.orbits.length;
  const R = 152;

  const nodes = traits.orbits.map((realm, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = C + Math.cos(a) * R;
    const y = C - 18 + Math.sin(a) * R;
    const lvl = byRealm.get(realm) ?? 3;
    const size = 9 + lvl * 2;
    return `
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <circle r="${size + 5}" fill="${palette.ground}" opacity="0.9"/>
      <circle r="${size}" fill="none" stroke="${palette.accent}" stroke-width="2"/>
      <g transform="scale(${(size / 44).toFixed(3)})"><path d="${REALM_GLYPH[realm]}" fill="${palette.glow}" opacity="0.9"/></g>
    </g>`;
  });

  return `<g><circle cx="${C}" cy="${C - 18}" r="${R}" fill="none" stroke="${palette.primary}" stroke-width="1" opacity="0.35"/>${nodes.join("")}</g>`;
}

function frame(traits: EmblemTraits): string {
  const { palette, frame: f } = traits;
  const m = 14;
  const w = SIZE - m * 2;

  switch (f) {
    case "none":
      return "";
    case "thin":
      return `<rect x="${m}" y="${m}" width="${w}" height="${w}" rx="28" fill="none" stroke="${palette.primary}" stroke-width="2" opacity="0.6"/>`;
    case "double":
      return `<rect x="${m}" y="${m}" width="${w}" height="${w}" rx="28" fill="none" stroke="${palette.primary}" stroke-width="2.5"/><rect x="${m + 9}" y="${m + 9}" width="${w - 18}" height="${w - 18}" rx="22" fill="none" stroke="${palette.accent}" stroke-width="1.2" opacity="0.7"/>`;
    case "toothed": {
      const teeth: string[] = [];
      for (let i = 0; i < 48; i++) {
        const t = i / 48;
        const p = t * 4;
        const side = Math.floor(p);
        const f2 = p - side;
        const pts = [
          [m + f2 * w, m],
          [SIZE - m, m + f2 * w],
          [SIZE - m - f2 * w, SIZE - m],
          [m, SIZE - m - f2 * w],
        ][side];
        teeth.push(`<circle cx="${pts[0].toFixed(1)}" cy="${pts[1].toFixed(1)}" r="3" fill="${palette.accent}"/>`);
      }
      return `<rect x="${m}" y="${m}" width="${w}" height="${w}" rx="28" fill="none" stroke="${palette.primary}" stroke-width="3"/>${teeth.join("")}`;
    }
    case "crowned":
      return `
      <rect x="${m}" y="${m}" width="${w}" height="${w}" rx="28" fill="none" stroke="${palette.glow}" stroke-width="3.5"/>
      <rect x="${m + 10}" y="${m + 10}" width="${w - 20}" height="${w - 20}" rx="20" fill="none" stroke="${palette.primary}" stroke-width="1.5" opacity="0.8"/>
      <g transform="translate(${C},${m + 2})"><path d="M-30,10 L-18,-8 L0,6 L18,-8 L30,10 Z" fill="${palette.glow}"/></g>`;
  }
}

function pioneerMark(traits: EmblemTraits): string {
  if (!traits.pioneer) return "";
  return `
  <g transform="translate(${SIZE - 54},${SIZE - 54})">
    <circle r="20" fill="${traits.palette.ground}" stroke="${traits.palette.glow}" stroke-width="1.5"/>
    <path d="M0,-11 L3.2,-3.4 L11,-3.4 L4.8,1.4 L7.2,9 L0,4.4 L-7.2,9 L-4.8,1.4 L-11,-3.4 L-3.2,-3.4 Z" fill="${traits.palette.glow}"/>
  </g>`;
}

/* ---------------------------------------------------------------- */

export function renderEmblemSVG(args: {
  traits: import("./traits").EmblemTraits;
  standings: RealmStanding[];
  username: string;
}): string {
  const { traits, standings, username } = args;
  const p = traits.palette;
  const def = REALM_DEFS[traits.primary];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${esc(username)} — ${esc(def.name)}, level ${traits.level}">
  <defs>
    <radialGradient id="halo" cx="50%" cy="46%" r="52%">
      <stop offset="0%" stop-color="${p.primary}" stop-opacity="0.38"/>
      <stop offset="60%" stop-color="${p.primary}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${p.ground}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="caption" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.ground}" stop-opacity="0"/>
      <stop offset="45%" stop-color="${p.ground}" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="${p.ground}" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.deep}"/>
      <stop offset="100%" stop-color="${p.ground}"/>
    </linearGradient>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" rx="32" fill="url(#ground)"/>
  ${lattice(traits)}
  <rect width="${SIZE}" height="${SIZE}" rx="32" fill="url(#halo)"/>
  ${orbits(traits, standings)}
  ${sigil(traits)}
  ${frame(traits)}
  ${pioneerMark(traits)}

  <!-- Caption sits on its own gradient so the name stays legible over any
       lattice, at any density, in every palette. -->
  <rect x="0" y="${SIZE - 104}" width="${SIZE}" height="104" fill="url(#caption)"/>
  <text x="${C}" y="${SIZE - 54}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="21" font-weight="700" fill="${p.glow}" letter-spacing="0.4">${esc(def.name)}</text>
  <text x="${C}" y="${SIZE - 31}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" fill="${p.accent}" opacity="0.95" letter-spacing="0.6">${esc(username)} &#183; LEVEL ${traits.level}</text>
</svg>`;
}
