import { createNoise, createRng } from "../core";
import { groundHeight, groundOf } from "./landmark-ground";
import { LANDMARK_BLEND, footprintHalf } from "./landmarks";
import { isWater, type Biome } from "./terrain";
import type { Region, World } from "./world";

/** Tiles are 1x1 world units; chunks are CHUNK_SIZE x CHUNK_SIZE tiles. */
export const CHUNK_SIZE = 16;

/** Within this distance of a shrine the ground is flat, so the shrine has a base. */
export const PLATEAU_RADIUS = 2.5;

/**
 * Distance from a point to the edge of its region's flat plateau; negative on
 * the plateau. Round around a shrine, a wider square around a landmark.
 */
export function plateauDistance(region: Region, x: number, z: number): number {
  const dx = x - region.shrine.x;
  const dz = z - region.shrine.z;
  return region.landmark ? Math.max(Math.abs(dx), Math.abs(dz)) - footprintHalf(region.landmark) : Math.hypot(dx, dz) - PLATEAU_RADIUS;
}

/** The height a region's plateau stands at: where a crafted model's origin sits. */
export function plateauBase(region: Region): number {
  return PLATEAU_HEIGHT[isWater(region.biome) ? "meadow" : region.biome];
}

/** Terrain under a landmark's model sits this far below the model's own ground, so the model is never z-fought. */
const MODEL_PAD = 0.6;

export interface Tile {
  readonly biome: Biome;
  /** Height of the tile's top surface. */
  readonly height: number;
  readonly regionId: string;
  /** Light shallows over the submerged edge of an islet. */
  readonly shoal?: number;
  /**
   * On a landmark's slope: the tile is drawn as a smooth surface through its
   * `corners` rather than as a flat-topped column, so the slope isn't stepped.
   */
  readonly skirt: boolean;
}

/**
 * The ground of a world, sampled per tile. Pure: a tile is a function of the
 * seed and its integer coordinates, so chunks can be built in any order.
 */
export interface Terrain {
  readonly world: World;
  /** Biome only: cheaper than tileAt, for walkability checks. */
  biomeAt(tx: number, tz: number): Biome;
  tileAt(tx: number, tz: number): Tile;
  /** The tile containing a world-space point. */
  tileAtPoint(x: number, z: number): Tile;
  /**
   * Heights at a tile's corners, in the order (x0,z0) (x1,z0) (x0,z1) (x1,z1).
   * All equal to the tile's height unless it is a skirt tile, where each corner is
   * the mean of the skirt tiles meeting there, so neighbouring skirt tiles join.
   */
  corners(tx: number, tz: number): readonly [number, number, number, number];
  /** Smooth surface height, which follows a landmark model's ground rather than the tile steps. */
  groundAt(x: number, z: number): number;
}

const PLATEAU_HEIGHT: Readonly<Record<Biome, number>> = {
  meadow: 1.0,
  water: 0.4,
  snow: 1.2,
  mountain: 2.2,
  marsh: 0.9,
  forest: 1.2,
  volcanic: 1.8,
  sea: 0.25,
  dunes: 1.1,
};

const quantize = (v: number, step: number): number => Math.round(v / step) * step;

