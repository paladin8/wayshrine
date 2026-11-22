import { createNoise } from "../core";
import { groundHeight, groundOf } from "./landmark-ground";
import { LANDMARK_BLEND, footprintHalf } from "./landmarks";
import type { Biome } from "./terrain";
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
  return PLATEAU_HEIGHT[region.biome === "water" ? "meadow" : region.biome];
}

/** Terrain under a landmark's model sits this far below the model's own ground, so the model is never z-fought. */
const MODEL_PAD = 0.6;

export interface Tile {
  readonly biome: Biome;
  /** Height of the tile's top surface. */
  readonly height: number;
  readonly regionId: string;
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
};

const quantize = (v: number, step: number): number => Math.round(v / step) * step;

export function createTerrain(world: World): Terrain {
  const broad = createNoise(`${world.seed}:broad`);
  const fine = createNoise(`${world.seed}:fine`);

  /** Height of the natural ground of a biome, before any plateau. */
  function natural(x: number, z: number, biome: Biome): number {
    const n = broad(x * 0.1, z * 0.1) * 0.7 + fine(x * 0.4, z * 0.4) * 0.3;
    switch (biome) {
      case "water":
        return 0.4;
      case "meadow":
        return 1 + quantize(n * 0.5, 0.25);
      case "snow":
        return 1.2 + quantize(n * 0.9, 0.3);
      case "mountain":
        return 1.6 + quantize(n ** 1.5 * 3.6, 0.6);
    }
  }

  function sample(tx: number, tz: number) {
    const x = tx + 0.5;
    const z = tz + 0.5;
    const region = world.regionAt(x, z);
    const away = plateauDistance(region, x, z);
    const onPlateau = away <= 0;
    const model = region.landmark ? groundOf(region.landmark.id) : undefined;
    const dx = x - region.shrine.x;
    const dz = z - region.shrine.z;
    // A shrine in a water region stands on an islet, reachable only by boat.
    let biome: Biome = onPlateau && region.biome === "water" ? "meadow" : region.biome;
    let height: number;
    let skirt = false;
    if (onPlateau) {
      height = model ? plateauBase(region) + groundHeight(model, dx, dz) - MODEL_PAD : PLATEAU_HEIGHT[biome];
    } else if (region.landmark && away < LANDMARK_BLEND) {
      // Ease from the footprint's edge height to natural ground, so it never stands as a wall.
      const t = away / LANDMARK_BLEND;
      const k = t * t * (3 - 2 * t);
      const edge = plateauBase(region) + (model ? groundHeight(model, dx, dz) : 0);
      height = edge + (natural(x, z, region.biome) - edge) * k;
      // The slope down to water becomes shore, then water.
      if (region.biome === "water") biome = height > 0.55 ? "meadow" : "water";
      skirt = biome !== "water";
    } else {
      height = natural(x, z, biome);
    }
    return { x, z, region, biome, height, skirt };
  }

  function tileAt(tx: number, tz: number): Tile {
    const { region, biome, height, skirt } = sample(tx, tz);
    return { biome, height, regionId: region.id, skirt };
  }

  /** Mean height of the skirt tiles meeting at the corner (cx, cz); undefined if none do. */
  function cornerOf(cx: number, cz: number): number | undefined {
    let sum = 0;
    let n = 0;
    for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
      const t = tileAt(cx + dx, cz + dz);
      if (t.skirt) {
        sum += t.height;
        n++;
      }
    }
    return n ? sum / n : undefined;
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
