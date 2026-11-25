import { createNoise } from "../core";
import { fujiRailway, railwayBank, railwayGround } from "./fuji-railway";
import { fujiFieldAt, fujiValley, fujiVergeAt, type FujiField } from "./fuji-valley";
import { createIsletRelief } from "./islets";
import { createRegionalRelief } from "./landforms";
import { groundHeight, groundOf, surfaceHeight, type LandmarkGround } from "./landmark-ground";
import { LANDMARK_BLEND, footprintHalf } from "./landmarks";
import { isWater, type Biome } from "./terrain";
import { tokyoSurfaceAt, TOKYO_DISTRICT_EDGE, type TokyoSurface } from "./tokyo-district";
import type { Region, World } from "./world";

/** Tiles are 1x1 world units; chunks are CHUNK_SIZE x CHUNK_SIZE tiles. */
export const CHUNK_SIZE = 16;

/** Within this distance of a shrine the ground is flat, so the shrine has a base. */
export const PLATEAU_RADIUS = 2.5;
/** Keep the gate above the nearby slope, then blend its terrace into the hill. */
const SHRINE_SURVEY_RADIUS = 6.75;
const SHRINE_APPROACH = 9.25;

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

/**
 * In a water region, the height of the region's water relative to the plateau (where a model's origin sits).
 * A landmark model whose terrain is at or below it there shows the region's own water, which the boat can
 * sail: such a model can end in open water all round its edge and slot into the sea. Undefined elsewhere.
 */
export function landmarkWaterLevel(biome: Biome): number | undefined {
  return isWater(biome) ? PLATEAU_HEIGHT[biome] - PLATEAU_HEIGHT.meadow : undefined;
}

/** Whether the model's terrain at an offset from its site is the region's own open water, which the boat can sail. */
function isOpenWater(region: Region, model: LandmarkGround, dx: number, dz: number): boolean {
  const level = landmarkWaterLevel(region.biome);
  return level !== undefined && !model.terrainSurface && surfaceHeight(model, dx, dz) <= level + 0.01;
}

/** Terrain under a landmark's model sits this far below the model's own ground, so the model is never z-fought. */
const MODEL_PAD = 0.6;

export interface Tile {
  readonly biome: Biome;
  /** Height of the tile's top surface. */
  readonly height: number;
  readonly fujiField?: FujiField;
  readonly fujiVerge?: number;
  readonly tokyoSurface?: TokyoSurface;
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
  const regionalRelief = createRegionalRelief(world.seed);
  const islandRelief = createIsletRelief(world);
  const railway = fujiRailway(world);
  const valley = fujiValley(world);
  const waterStations = railway?.stations.filter(({ shrineId }) => isWater(world.regionById(shrineId).biome)) ?? [];

  /** Height of the natural ground of a biome, before any plateau. */
  function natural(x: number, z: number, region: Region): number {
    const biome = region.biome;
    const n = broad(x * 0.1, z * 0.1) * 0.76 + fine(x * 0.4, z * 0.4) * 0.24;
    const contour = relief(x / 23, z / 23);
    const rise = Math.max(0, (contour - 0.53) / 0.47) ** 1.35;
    const hollow = Math.max(0, (0.4 - contour) / 0.4);
    const formation = regionalRelief(region, x, z, n);
    switch (biome) {
      case "water":
        return 0.4;
      case "meadow":
        return 0.95 + quantize(n * 0.22 + rise * 1.75 - hollow * 0.54 + formation, 0.22);
      case "snow":
        return 1.15 + quantize(n * 0.5 + rise * 2.6 - hollow * 0.48 + formation, 0.3);
      case "mountain":
        return 1.5 + quantize(n ** 1.7 * 2.4 + rise * 4.4 + formation, 0.4);
      case "sea":
        return 0.25;
      case "marsh":
        return 0.78 + quantize(n * 0.24 + rise * 0.36 - hollow * 0.36 + formation, 0.12);
      case "forest":
        return 1.05 + quantize(n * 0.46 + rise * 2 - hollow * 0.6 + formation, 0.22);
      case "volcanic":
        return 1.45 + quantize(n * 1.25 + rise * 4.8 + formation, 0.38);
      case "dunes":
        return 0.94 + quantize(n * 0.44 + rise * 2.2 - hollow * 0.45 + formation, 0.2);
    }
  }

