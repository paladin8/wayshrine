import { createNoise, createRng } from "../core";
import { REGION_SIZE } from "./coords";
import { fujiValley } from "./fuji-valley";
import { fujiRailway, railwayClearance } from "./fuji-railway";
import { CHUNK_SIZE, plateauDistance, type Terrain } from "./terrain-grid";
import { isWater, type Biome } from "./terrain";

export const PROP_KINDS = ["tree", "bush", "flower", "pine", "rock", "crag", "lantern", "cherry", "farmhouse"] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/**
 * A piece of scenery. Props never decide walkability: that rule stays in one
 * place (biomes), which the progression guarantee (ADR 0003) depends on.
 * Solid scenery is derived from them separately (obstacles.ts), as discs the
 * player slides around but can always get past.
 */
export interface Prop {
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  /** Rotation about the vertical axis, radians. */
  readonly rotation: number;
  /** In [0, 1): picks between visual variants and small colour shifts. */
  readonly variant: number;
  /** Spatially correlated selector for species, independent of model details. */
  readonly family?: number;
  readonly regionId: string;
}

/** Per-tile chance of each prop, before clustering. Order matters for determinism. */
const SCATTER: Readonly<Record<Biome, ReadonlyArray<readonly [PropKind, number]>>> = {
  meadow: [
    ["tree", 0.05],
    ["bush", 0.04],
    ["flower", 0.07],
  ],
  snow: [
    ["pine", 0.059],
    ["bush", 0.018],
    ["flower", 0.009],
    ["rock", 0.02],
  ],
  mountain: [
    ["rock", 0.06],
    ["crag", 0.03],
    ["bush", 0.024],
    ["flower", 0.02],
  ],
  marsh: [
    ["bush", 0.115],
    ["tree", 0.018],
    ["flower", 0.065],
    ["rock", 0.01],
  ],
  forest: [
    ["tree", 0.1],
    ["bush", 0.074],
    ["flower", 0.018],
  ],
  volcanic: [
    ["rock", 0.05],
    ["crag", 0.04],
  ],
  dunes: [["rock", 0.012], ["bush", 0.015]],
  water: [],
  sea: [],
};

/** Stone lanterns ring each shrine, on the diagonals clear of the gate. */
const LANTERN_RADIUS = 2.0;
const LANTERN_ANGLES = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4] as const;

interface ScatterFields {
  readonly groves: ReturnType<typeof createNoise>;
  readonly drifts: ReturnType<typeof createNoise>;
  readonly families: ReturnType<typeof createNoise>;
  readonly profiles: Map<string, readonly [number, number, number, number, number]>;
}
const cache = new WeakMap<Terrain, ScatterFields>();

/** Rough height of each tall kind at scale 1 (the tallest looks, like cedars, are taller still). */
const TALL_HEIGHT: Partial<Record<PropKind, number>> = { tree: 2.4, pine: 2.6, cherry: 2.5, crag: 1 };
/** Foliage radius per unit scale of the tall kinds. */
const CANOPY_RADIUS = 0.45;
/** The camera looks along (-1, -1) from the +x +z side, so scenery on that side stands in front of a landmark. */
const MAX_SIGHT_BLOCK = 6.5;

/**
 * True when a prop at (x, z) would stand on, crowd, or hide a clearing's centre: inside its radius plus the
 * prop's own foliage, or in the strip toward the camera where it would cover the stone on screen.
 */
export function blocksClearing(
  kind: PropKind,
  scale: number,
  x: number,
  z: number,
  c: { readonly x: number; readonly z: number; readonly radius: number },
): boolean {
  const height = TALL_HEIGHT[kind];
  if (!height) return Math.hypot(x - c.x, z - c.z) < c.radius;
  const canopy = CANOPY_RADIUS * scale;
  const dx = x - c.x;
  const dz = z - c.z;
  if (Math.hypot(dx, dz) < c.radius + canopy) return true;
  const toward = (dx + dz) / Math.SQRT2;
  const across = (dx - dz) / Math.SQRT2;
  const reach = Math.min(MAX_SIGHT_BLOCK, Math.SQRT2 * height * scale);
  return toward > 0 && toward < reach && Math.abs(across) < c.radius * 0.6 + canopy;
}

/**
 * All props within a chunk: a pure function of (seed, chunk coordinates),
 * so chunks can be built in any order and always agree.
 */
