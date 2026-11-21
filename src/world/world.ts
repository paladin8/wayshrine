import { createRng, type Rng } from "../core";
import { REGION_SIZE, parseRegionId, regionId, type Point, type RegionCoord } from "./coords";
import { HOME_RADIUS, planLandmarks, type Landmark } from "./landmarks";
import type { Biome } from "./terrain";

/** A region is the area energised by one shrine. Regions tile the infinite plane. */
export interface Region {
  /** "rx,rz" */
  readonly id: string;
  readonly coord: RegionCoord;
  /** Shrine location, and the region's Voronoi site. */
  readonly site: Point;
  readonly biome: Biome;
  /** The landmark this region is built around, or null for an ordinary region. */
  readonly landmark: Landmark | null;
}

export interface World {
  readonly seed: string;
  region(rx: number, rz: number): Region;
  regionById(id: string): Region;
  /** The region containing a world-space point (nearest site). */
  regionAt(x: number, z: number): Region;
  /** Landmark regions, in landmark order. */
  readonly landmarks: readonly Region[];
}

/** Sites are jittered up to this fraction of REGION_SIZE from their cell centre. */
const SITE_JITTER = 0.2;

const AMBIENT_BIOME_WEIGHTS: ReadonlyArray<readonly [Biome, number]> = [
  ["meadow", 0.4],
  ["water", 0.2],
  ["snow", 0.2],
  ["mountain", 0.2],
];

function pickBiome(rng: Rng): Biome {
  let roll = rng.next();
  for (const [biome, weight] of AMBIENT_BIOME_WEIGHTS) {
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
  const cache = new Map<string, Region>();
  const ambientCache = new Map<string, Biome>();

  /** A region's biome before landmarks are placed. The start is always open meadow. */
  function ambient(rx: number, rz: number): Biome {
    if (Math.hypot(rx, rz) <= HOME_RADIUS) return "meadow";
    const id = regionId(rx, rz);
    let hit = ambientCache.get(id);
    if (!hit) {
      hit = pickBiome(root.fork(`biome:${id}`));
      ambientCache.set(id, hit);
    }
    return hit;
  }

  let plan: ReadonlyMap<string, Landmark> | null = null;
  const landmarkAt = (id: string): Landmark | null => (plan ??= planLandmarks(seed, ambient)).get(id) ?? null;

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
    const landmark = landmarkAt(id);
    const made: Region = {
      id,
      coord: { rx, rz },
      site,
      biome: landmark ? landmark.biome : ambient(rx, rz),
      landmark,
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

  const regionById = (id: string): Region => {
    const { rx, rz } = parseRegionId(id);
    return region(rx, rz);
  };
  let landmarkRegions: Region[] | null = null;

  return {
    seed,
    region,
    regionAt,
    regionById,
    get landmarks() {
      landmarkRegions ??= [...(plan ??= planLandmarks(seed, ambient)).entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([id]) => regionById(id));
      return landmarkRegions;
    },
  };
}