export function createTerrain(world: World): Terrain {
  const broad = createNoise(`${world.seed}:broad`);
  const fine = createNoise(`${world.seed}:fine`);
  const relief = createNoise(`${world.seed}:landforms`);
  const coast = createNoise(`${world.seed}:coast`);
  const root = createRng(world.seed).fork("islets");
  type Islet = { x: number; z: number; width: number; depth: number; rise: number };
  const islets = new WeakMap<Region, Islet[]>();

  function islandsOf(region: Region): Islet[] {
    const cached = islets.get(region);
    if (cached) return cached;
    const islands: Islet[] = [];
    islets.set(region, islands);
    if (region.landmark) return islands;
    const rng = root.fork(region.id);
    const count = rng.next() < 0.25 ? 2 : 1;
    for (let i = 0; i < 10 && islands.length < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const distance = rng.range(13, 24);
      const x = region.site.x + Math.cos(angle) * distance;
      const z = region.site.z + Math.sin(angle) * distance;
      const width = rng.range(4.5, 8);
      const depth = rng.range(3.5, 6.5);
      const rise = rng.range(0.9, 1.8);
      if (Math.hypot(x - region.shrine.x, z - region.shrine.z) < 12) continue;
      if (islands.some((other) => Math.hypot(x - other.x, z - other.z) < 13)) continue;
      const points = [[x, z], [x - width - 2, z], [x + width + 2, z], [x, z - depth - 2], [x, z + depth + 2]] as const;
      if (points.some(([px, pz]) => world.regionAt(px, pz) !== region)) continue;
      islands.push({ x, z, width, depth, rise });
    }
    return islands;
  }

  function islandRelief(region: Region, x: number, z: number): number {
    let h = 0;
    for (const island of islandsOf(region)) {
      const distance = Math.hypot((x - island.x) / island.width, (z - island.z) / island.depth);
      if (distance > 1.2) continue;
      const roughness = (coast(x / 4, z / 4) - 0.5) * 0.32;
      h = Math.max(h, island.rise * Math.max(0, 1.14 + roughness - distance));
    }
    return h;
  }

  /** Height of the natural ground of a biome, before any plateau. */
  function natural(x: number, z: number, biome: Biome): number {
    const n = broad(x * 0.1, z * 0.1) * 0.76 + fine(x * 0.4, z * 0.4) * 0.24;
    const contour = relief(x / 23, z / 23);
    const rise = Math.max(0, (contour - 0.53) / 0.47) ** 1.35;
    const hollow = Math.max(0, (0.4 - contour) / 0.4);
    switch (biome) {
      case "water":
        return 0.4;
      case "meadow":
        return 0.95 + quantize(n * 0.22 + rise * 1.75 - hollow * 0.54, 0.22);
      case "snow":
        return 1.15 + quantize(n * 0.5 + rise * 2.6 - hollow * 0.48, 0.3);
      case "mountain":
        return 1.5 + quantize(n ** 1.7 * 2.4 + rise * 4.4, 0.4);
      case "sea":
        return 0.25;
      case "marsh":
        return 0.78 + quantize(n * 0.24 + rise * 0.36 - hollow * 0.36, 0.12);
      case "forest":
        return 1.05 + quantize(n * 0.46 + rise * 2 - hollow * 0.6, 0.22);
      case "volcanic":
        return 1.45 + quantize(n * 1.25 + rise * 4.8, 0.38);
      case "dunes":
        return 0.94 + quantize(n * 0.44 + rise * 2.2 - hollow * 0.45, 0.2);
    }
  }

  function sample(tx: number, tz: number) {
    const x = tx + 0.5;
    const z = tz + 0.5;
    const region = world.regionAt(x, z);
    const away = plateauDistance(region, x, z);
    const model = region.landmark ? groundOf(region.landmark.id) : undefined;
    // Terrain sunk under a model's own ground must lie wholly inside its footprint: a tile straddling the edge
    // would leave a trench between the model and the lawn, so it belongs to the blend instead.
    const onPlateau = away <= (model && !model.terrainSurface ? -0.5 : 0);
    const dx = x - region.shrine.x;
    const dz = z - region.shrine.z;
    // A shrine in a water region stands on an islet, reachable only by boat.
    let biome: Biome = onPlateau && isWater(region.biome) ? "meadow" : region.biome;
    let height: number;
    let skirt = false;
    let shore = false;
    let shoal = 0;
    if (onPlateau) {
      if (model?.terrainSurface) {
        height = plateauBase(region);
        skirt = true;
      } else {
        height = model ? plateauBase(region) + groundHeight(model, dx, dz) - MODEL_PAD : PLATEAU_HEIGHT[biome];
      }
    } else if (region.landmark && away < LANDMARK_BLEND) {
      // Ease from the footprint's edge height to natural ground, so it never stands as a wall.
      const t = Math.max(0, away) / LANDMARK_BLEND;
      const k = t * t * (3 - 2 * t);
      const edge = plateauBase(region) + (model && !model.terrainSurface ? groundHeight(model, dx, dz) : 0);
      height = edge + (natural(x, z, region.biome) - edge) * k;
      // The slope down to water becomes shore, then water.
      if (isWater(region.biome)) {
        biome = height > 0.55 ? "meadow" : region.biome;
        // Open water is flat at the natural level, so the slope above it can meet it without a step.
        if (isWater(biome)) {
          height = natural(x, z, region.biome);
          shore = true;
        }
      }
      skirt = !isWater(biome);
    } else if (isWater(biome)) {
      height = PLATEAU_HEIGHT[biome];
      const rise = Math.max(islandRelief(region, x, z), !model ? Math.max(0, 0.72 - away * 0.25) : 0);
      if (rise > 0.24) {
        height += rise;
        biome = "meadow";
        skirt = true;
      } else if (rise > 0.03) {
        shore = true;
        shoal = rise / 0.24;
      }
    } else {
      height = natural(x, z, biome);
    }
    return { region, biome, height, skirt, shore, shoal };
  }

  function tileAt(tx: number, tz: number): Tile {
    const { region, biome, height, skirt, shoal } = sample(tx, tz);
    return { biome, height, regionId: region.id, skirt, shoal };
  }

  /**
   * Height of the surface at the corner (cx, cz) of the skirt tiles meeting there: the mean of their heights,
   * or the water's level where the slope runs into the shore, so there is no step at the waterline.
   * Undefined if no skirt tile meets there.
   */
  function cornerOf(cx: number, cz: number): number | undefined {
    let sum = 0;
    let n = 0;
    let shore = Infinity;
    for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
      const t = sample(cx + dx, cz + dz);
      if (t.skirt) {
        sum += t.height;
        n++;
      } else if (t.shore) {
        shore = Math.min(shore, t.height);
      }
    }
    if (!n) return undefined;
    return Number.isFinite(shore) ? shore : sum / n;
  }

  function corners(tx: number, tz: number): readonly [number, number, number, number] {
    const own = tileAt(tx, tz);
    const h = own.height;
    if (!own.skirt) return [h, h, h, h];
    return [
      cornerOf(tx, tz) ?? h,
      cornerOf(tx + 1, tz) ?? h,
      cornerOf(tx, tz + 1) ?? h,
      cornerOf(tx + 1, tz + 1) ?? h,
    ];
  }

  return {
    world,
    biomeAt: (tx, tz) => sample(tx, tz).biome,
    tileAt,
    tileAtPoint: (x, z) => tileAt(Math.floor(x), Math.floor(z)),
    corners,
    groundAt(x, z) {
      const region = world.regionAt(x, z);
      const model = region.landmark ? groundOf(region.landmark.id) : undefined;
      if (model && plateauDistance(region, x, z) <= 0) {
        return plateauBase(region) + groundHeight(model, x - region.shrine.x, z - region.shrine.z);
      }
      const tx = Math.floor(x);
      const tz = Math.floor(z);
      const tile = tileAt(tx, tz);
      if (!tile.skirt) return tile.height;
      const [a, b, c, d] = corners(tx, tz);
      const fx = x - tx;
      const fz = z - tz;
      return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
    },
  };
}