  const shrineTerraces = new WeakMap<Region, number>();

  function shrineTerrace(region: Region): number {
    const cached = shrineTerraces.get(region);
    if (cached !== undefined) return cached;
    const { x, z } = region.shrine;
    let height = plateauBase(region);
    // Use tile centres, the same points sampled to build surrounding terrain.
    for (let tz = Math.floor(z - SHRINE_SURVEY_RADIUS); tz <= Math.floor(z + SHRINE_SURVEY_RADIUS); tz++) {
      for (let tx = Math.floor(x - SHRINE_SURVEY_RADIUS); tx <= Math.floor(x + SHRINE_SURVEY_RADIUS); tx++) {
        const px = tx + 0.5;
        const pz = tz + 0.5;
        if ((px - x) ** 2 + (pz - z) ** 2 > SHRINE_SURVEY_RADIUS ** 2) continue;
        const nearby = world.regionAt(px, pz);
        if (!isWater(nearby.biome)) height = Math.max(height, natural(px, pz, nearby));
      }
    }
    height += 0.06;
    shrineTerraces.set(region, height);
    return height;
  }

  function sample(tx: number, tz: number) {
    const x = tx + 0.5;
    const z = tz + 0.5;
    const region = world.regionAt(x, z);
    const away = plateauDistance(region, x, z);
    const model = region.landmark ? groundOf(region.landmark.id) : undefined;
    // Terrain sunk under a model's own ground must lie wholly inside its footprint: a tile straddling the edge
    // would leave a trench between the model and the lawn, so it belongs to the blend instead.
    const water = isWater(region.biome);
    const onPlateau = (!water || region.landmark !== null) && away <= (model && !model.terrainSurface ? -0.5 : 0);
    const dx = x - region.shrine.x;
    const dz = z - region.shrine.z;
    // A model's own sea, at the region's water level: open water, the same as around it.
    const open = onPlateau && !!model && isOpenWater(region, model, dx, dz);
    // Ordinary water shrines sit on the surface. Only landmark footprints can make dry land here.
    let biome: Biome = onPlateau && water && !open ? "meadow" : region.biome;
    let height: number;
    let skirt = false;
    let shore = false;
    let shoal = 0;
    const landShrine = !region.landmark && !water;
    if (landShrine && away < SHRINE_APPROACH) {
      const base = shrineTerrace(region);
      const t = Math.max(0, away / SHRINE_APPROACH);
      const k = t * t * (3 - 2 * t);
      height = base + (natural(x, z, region) - base) * k;
      skirt = !onPlateau;
    } else if (onPlateau) {
      if (open) {
        height = natural(x, z, region);
        shore = true;
      } else if (model?.terrainSurface) {
        // The terrain is the model's visible ground: it follows the sidecar's surface, down into the model's
        // channels, moats and pools and up its hills, so it never covers what the model sinks below the plateau.
        height = plateauBase(region) + surfaceHeight(model, dx, dz);
        skirt = true;
      } else {
        height = model ? plateauBase(region) + surfaceHeight(model, dx, dz) - MODEL_PAD : PLATEAU_HEIGHT[biome];
      }
    } else if (region.landmark && away < LANDMARK_BLEND) {
      // Ease from the footprint's edge height to natural ground, so it never stands as a wall.
      const t = Math.max(0, away) / LANDMARK_BLEND;
      const k = t * t * (3 - 2 * t);
      const edge = plateauBase(region) + (model && !model.terrainSurface ? surfaceHeight(model, dx, dz) : 0);
      height = edge + (natural(x, z, region) - edge) * k;
      // The slope down to water becomes shore, then water.
      if (isWater(region.biome)) {
        biome = height > 0.55 ? "meadow" : region.biome;
        // Open water is flat at the natural level, so the slope above it can meet it without a step.
        if (isWater(biome)) {
          height = natural(x, z, region);
          shore = true;
        }
      }
      skirt = !isWater(biome);
    } else if (isWater(biome)) {
      height = PLATEAU_HEIGHT[biome];
      const landmarkRim = region.landmark && !model ? Math.max(0, 0.72 - away * 0.25) : 0;
      const { height: islandHeight, shelf } = islandRelief(region, x, z);
      const rise = Math.max(islandHeight, landmarkRim);
      if (rise > 0.24) {
        height += rise;
        biome = "meadow";
        skirt = true;
      } else {
        shore = rise > 0.03 || shelf > 0.16;
        shoal = Math.max(rise / 0.24, shelf * 0.84);
      }
    } else {
      height = natural(x, z, region);
    }
    if (railway && !onPlateau) {
      if (isWater(biome)) {
        const bank = waterStations.length ? railwayBank(railway, waterStations, x, z, height) : height;
        if (bank > height + 0.15) {
          height = bank;
          biome = "meadow";
          skirt = true;
        } else if (bank > height) {
          shore = true;
        }
      } else {
        const grade = railwayGround(railway, x, z, height);
        if (grade !== height) {
          height = grade;
          skirt = true;
        }
      }
    }
    const field = valley && !onPlateau && !isWater(biome) ? fujiFieldAt(valley, x, z) : undefined;
    if (field && valley) {
      const t = Math.min(1, field.inset / 1.8);
      height += (valley.line.height - 0.31 - height) * t * t * (3 - 2 * t);
      skirt = true;
    }
    const fujiVerge = railway && biome === "mountain" && away > (region.landmark ? LANDMARK_BLEND + 1 : 3)
      ? fujiVergeAt(railway, x, z)
      : undefined;
    let tokyoSurface: TokyoSurface | undefined;
    if (region.landmark?.id === "tokyo-tower" && !onPlateau) {
      const edge = Math.max(Math.abs(dx), Math.abs(dz));
      const t = Math.min(1, Math.max(0, (TOKYO_DISTRICT_EDGE + 5 - edge) / 5));
      if (t > 0) {
        tokyoSurface = tokyoSurfaceAt(region, x, z);
        height += (plateauBase(region) - height) * t * t * (3 - 2 * t);
        skirt = true;
      }
    }
    return { region, biome, height, skirt, shore, shoal, fujiField: field?.kind, fujiVerge, tokyoSurface, terrace: landShrine && onPlateau };
  }

