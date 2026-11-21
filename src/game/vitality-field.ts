/**
 * How alive a point is, given its region's restoration progress and its
 * distance from the shrine. Progress 0 is dead everywhere, 1 is alive
 * everywhere; in between, a band of width FRONT_WIDTH sweeps outward from the
 * shrine. Everything that shows life (colour, sway, particles) reads this one
 * field, so they all appear together exactly where the energy has reached.
 */
export const FRONT_WIDTH = 5;

/**
 * The distance the energy is timed to cover. Region edges are 47 tiles from the shrine
 * typically (55.6 at the very farthest, 99% of tiles within 44 to 47), so the front is
 * sized to just past that rather than to REGION_REACH, the loose upper bound; sizing it
 * to the bound would have the region visibly finished well before progress reaches 1.
 */
export const WAVE_EXTENT = 52;

/** Total distance the front travels: the extent, plus its own width. */
const TRAVEL = WAVE_EXTENT + FRONT_WIDTH;

/** Progress after which the last stragglers beyond WAVE_EXTENT fill in, so nothing pops at the end. */
const SETTLE_FROM = 0.9;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 0 to 1: how alive a point `distance` away from its shrine is. */
export function lifeAt(progress: number, distance: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const front = smooth(clamp01((progress * TRAVEL - distance) / FRONT_WIDTH));
  const settle = smooth(clamp01((progress - SETTLE_FROM) / (1 - SETTLE_FROM)));
  return Math.max(front, settle);
}

/** 0 to 1: peaks in the middle of the front, and is 0 where nothing is changing. */
export function frontGlow(progress: number, distance: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  const t = clamp01((progress * TRAVEL - distance) / FRONT_WIDTH);
  return 4 * t * (1 - t);
}

/** Distance from the shrine of the middle of the front, or null when there is none. */
export function frontRadius(progress: number): number | null {
  if (progress <= 0 || progress >= 1) return null;
  return progress * TRAVEL - FRONT_WIDTH / 2;
}
