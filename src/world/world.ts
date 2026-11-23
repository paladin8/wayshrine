import { createNoise, createRng, type Rng } from "../core";
import { REGION_SIZE, parseRegionId, regionId, type Point, type RegionCoord } from "./coords";
import { footprintHalf, HOME_RADIUS, LANDMARK_BLEND, LANDMARK_REACH_MARGIN, planRegions, type Landmark, type LandmarkLayout } from "./landmarks";
import type { Biome } from "./terrain";

/** A region is the area energised by one shrine. Regions tile the infinite plane. */
export interface Region {
  /** "rx,rz" */
  readonly id: string;
  readonly coord: RegionCoord;
  /** The region's Voronoi site. */
  readonly site: Point;
  /** The physical shrine and origin of the restoration wave. */
  readonly shrine: Point;
  readonly biome: Biome;
  /** The landmark this region is built around, or null for an ordinary region. */
  readonly landmark: Landmark | null;
}

export interface World {
  readonly seed: string;
  region(rx: number, rz: number): Region;
  regionById(id: string): Region;
  /** The region containing a world-space point, with gently bent boundaries. */
  regionAt(x: number, z: number): Region;
  /** Landmark regions, in landmark order. */
  readonly landmarks: readonly Region[];
}

/** Sites are jittered up to this fraction of REGION_SIZE from their cell centre. */
const SITE_JITTER = 0.2;
/** The nearest possible cell boundary is 19.2 units from the site, leaving room for the shrine plateau. */
const SHRINE_OFFSET = 14;

/** The four biomes every region can have, and their weights near the start. */
const CORE_BIOME_WEIGHTS: ReadonlyArray<readonly [Biome, number]> = [
  ["meadow", 0.4],
  ["water", 0.2],
  ["snow", 0.2],
  ["mountain", 0.2],
];

/**
 * The biomes of later acts, as shares of the outer mix. They only appear far from the start:
 * if they were everywhere, the open meadow the early acts rely on would be too thin to walk across.
 */
const OUTER_BIOME_SHARES: ReadonlyArray<readonly [Biome, number]> = [
  ["marsh", 0.33],
  ["forest", 0.27],
  ["volcanic", 0.2],
  ["sea", 0.2],
];

/** The outer biomes fade in over `OUTER_FADE` regions starting this far (in regions) from the start. */
export const OUTER_START = 14;
const OUTER_FADE = 3;
/** The share of regions given to the outer biomes once fully faded in. */
export const OUTER_SHARE = 0.45;

/** Weights for a region at distance `d` (in regions) from the start; they sum to 1. */
export function ambientWeights(d: number): ReadonlyArray<readonly [Biome, number]> {
  const f = Math.min(1, Math.max(0, (d - OUTER_START) / OUTER_FADE)) * OUTER_SHARE;
  if (f === 0) return CORE_BIOME_WEIGHTS;
  return [
    ...CORE_BIOME_WEIGHTS.map(([b, w]) => [b, w * (1 - f)] as const),
    ...OUTER_BIOME_SHARES.map(([b, w]) => [b, w * f] as const),
  ];
}

/**
 * Biomes come in patches: regions belong to the nearest of a loose grid of cluster sites, and a
 * cluster takes one biome, so a few neighbouring regions share terrain and form a natural wall.
 * `CLUSTER_NOISE` of regions ignore their cluster, which keeps the patch edges ragged.
 */
export const CLUSTER_SPACING = 3;
export const CLUSTER_NOISE = 0.1;
const LANDMARK_BIOME_RADIUS = 2;

function pickBiome(rng: Rng, d: number): Biome {
  let roll = rng.next();
  for (const [biome, weight] of ambientWeights(d)) {
    if (roll < weight) return biome;
    roll -= weight;
  }
  return "meadow";
}

/**
 * The macro structure of a world: a pure function of the seed.
 * Regions are memoised, so repeated lookups are cheap.
 */