  function tileAt(tx: number, tz: number): Tile {
    const { region, biome, height, skirt, shoal, fujiField, fujiVerge, tokyoSurface } = sample(tx, tz);
    return { biome, height, regionId: region.id, skirt, shoal, fujiField, fujiVerge, tokyoSurface };
  }

  /**
   * Height of the surface at the corner (cx, cz) of the skirt tiles meeting there: the mean of their heights,
   * or the water's level where the slope runs into the shore, so there is no step at the waterline.
   * Undefined if no skirt tile meets there.
   */
  function cornerOf(cx: number, cz: number): number | undefined {
    // Inside a footprint whose terrain is the model's ground, take the sidecar's surface at the corner itself:
    // averaging tile centres would round a narrow canal or moat up towards its banks.
    const region = world.regionAt(cx, cz);
    const model = region.landmark ? groundOf(region.landmark.id) : undefined;
    if (model?.terrainSurface && plateauDistance(region, cx, cz) < 0) {
      return plateauBase(region) + surfaceHeight(model, cx - region.shrine.x, cz - region.shrine.z);
    }
    let sum = 0;
    let n = 0;
    let shore = Infinity;
    for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
      const t = sample(cx + dx, cz + dz);
      if (t.terrace) return t.height;
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
        const dx = x - region.shrine.x;
        const dz = z - region.shrine.z;
        const ground = plateauBase(region) + groundHeight(model, dx, dz);
        // Over open water the traveller floats on the region's surface, as everywhere else on it; the model's own
        // seabed lies below that. A deck over the water still stands where the model put it.
        if (isOpenWater(region, model, dx, dz)) return Math.max(ground, plateauBase(region) + landmarkWaterLevel(region.biome)!);
        return ground;
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
