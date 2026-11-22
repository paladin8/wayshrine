import { createNoise, createRng } from "../core";
import { REGION_SIZE } from "./coords";
import { CHUNK_SIZE, plateauDistance, type Terrain } from "./terrain-grid";
import { isWater, type Biome } from "./terrain";

export const PROP_KINDS = ["tree", "bush", "flower", "pine", "rock", "crag", "lantern"] as const;
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
    ["pine", 0.06],
    ["rock", 0.02],
  ],
  mountain: [
    ["rock", 0.06],
    ["crag", 0.03],
  ],
  marsh: [
    ["bush", 0.09],
    ["flower", 0.03],
    ["rock", 0.01],
  ],
  forest: [
    ["tree", 0.1],
    ["bush", 0.04],
  ],
  volcanic: [
    ["rock", 0.05],
    ["crag", 0.04],
  ],
  dunes: [["rock", 0.008]],
  water: [],
  sea: [],
};

/** Stone lanterns ring each shrine, on the diagonals clear of the gate. */
const LANTERN_RADIUS = 2.0;
const LANTERN_ANGLES = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4] as const;

interface ScatterFields {
  readonly groves: ReturnType<typeof createNoise>;
  readonly drifts: ReturnType<typeof createNoise>;
  readonly profiles: Map<string, readonly [number, number, number]>;
}
const cache = new WeakMap<Terrain, ScatterFields>();

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
      profiles: new Map(),
    };
    cache.set(terrain, shared);
  }
  const rng = createRng(world.seed).fork(`props:${cx},${cz}`);
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const props: Prop[] = [];

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

      const region = world.regionAt(x, z);
      const clear = region.id === tile.regionId && plateauDistance(region, x, z) > 0.7;
      if (!clear) continue;
      if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius)) continue;

      let profile = shared.profiles.get(region.id);
      if (!profile) {
        const local = createRng(world.seed).fork(`scenery:${region.id}`);
        profile = [local.range(0.45, 1.5), local.range(0.55, 1.75), local.range(0.5, 1.6)];
        shared.profiles.set(region.id, profile);
      }
      const canopy = shared.groves(x / 11, z / 11) * 0.8 + shared.groves(x / 4, z / 4) * 0.2;
      const drift = shared.drifts(x / 8, z / 8);
      const groveDensity = 0.15 + Math.max(0, (canopy - 0.32) / 0.68) ** 2 * 3.8 * profile[0];
      const bloomDensity = 0.12 + Math.max(0, (drift - 0.34) / 0.66) ** 2 * 4.2 * profile[1];
      const stoneDensity = 0.23 + drift ** 3 * 2.8 * profile[2];
      for (const [kind, chance] of table) {
        const woody = kind === "tree" || kind === "pine" || kind === "bush";
        const density = woody ? groveDensity : kind === "flower" ? bloomDensity : stoneDensity;
        if (roll < chance * density) {
          const scale = kind === "tree" || kind === "pine"
            ? 0.65 + 1.85 * size ** 2.8
            : kind === "rock" || kind === "crag"
              ? 0.6 + 1.95 * size ** 3
              : 0.65 + 0.95 * size;
          props.push({ kind, x, y: terrain.groundAt(x, z), z, scale, rotation, variant, regionId: tile.regionId });
          break;
        }
        roll -= chance * density;
      }
    }
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
