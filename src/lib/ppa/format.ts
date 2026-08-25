/**
 * Display formatting.
 *
 * Fixes the `+-4 PPA` bug: sign is applied exactly once, here, and multipliers
 * are formatted as multipliers rather than as signed deltas.
 */

const MINUS = '\u2212'; // U+2212, reads correctly at small sizes

/** "+20 PPA" | "-20 PPA" (true minus) | "0 PPA" — never "+-4 PPA". */
export function formatSignedPPA(value: number): string {
  const n = Math.round(value);
  if (n === 0) return '0 PPA';
  const abs = Math.abs(n).toLocaleString('en-US');
  return n > 0 ? `+${abs} PPA` : `${MINUS}${abs} PPA`;
}

export function formatPPA(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** "1.50x" — multipliers never carry a plus or minus. */
export function formatMultiplier(factor: number): string {
  return `${factor.toFixed(2)}\u00D7`;
}

export function signedToneClass(value: number): string {
  return Math.round(value) > 0 ? 'text-amber-300' : 'text-slate-400';
}

/** "1.5000P" with the Pi glyph. Always 4dp so users can check the arithmetic. */
export function formatPi(value: number): string {
  return `${value.toFixed(4)}\u03C0`;
}
