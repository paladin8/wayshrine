import fushimiInari from "./landmark-grounds/fushimi-inari.json";
import kinkakuJi from "./landmark-grounds/kinkaku-ji.json";
import todaiJiDaibutsu from "./landmark-grounds/todai-ji-daibutsu.json";

/**
 * What the world needs to know about a crafted landmark model, exported by the
 * model's generator (content/landmarks/<id>.py). Coordinates are relative to the
 * region's site, in game axes (x right, z toward the camera), heights above the
 * model's origin.
 */
export interface LandmarkGround {
  /** The model's square footprint is [-half, half] on both axes. */
  readonly half: number;
  /** Spacing of the `ground` grid. */
  readonly step: number;
  /** Walkable surface height, indexed [z][x] from (-half, -half). */
  readonly ground: ReadonlyArray<readonly number[]>;
  /** Solid discs [x, z, r]: columns, posts, trees, statues. */
  readonly solids: ReadonlyArray<readonly [number, number, number]>;
  /** Authored approach point and radius. The compass uses the point. */
  readonly interact: readonly [number, number];
  readonly reach: number;
  /** Where the player arrives when travelling here. */
  readonly stand: readonly [number, number];
}

const GROUNDS: Readonly<Record<string, LandmarkGround>> = {
  "fushimi-inari": fushimiInari as unknown as LandmarkGround,
  "kinkaku-ji": kinkakuJi as unknown as LandmarkGround,
  "todai-ji-daibutsu": todaiJiDaibutsu as unknown as LandmarkGround,
};

export function groundOf(id: string): LandmarkGround | undefined {
  return GROUNDS[id];
}

/** Model ground height at an offset from the site, clamped to the footprint; bilinear between grid points. */
export function groundHeight(g: LandmarkGround, dx: number, dz: number): number {
  const n = g.ground.length;
  const fx = Math.min(n - 1, Math.max(0, (dx + g.half) / g.step));
  const fz = Math.min(n - 1, Math.max(0, (dz + g.half) / g.step));
  const x0 = Math.min(n - 2, Math.floor(fx));
  const z0 = Math.min(n - 2, Math.floor(fz));
  const tx = fx - x0;
  const tz = fz - z0;
  const at = (ix: number, iz: number): number => g.ground[iz]![ix]!;
  return (
    at(x0, z0) * (1 - tx) * (1 - tz) + at(x0 + 1, z0) * tx * (1 - tz) + at(x0, z0 + 1) * (1 - tx) * tz + at(x0 + 1, z0 + 1) * tx * tz
  );
}
