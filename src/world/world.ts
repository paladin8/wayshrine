import { createRng, type Rng } from "../core";
import { REGION_SIZE, parseRegionId, regionId, type Point, type RegionCoord } from "./coords";
import { generateSpine } from "./spine";
import type { Biome, Capability } from "./terrain";

export interface Shrine {
  /** Capability granted when this shrine is restored, if any. */
  readonly grants: Capability | null;
}

/** A region is the area energised by one shrine. Regions tile the infinite plane. */
export interface Region {
  /** "rx,rz" */
  readonly id: string;
  readonly coord: RegionCoord;
  /** Shrine location, and the region's Voronoi site. */
  readonly site: Point;
  readonly biome: Biome;
  readonly shrine: Shrine;
  /** Position along the progression spine, or null for regions off it. */
  readonly spineIndex: number | null;
}

export interface World {
  readonly seed: string;
  region(rx: number, rz: number): Region;
  regionById(id: string): Region;
  /** The region containing a world-space point (nearest site). */
  regionAt(x: number, z: number): Region;
  /** Regions on the progression spine, in order. */
  readonly spine: readonly Region[];
}

/** Sites are jittered up to this fraction of REGION_SIZE from their cell centre. */
const SITE_JITTER = 0.2;

const OFF_SPINE_BIOME_WEIGHTS: ReadonlyArray<readonly [Biome, number]> = [
  ["meadow", 0.4],
  ["water", 0.2],
  ["snow", 0.2],
  ["mountain", 0.2],
];

function pickBiome(rng: Rng): Biome {
  let roll = rng.next();
  for (const [biome, weight] of OFF_SPINE_BIOME_WEIGHTS) {
    if (roll < weight) return biome;
    roll -= weight;
  }
  return "meadow";
}

/**
 * The macro structure of a world: a pure function of the seed.
 * Regions are memoised, so repeated lookups are cheap.
 */
export function createWorld(seed: string): World {
  const root = createRng(seed);
  const spineCells = generateSpine(seed);
  const onSpine = new Map(
    spineCells.map((cell, index) => [regionId(cell.coord.rx, cell.coord.rz), { cell, index }]),
  );
  const cache = new Map<string, Region>();

  function region(rx: number, rz: number): Region {
    const id = regionId(rx, rz);
    const hit = cache.get(id);
    if (hit) return hit;
    const rng = root.fork(`region:${id}`);
    const jitter = SITE_JITTER * REGION_SIZE;
    const site: Point = {
      x: (rx + 0.5) * REGION_SIZE + rng.range(-jitter, jitter),
      z: (rz + 0.5) * REGION_SIZE + rng.range(-jitter, jitter),
    };
    const spine = onSpine.get(id);
    const made: Region = {
      id,
      coord: { rx, rz },
      site,
      biome: spine ? spine.cell.biome : pickBiome(rng),
      shrine: { grants: spine ? spine.cell.grants : null },
      spineIndex: spine ? spine.index : null,
    };
    cache.set(id, made);
    return made;
  }

  function regionAt(x: number, z: number): Region {
    const cx = Math.floor(x / REGION_SIZE);
    const cz = Math.floor(z / REGION_SIZE);
    let best = region(cx, cz);
    let bestDist = Infinity;
    // The nearest site is always within the 3x3 neighbourhood, because sites
    // stay within SITE_JITTER of their cell centre.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const r = region(cx + dx, cz + dz);
        const d = (r.site.x - x) ** 2 + (r.site.z - z) ** 2;
        if (d < bestDist) {
          best = r;
          bestDist = d;
        }
      }
    }
    return best;
  }

  return {
    seed,
    region,
    regionAt,
    regionById: (id) => {
      const { rx, rz } = parseRegionId(id);
      return region(rx, rz);
    },
    spine: spineCells.map((c) => region(c.coord.rx, c.coord.rz)),
  };
}
