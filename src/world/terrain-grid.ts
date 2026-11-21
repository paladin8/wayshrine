import { createNoise } from "../core";
import { LANDMARK_PLATEAU_RADIUS } from "./landmarks";
import type { Biome } from "./terrain";
import type { Region, World } from "./world";

/** Tiles are 1x1 world units; chunks are CHUNK_SIZE x CHUNK_SIZE tiles. */
export const CHUNK_SIZE = 16;

/** Within this distance of a shrine the ground is flat, so the shrine has a base. */
export const PLATEAU_RADIUS = 2.5;

/** The flat ground around a region's shrine; wider where a landmark stands. */
export function plateauRadius(region: Region): number {
  return region.landmark ? LANDMARK_PLATEAU_RADIUS : PLATEAU_RADIUS;
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

  function sample(tx: number, tz: number) {
    const x = tx + 0.5;
    const z = tz + 0.5;
    const region = world.regionAt(x, z);
    const onPlateau = (x - region.site.x) ** 2 + (z - region.site.z) ** 2 <= plateauRadius(region) ** 2;
    // A shrine in a water region stands on an islet, reachable only by boat.
    const biome: Biome = onPlateau && region.biome === "water" ? "meadow" : region.biome;
    return { x, z, region, onPlateau, biome };
  }

  function tileAt(tx: number, tz: number): Tile {
    const { x, z, region, onPlateau, biome } = sample(tx, tz);
    let height: number;
    if (onPlateau) {
      height = PLATEAU_HEIGHT[biome];
    } else {
      const n = broad(x * 0.1, z * 0.1) * 0.7 + fine(x * 0.4, z * 0.4) * 0.3;
      switch (biome) {
        case "water":
          height = 0.4;
          break;
        case "meadow":
          height = 1 + quantize(n * 0.5, 0.25);
          break;
        case "snow":
          height = 1.2 + quantize(n * 0.9, 0.3);
          break;
        case "mountain":
          height = 1.6 + quantize(n ** 1.5 * 3.6, 0.6);
          break;
      }
    }
    return { biome, height, regionId: region.id };
  }

  return {
    world,
    biomeAt: (tx, tz) => sample(tx, tz).biome,
    tileAt,
    tileAtPoint: (x, z) => tileAt(Math.floor(x), Math.floor(z)),
  };
}