export function propsInChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  /** Spots to keep free of scatter (monuments), each with a radius. */
  clearings: ReadonlyArray<{ x: number; z: number; radius: number }> = [],
): Prop[] {
  const world = terrain.world;
  let shared = cache.get(terrain);
  if (!shared) {
    shared = {
      groves: createNoise(`${world.seed}:groves`),
      drifts: createNoise(`${world.seed}:scenery-drifts`),
      families: createNoise(`${world.seed}:scenery-families`),
      profiles: new Map(),
    };
    cache.set(terrain, shared);
  }
  const rng = createRng(world.seed).fork(`props:${cx},${cz}`);
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const props: Prop[] = [];
  const railway = fujiRailway(world);
  const valleyProps = fujiValley(world)?.props ?? [];

  for (let tz = z0; tz < z0 + CHUNK_SIZE; tz++) {
    for (let tx = x0; tx < x0 + CHUNK_SIZE; tx++) {
      const tile = terrain.tileAt(tx, tz);
      const table = SCATTER[tile.biome];
      if (table.length === 0) continue;
      const x = tx + 0.15 + rng.next() * 0.7;
      const z = tz + 0.15 + rng.next() * 0.7;
      const size = rng.next();
      const rotation = rng.next() * Math.PI * 2;
      const variant = rng.next();
      let roll = rng.next();

      if (tile.fujiField || valleyProps.some((p) => p.kind === "farmhouse" && Math.hypot(x - p.x, z - p.z) < 2.8)) continue;
      const region = world.regionAt(x, z);
      const clear = region.id === tile.regionId && plateauDistance(region, x, z) > 0.7;
      if (!clear) continue;
      if (railway && railwayClearance(railway, x, z) < 0.85) continue;
      if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius)) continue;

      let profile = shared.profiles.get(region.id);
      if (!profile) {
        const local = createRng(world.seed).fork(`scenery:${region.id}`);
        profile = [local.range(0.45, 1.5), local.range(0.55, 1.75), local.range(0.5, 1.6), local.next(), local.next()];
        shared.profiles.set(region.id, profile);
      }
      const canopy = shared.groves(x / 11, z / 11) * 0.8 + shared.groves(x / 4, z / 4) * 0.2;
      const drift = shared.drifts(x / 8, z / 8);
      const groveDensity = 0.15 + Math.max(0, (canopy - 0.32) / 0.68) ** 2 * 3.8 * profile[0];
      const meadowPatch = shared.drifts(x / 15 + 170, z / 15 - 75);
      const patch = drift * 0.52 + meadowPatch * 0.48;
      const bloomDensity = 0.035 + Math.max(0, (patch - 0.43) / 0.57) ** 2 * 18 * profile[1];
      const stoneDensity = (0.23 + drift ** 3 * 2.8 * profile[2]) * (1 - (tile.fujiVerge ?? 0) * 0.78);
      for (const [kind, chance] of table) {
        const woody = kind === "tree" || kind === "pine" || kind === "bush";
        const density = woody ? groveDensity : kind === "flower" ? bloomDensity : stoneDensity;
        if (roll < chance * density) {
          const scale = kind === "tree" || kind === "pine"
            ? 0.65 + 1.85 * size ** 2.8
            : kind === "rock" || kind === "crag"
              ? 0.6 + 1.95 * size ** 3
              : 0.65 + 0.95 * size;
          const familyField = shared.families(x / 13 + profile[3] * 47, z / 13 + profile[4] * 61);
          const family = ((kind === "flower" ? profile[3] : profile[4]) + familyField * 0.68 + (variant - 0.5) * 0.18 + 1) % 1;
          if (clearings.some((c) => blocksClearing(kind, scale, x, z, c))) break;
          props.push({ kind, x, y: terrain.groundAt(x, z), z, scale, rotation, variant, family, regionId: tile.regionId });
          break;
        }
        roll -= chance * density;
      }
    }
  }

  for (const prop of valleyProps) {
    const { x, z } = prop;
    if (x < x0 || x >= x0 + CHUNK_SIZE || z < z0 || z >= z0 + CHUNK_SIZE) continue;
    const radius = prop.kind === "farmhouse" ? 2.6 : 0.5;
    if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius + radius || blocksClearing(prop.kind, prop.scale, x, z, c))) continue;
    props.push({ ...prop, y: terrain.groundAt(x, z), regionId: terrain.tileAtPoint(x, z).regionId });
  }

  // Freestanding lanterns for land shrines whose lanterns fall in this chunk.
  const rxMin = Math.floor(x0 / REGION_SIZE) - 1;
  const rxMax = Math.floor((x0 + CHUNK_SIZE) / REGION_SIZE) + 1;
  const rzMin = Math.floor(z0 / REGION_SIZE) - 1;
  const rzMax = Math.floor((z0 + CHUNK_SIZE) / REGION_SIZE) + 1;
  for (let rz = rzMin; rz <= rzMax; rz++) {
    for (let rx = rxMin; rx <= rxMax; rx++) {
      const { shrine, id, landmark, biome } = world.region(rx, rz);
      if (landmark || isWater(biome)) continue;
      for (const a of LANTERN_ANGLES) {
        const x = shrine.x + Math.cos(a) * LANTERN_RADIUS;
        const z = shrine.z + Math.sin(a) * LANTERN_RADIUS;
        if (x < x0 || x >= x0 + CHUNK_SIZE || z < z0 || z >= z0 + CHUNK_SIZE) continue;
        props.push({ kind: "lantern", x, y: terrain.groundAt(x, z), z, scale: 1, rotation: a, variant: 0.5, regionId: id });
      }
    }
  }
  return props;
}
