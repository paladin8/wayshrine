import type { Rng } from "../core";

export interface IslandParams {
  halfX: number;
  halfZ: number;
  /** Superellipse exponent: 2 is an ellipse, higher is boxier. */
  exponent: number;
  /** Relative radial jitter on each outline point. */
  jitter: number;
  segments: number;
}

export const defaultIsland: IslandParams = {
  halfX: 4.7,
  halfZ: 5.25,
  exponent: 3,
  jitter: 0.035,
  segments: 64,
};

/** Superellipse outline with jitter, as (x, z) points. */
export function islandOutline(rng: Rng, p: IslandParams = defaultIsland): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < p.segments; i++) {
    const t = (2 * Math.PI * i) / p.segments;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const k = 1 + rng.range(-p.jitter, p.jitter);
    const x = p.halfX * Math.sign(c) * Math.abs(c) ** (2 / p.exponent);
    const z = p.halfZ * Math.sign(s) * Math.abs(s) ** (2 / p.exponent);
    pts.push([x * k, z * k]);
  }
  return pts;
}
