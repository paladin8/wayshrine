import fushimiInari from "./landmark-grounds/fushimi-inari.json";
import kinkakuJi from "./landmark-grounds/kinkaku-ji.json";
import todaiJiDaibutsu from "./landmark-grounds/todai-ji-daibutsu.json";
import itsukushimaTorii from "./landmark-grounds/itsukushima-torii.json";
import himejiCastle from "./landmark-grounds/himeji-castle.json";
import meotoIwa from "./landmark-grounds/meoto-iwa.json";
import kiyomizuDera from "./landmark-grounds/kiyomizu-dera.json";
import enoshimaLighthouse from "./landmark-grounds/enoshima-lighthouse.json";
import horyuJi from "./landmark-grounds/horyu-ji.json";
import hirosakiCastle from "./landmark-grounds/hirosaki-castle.json";

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
  /**
   * Height the terrain follows under the model, where it differs from the walkable `ground` (a stage on
   * posts has a deck above open ground). Same grid as `ground`; absent when the two are the same.
   */
  readonly terrain?: ReadonlyArray<readonly number[]>;
  /** The terrain provides the visible ground beneath the model. */
  readonly terrainSurface?: boolean;
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
  "itsukushima-torii": itsukushimaTorii as unknown as LandmarkGround,
  "himeji-castle": himejiCastle as unknown as LandmarkGround,
  "meoto-iwa": meotoIwa as unknown as LandmarkGround,
  "kiyomizu-dera": kiyomizuDera as unknown as LandmarkGround,
  "enoshima-lighthouse": enoshimaLighthouse as unknown as LandmarkGround,
  "horyu-ji": horyuJi as unknown as LandmarkGround,
  "hirosaki-castle": hirosakiCastle as unknown as LandmarkGround,
};

export function groundOf(id: string): LandmarkGround | undefined {
  return GROUNDS[id];
}

type Grid = ReadonlyArray<readonly number[]>;

function sample(g: LandmarkGround, grid: Grid, dx: number, dz: number): number {
  const n = grid.length;
  const fx = Math.min(n - 1, Math.max(0, (dx + g.half) / g.step));
  const fz = Math.min(n - 1, Math.max(0, (dz + g.half) / g.step));
  const x0 = Math.min(n - 2, Math.floor(fx));
  const z0 = Math.min(n - 2, Math.floor(fz));
  const tx = fx - x0;
  const tz = fz - z0;
  const at = (ix: number, iz: number): number => grid[iz]![ix]!;
  return (
    at(x0, z0) * (1 - tx) * (1 - tz) + at(x0 + 1, z0) * tx * (1 - tz) + at(x0, z0 + 1) * (1 - tx) * tz + at(x0 + 1, z0 + 1) * tx * tz
  );
}

/** Walkable model height at an offset from the site, clamped to the footprint; bilinear between grid points. */
export function groundHeight(g: LandmarkGround, dx: number, dz: number): number {
  return sample(g, g.ground, dx, dz);
}

/** Height of the terrain under the model: the walkable ground, less any decks standing over open ground. */
export function surfaceHeight(g: LandmarkGround, dx: number, dz: number): number {
  return sample(g, g.terrain ?? g.ground, dx, dz);
}
