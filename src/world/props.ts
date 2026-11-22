import { createNoise, createRng } from "../core";
import { REGION_SIZE } from "./coords";
import { CHUNK_SIZE, plateauDistance, type Terrain } from "./terrain-grid";
import type { Biome } from "./terrain";

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

const cache = new WeakMap<Terrain, { cluster: ReturnType<typeof createNoise> }>();

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
    shared = { cluster: createNoise(`${world.seed}:clusters`) };
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
      const scale = 0.8 + rng.next() * 0.5;
      const rotation = rng.next() * Math.PI * 2;
      const variant = rng.next();
      let roll = rng.next();

      const region = world.regionAt(x, z);
      const clear = plateauDistance(region, x, z) > 0.4;
      if (!clear) continue;
      if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius)) continue;

      // Forests and meadows come in clumps rather than an even sprinkle.
      const c = shared.cluster(x * 0.07, z * 0.07);
      const density = c * c * 3;
      for (const [kind, chance] of table) {
        if (roll < chance * density) {
          props.push({ kind, x, y: terrain.groundAt(x, z), z, scale, rotation, variant, regionId: tile.regionId });
          break;
        }
        roll -= chance * density;
      }
    }
  }

  // Lanterns for every shrine whose lanterns fall in this chunk.
  const rxMin = Math.floor(x0 / REGION_SIZE) - 1;
  const rxMax = Math.floor((x0 + CHUNK_SIZE) / REGION_SIZE) + 1;
  const rzMin = Math.floor(z0 / REGION_SIZE) - 1;
  const rzMax = Math.floor((z0 + CHUNK_SIZE) / REGION_SIZE) + 1;
  for (let rz = rzMin; rz <= rzMax; rz++) {
    for (let rx = rxMin; rx <= rxMax; rx++) {
      const { shrine, id, landmark } = world.region(rx, rz);
      if (landmark) continue; // the landmark is the shrine, and has no lanterns
      for (const a of LANTERN_ANGLES) {
        const x = shrine.x + Math.cos(a) * LANTERN_RADIUS;
        const z = shrine.z + Math.sin(a) * LANTERN_RADIUS;
        if (x < x0 || x >= x0 + CHUNK_SIZE || z < z0 || z >= z0 + CHUNK_SIZE) continue;
        props.push({ kind: "lantern", x, y: terrain.tileAtPoint(x, z).height, z, scale: 1, rotation: a, variant: 0.5, regionId: id });
      }
    }
  }
  return props;
}
