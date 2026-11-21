import { hashString } from "./rng";

/** A smooth 2D scalar field with values in [0, 1). */
export type Noise2 = (x: number, z: number) => number;

function lattice(seed: number, ix: number, iz: number): number {
  let h = (seed ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Seeded value noise. A pure function of (seed, x, z): the same point always
 * yields the same value, regardless of what else has been sampled.
 */
export function createNoise(seed: string): Noise2 {
  const s = hashString(seed);
  return (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const u = smooth(x - ix);
    const v = smooth(z - iz);
    const a = lattice(s, ix, iz);
    const b = lattice(s, ix + 1, iz);
    const c = lattice(s, ix, iz + 1);
    const d = lattice(s, ix + 1, iz + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
