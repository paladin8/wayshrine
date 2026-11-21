/**
 * Deterministic PRNG utilities. Everything in the world derives from a seed,
 * so a world is saved as a seed plus the player's discoveries, never as geometry.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /**
   * Independent child stream, derived from this stream's seed and a label
   * (not from its current state). A chunk's stream is therefore the same
   * whatever order chunks are generated in.
   */
  fork(label: string | number): Rng;
}

/** 32-bit string hash (xmur3-style finalizer). */
export function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number | string): Rng {
  const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  const f = mulberry32(s);
  return {
    next: f,
    range: (min, max) => min + (max - min) * f(),
    int: (lo, hi) => lo + Math.floor(f() * (hi - lo)),
    chance: (p) => f() < p,
    pick: (items) => items[Math.floor(f() * items.length)]!,
    fork: (label) => createRng(hashString(`${s}:${label}`)),
  };
}
