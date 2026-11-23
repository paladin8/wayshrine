import { createNoise, createRng } from "../core";
import type { Region, World } from "./world";

const oval = Math.hypot;
const promontory = (x: number, z: number): number => Math.hypot(x, z + 0.36 * x);
const hooked = (x: number, z: number): number => Math.hypot(x, z + 0.75 * x * x - 0.24);
const bank = (x: number, z: number): number => Math.max(Math.abs(x), Math.abs(z) * 0.77 + Math.abs(x) * 0.31);
const split = (x: number, z: number): number => Math.min(oval((x - 0.40) * 1.6, z + 0.27), oval((x + 0.60) * 1.9, z - 0.39));
const shelves = (x: number, z: number): number => Math.max(Math.abs(x) + 0.08 * Math.sin(z * 12), Math.abs(z) + 0.13 * Math.sin(x * 9));
const horn = (x: number, z: number): number => Math.hypot(x, z / Math.max(0.35, 0.8 + x * 0.46));
const gravel = (x: number, z: number): number => Math.min(oval((x - 0.29) * 1.52, z), oval((x + 0.68) * 3.2, (z + 0.4) * 2.3));

interface IsletForm {
  readonly width: readonly [number, number];
  readonly depth: readonly [number, number];
  readonly rise: readonly [number, number];
  readonly shape: (x: number, z: number) => number;
  readonly slope: number;
  readonly bank: number;
}

/** Forms range from submerged sand shelves to exposed bedrock with steep crowns. */
export const ISLET_FORMS = {
  "round wooded islet": { width: [4.4, 6.3], depth: [4.1, 5.8], rise: [1.3, 1.9], shape: oval, slope: 1.15, bank: 0.08 },
  "spit": { width: [5, 8.4], depth: [2.1, 3.5], rise: [0.49, 0.88], shape: promontory, slope: 1.1, bank: 0.21 },
  "hooked sandbar": { width: [5, 7.6], depth: [2.1, 3.7], rise: [0.42, 0.84], shape: hooked, slope: 1.05, bank: 0.24 },
  "dyke": { width: [5, 7], depth: [2.4, 4.1], rise: [1.1, 1.9], shape: bank, slope: 0.65, bank: 0.12 },
  "twin islets": { width: [4, 7], depth: [3.1, 5.3], rise: [1.02, 1.65], shape: split, slope: 1.18, bank: 0.12 },
  "stepped shelves": { width: [4.1, 6.5], depth: [3.2, 4.8], rise: [1.35, 2.1], shape: shelves, slope: 0.6, bank: 0.18 },
  "headland": { width: [4.8, 7.2], depth: [3.4, 5.6], rise: [1.62, 2.25], shape: horn, slope: 1.06, bank: 0.13 },
  "gravel keys": { width: [4.4, 6.5], depth: [3, 4.4], rise: [0.68, 1.12], shape: gravel, slope: 0.85, bank: 0.20 },
  "rounded sea stack": { width: [2.2, 3.5], depth: [2, 3.3], rise: [2.05, 3.1], shape: oval, slope: 0.7, bank: 0.16 },
  "scree island": { width: [4.5, 6.4], depth: [3.9, 5.2], rise: [1.68, 2.65], shape: (x, z) => Math.abs(x) * 0.69 + Math.abs(z) * 0.82, slope: 1.25, bank: 0.16 },
  "submerged shoal": { width: [4.3, 6.6], depth: [3, 4.4], rise: [0.14, 0.21], shape: bank, slope: 0.66, bank: 0.23 },
  "skerries": { width: [4.8, 6.8], depth: [2.8, 4], rise: [0.65, 1.27], shape: (x, z) => Math.min(split(x, z), oval((x + 0.02) * 3.7, (z - 0.86) * 2.5)), slope: 0.76, bank: 0.17 },
} satisfies Readonly<Record<string, IsletForm>>;

type FormName = keyof typeof ISLET_FORMS;
const LAKE_FORMS: readonly FormName[] = ["round wooded islet", "spit", "hooked sandbar", "dyke", "twin islets", "gravel keys", "submerged shoal"];
const SEA_FORMS: readonly FormName[] = ["stepped shelves", "headland", "gravel keys", "rounded sea stack", "scree island", "submerged shoal", "skerries"];

interface Islet {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rise: number;
  readonly cos: number;
  readonly sin: number;
  readonly extent: number;
  readonly form: IsletForm;
}

/** Islets change the shoreline, while shoals stay below the common sailing surface. */
export function createIsletRelief(world: World) {
  const root = createRng(world.seed).fork("islets");
  const coast = createNoise(`${world.seed}:coast`);
  const cache = new WeakMap<Region, Islet[]>();

  function islandsOf(region: Region): Islet[] {
    const hit = cache.get(region);
    if (hit) return hit;
    const islets: Islet[] = [];
    cache.set(region, islets);
    if (region.landmark) return islets;
    const rng = root.fork(region.id);
    const count = rng.pick(region.biome === "sea" ? [0, 1, 1, 1, 2, 2, 3] : [1, 1, 1, 2, 2, 3]);
    for (let i = 0; i < 24 && islets.length < count; i++) {
      const bearing = rng.range(0, Math.PI * 2);
      const distance = rng.range(12, 26);
      const x = region.site.x + Math.cos(bearing) * distance;
      const z = region.site.z + Math.sin(bearing) * distance;
      const form = ISLET_FORMS[rng.pick(region.biome === "sea" ? SEA_FORMS : LAKE_FORMS)];
      const width = rng.range(...form.width);
      const depth = rng.range(...form.depth);
      const rise = rng.range(...form.rise);
      const rotation = rng.range(0, Math.PI * 2);
      const extent = Math.max(width, depth) * 1.64;
      if (Math.hypot(x - region.shrine.x, z - region.shrine.z) < extent + 8.5) continue;
      if (islets.some((other) => Math.hypot(x - other.x, z - other.z) < (extent + other.extent) * 0.83)) continue;
      if (world.regionAt(x, z) !== region) continue;
      const fits = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3]
        .every((a) => world.regionAt(x + Math.cos(a) * extent, z + Math.sin(a) * extent) === region);
      if (!fits) continue;
      islets.push({ x, z, width, depth, rise, cos: Math.cos(rotation), sin: Math.sin(rotation), extent, form });
    }
    return islets;
  }

  return (region: Region, x: number, z: number) => {
    let height = 0;
    let shelf = 0;
    for (const island of islandsOf(region)) {
      const dx = x - island.x;
      const dz = z - island.z;
      const radial = Math.hypot(dx, dz) / island.extent;
      if (radial >= 1) continue;
      const u = (dx * island.cos + dz * island.sin) / island.width;
      const v = (dz * island.cos - dx * island.sin) / island.depth;
      const roughness = (coast(x / 3.3, z / 3.3) - 0.5) * 0.30;
      const edge = island.form.shape(u, v) + roughness;
      const taper = Math.min(1, (1 - radial) * 5);
      height = Math.max(height, island.rise * Math.max(0, 1.03 - edge) ** island.form.slope * taper);
      shelf = Math.max(shelf, Math.max(0, 1 - Math.max(0, edge - 0.71) / (0.32 + island.form.bank)) * taper);
    }
    return { height, shelf };
  };
}
