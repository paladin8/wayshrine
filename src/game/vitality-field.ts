import { REGION_REACH, type Point, type Region } from "../world";

/**
 * How alive a point is, given its region's restoration progress and its
 * distance from the wave’s origin. Progress 0 is dead everywhere, 1 is alive
 * everywhere; in between, a band of width FRONT_WIDTH sweeps outward from its
 * origin. Everything that shows life (colour, sway, particles) reads this one
 * field, so they all appear together exactly where the energy has reached.
 */
export const FRONT_WIDTH = 5;

/**
 * Timed extent of the visible front, in world units. It covers a typical region.
 * The final settle also lights distant edges, including those farther from an offset shrine.
 */
export const WAVE_EXTENT = 52;

export interface RestorationWake {
  readonly origin: Point;
  readonly extent: number;
  progress: number;
}

/** A wave starting at the traveller can be off-centre, so allow it to reach the far edge. */
export function createRestorationWake(region: Region, origin: Point): RestorationWake {
  return {
    origin: { ...origin },
    extent: Math.hypot(origin.x - region.site.x, origin.z - region.site.z) + REGION_REACH,
    progress: 0,
  };
}

/** Progress after which the last stragglers beyond WAVE_EXTENT fill in, so nothing pops at the end. */
const SETTLE_FROM = 0.9;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 0 to 1: how alive a point `distance` away from its origin is. */
export function lifeAt(progress: number, distance: number, extent = WAVE_EXTENT): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const front = smooth(clamp01((progress * (extent + FRONT_WIDTH) - distance) / FRONT_WIDTH));
  const settle = smooth(clamp01((progress - SETTLE_FROM) / (1 - SETTLE_FROM)));
  return Math.max(front, settle);
}

/** 0 to 1: peaks in the middle of the front, and is 0 where nothing is changing. */
export function frontGlow(progress: number, distance: number, extent = WAVE_EXTENT): number {
  if (progress <= 0 || progress >= 1) return 0;
  const t = clamp01((progress * (extent + FRONT_WIDTH) - distance) / FRONT_WIDTH);
  return 4 * t * (1 - t);
}

/** Distance from the origin of the middle of the front, or null when there is none. */
export function frontRadius(progress: number, extent = WAVE_EXTENT): number | null {
  if (progress <= 0 || progress >= 1) return null;
  return progress * (extent + FRONT_WIDTH) - FRONT_WIDTH / 2;
}