export function createWorld(seed: string, layout: LandmarkLayout = "graded"): World {
  const root = createRng(seed);
  const cache = new Map<string, Region>();
  const ambientCache = new Map<string, Biome>();
  const bendX = createNoise(`${seed}:region-bend-x`);
  const bendZ = createNoise(`${seed}:region-bend-z`);
  const ripple = createNoise(`${seed}:region-edge-detail`);

  /** Broad bends vary the area of each cell, with a shorter ripple along its edge. */
  function bend(x: number, z: number, noise: ReturnType<typeof createNoise>, offset: number): number {
    return (noise(x / 39, z / 39) - 0.5) * 9 + (ripple(x / 15 + offset, z / 15) - 0.5) * 3;
  }

  /** The loose grid of cluster sites: one per `CLUSTER_SPACING` square, jittered within it. */
  const clusterSites = new Map<string, { x: number; z: number; biome: Biome }>();
  function clusterSite(cx: number, cz: number): { x: number; z: number; biome: Biome } {
    const id = `${cx},${cz}`;
    let site = clusterSites.get(id);
    if (!site) {
      const rng = root.fork(`cluster:${id}`);
      const x = (cx + rng.next()) * CLUSTER_SPACING;
      const z = (cz + rng.next()) * CLUSTER_SPACING;
      site = { x, z, biome: pickBiome(rng, Math.hypot(x, z)) };
      clusterSites.set(id, site);
    }
    return site;
  }

  /** The biome of the cluster that a region falls in. */
  function clusterBiome(rx: number, rz: number): Biome {
    const cx = Math.floor(rx / CLUSTER_SPACING);
    const cz = Math.floor(rz / CLUSTER_SPACING);
    let best = clusterSite(cx, cz);
    let bestD = Infinity;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const s = clusterSite(cx + dx, cz + dz);
        const d = Math.hypot(rx + 0.5 - s.x, rz + 0.5 - s.z);
        if (d < bestD) {
          best = s;
          bestD = d;
        }
      }
    }
    return best.biome;
  }

  /** A region's biome before landmarks are placed. The start is always open meadow. */
  function ambient(rx: number, rz: number): Biome {
    if (Math.hypot(rx, rz) <= HOME_RADIUS) return "meadow";
    const id = regionId(rx, rz);
    let hit = ambientCache.get(id);
    if (!hit) {
      const own = root.fork(`biome:${id}`);
      hit = own.next() < CLUSTER_NOISE ? pickBiome(own, Math.hypot(rx, rz)) : clusterBiome(rx, rz);
      ambientCache.set(id, hit);
    }
    return hit;
  }

  function nearbyBiomes(landmarks: ReadonlyMap<string, Landmark>) {
    const candidates = new Map<string, RegionCoord & { biome: Biome; distanceSquared: number }>();
    for (const [id, { biome }] of landmarks) {
      const center = parseRegionId(id);
      const isOuter = OUTER_BIOME_SHARES.some(([outer]) => biome === outer);
      for (let dz = -LANDMARK_BIOME_RADIUS; dz <= LANDMARK_BIOME_RADIUS; dz++) {
        for (let dx = -LANDMARK_BIOME_RADIUS; dx <= LANDMARK_BIOME_RADIUS; dx++) {
          const distanceSquared = dx * dx + dz * dz;
          if (distanceSquared === 0 || distanceSquared > LANDMARK_BIOME_RADIUS ** 2) continue;
          const rx = center.rx + dx;
          const rz = center.rz + dz;
          const distanceFromHome = Math.hypot(rx, rz);
          if (distanceFromHome <= HOME_RADIUS || (isOuter && distanceFromHome <= OUTER_START - CLUSTER_SPACING)) continue;
          const neighbor = regionId(rx, rz);
          if (landmarks.has(neighbor)) continue;
          // The nearest landmark wins; equal distances keep the earlier landmark.
          if (distanceSquared < (candidates.get(neighbor)?.distanceSquared ?? Infinity)) {
            candidates.set(neighbor, { rx, rz, biome, distanceSquared });
          }
        }
      }
    }
    return [...candidates.entries()]
      .filter(([id, { distanceSquared }]) => {
        const chance = distanceSquared === 1 ? 1 : distanceSquared === 2 ? 0.85 : 0.55;
        return root.fork(`landmark-biome:${id}`).next() < chance;
      })
      .map(([, candidate]) => candidate)
      .sort((a, b) => a.distanceSquared - b.distanceSquared);
  }

  let plan: ReturnType<typeof planRegions> | null = null;
  const regionPlan = () => (plan ??= planRegions(seed, ambient, layout, layout === "graded" ? nearbyBiomes : undefined));

  function region(rx: number, rz: number): Region {
    const id = regionId(rx, rz);
    const hit = cache.get(id);
    if (hit) return hit;
    const rng = root.fork(`region:${id}`);
    const jitter = SITE_JITTER * REGION_SIZE;
    const jittered: Point = {
      x: (rx + 0.5) * REGION_SIZE + rng.range(-jitter, jitter),
      z: (rz + 0.5) * REGION_SIZE + rng.range(-jitter, jitter),
    };
    const planned = regionPlan();
    const landmark = planned.landmarks.get(id) ?? null;
    // A landmark stands at its cell's centre, so its region has room for a large footprint (MAX_FOOTPRINT_HALF).
    const site: Point = landmark ? { x: (rx + 0.5) * REGION_SIZE, z: (rz + 0.5) * REGION_SIZE } : jittered;
    let shrine = site;
    if (!landmark && (rx !== 0 || rz !== 0)) {
      const placement = rng.fork("shrine");
      const angle = placement.range(0, Math.PI * 2);
      const radius = SHRINE_OFFSET * Math.sqrt(placement.next());
      shrine = { x: site.x + Math.cos(angle) * radius, z: site.z + Math.sin(angle) * radius };
    }
    const made: Region = {
      id,
      coord: { rx, rz },
      site,
      shrine,
      biome: landmark?.biome ?? planned.biomes.get(id) ?? ambient(rx, rz),
      landmark,
    };
    cache.set(id, made);
    return made;
  }

  function regionAt(x: number, z: number): Region {
    const warpedX = x + bend(x, z, bendX, 0);
    const warpedZ = z + bend(x, z, bendZ, 91);
    const cx = Math.floor(warpedX / REGION_SIZE);
    const cz = Math.floor(warpedZ / REGION_SIZE);
    let best = region(cx, cz);
    let bestDist = Infinity;
    // The nearest site is always within the 3x3 neighbourhood, because sites
    // stay within SITE_JITTER of their cell centre.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const r = region(cx + dx, cz + dz);
        const sx = Math.abs(r.shrine.x - x);
        const sz = Math.abs(r.shrine.z - z);
        // Keep each saved shrine and its approach in the same region; a landmark's region holds its whole
        // footprint and the slope round it, so the slope never meets another region's ground.
        if (r.landmark) {
          if (Math.max(sx, sz) <= footprintHalf(r.landmark) + Math.max(LANDMARK_BLEND, LANDMARK_REACH_MARGIN)) return r;
        } else if (sx * sx + sz * sz <= 16) {
          return r;
        }
        const d = (r.site.x - warpedX) ** 2 + (r.site.z - warpedZ) ** 2;
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
      landmarkRegions ??= [...regionPlan().landmarks.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([id]) => regionById(id));
      return landmarkRegions;
    },
  };
}
