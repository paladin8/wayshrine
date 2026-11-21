import { createNoise } from "../core";
import { LANDMARK_BLEND, LANDMARK_PLATEAU_RADIUS } from "./landmarks";
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
  const dx = x - region.site.x;
  const dz = z - region.site.z;
  return region.landmark ? Math.max(Math.abs(dx), Math.abs(dz)) - LANDMARK_PLATEAU_RADIUS : Math.hypot(dx, dz) - PLATEAU_RADIUS;
}

export interface Tile {
  readonly biome: Biome;
  /** Height of the tile's top surface. */
  readonly height: number;
  readonly regionId: string;
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
    // A shrine in a water region stands on an islet, reachable only by boat.
    let biome: Biome = onPlateau && region.biome === "water" ? "meadow" : region.biome;
    let height: number;
    if (onPlateau) {
      height = PLATEAU_HEIGHT[biome];
    } else if (region.landmark && away < LANDMARK_BLEND) {
      // Ease from the plateau down (or up) to natural ground, so it never stands as a wall.
      const t = away / LANDMARK_BLEND;
      const k = t * t * (3 - 2 * t);
      const base = PLATEAU_HEIGHT[region.biome === "water" ? "meadow" : region.biome];
      height = base + (natural(x, z, region.biome) - base) * k;
      // The slope down to water becomes shore, then water.
      if (region.biome === "water") biome = height > 0.55 ? "meadow" : "water";
    } else {
      height = natural(x, z, biome);
    }
    return { x, z, region, biome, height };
  }

  function tileAt(tx: number, tz: number): Tile {
    const { region, biome, height } = sample(tx, tz);
    return { biome, height, regionId: region.id };
  }

  return {
    world,
    biomeAt: (tx, tz) => sample(tx, tz).biome,
    tileAt,
    tileAtPoint: (x, z) => tileAt(Math.floor(x), Math.floor(z)),
  };
}
