import { createNoise, createRng } from "../core";
import type { Biome } from "./terrain";
import type { Region } from "./world";

/** Regional boundary shapes are blended through a continuous field shared by both sides. */
export const EDGE_SHAPES = [
  { name: "wide bends", broad: 1.9, detail: 0.55, diagonal: 0.25 },
  { name: "scallops", broad: 0.70, detail: 2.25, diagonal: 0.45 },
  { name: "long folds", broad: 1.5, detail: 0.55, diagonal: 1.2 },
  { name: "oblique reaches", broad: 0.65, detail: 0.95, diagonal: 2.0 },
  { name: "short coves", broad: 0.9, detail: 1.65, diagonal: -0.55 },
  { name: "swept bends", broad: 1.4, detail: 0.70, diagonal: -1.4 },
  { name: "fine notches", broad: 0.55, detail: 2.1, diagonal: -0.5 },
  { name: "broad promontories", broad: 1.8, detail: 0.25, diagonal: -1.0 },
] as const;

export function createRegionBend(seed: string) {
  const east = createNoise(`${seed}:region-bend-x`);
  const south = createNoise(`${seed}:region-bend-z`);
  const detail = createNoise(`${seed}:region-edge-detail`);
  const type = createNoise(`${seed}:region-edge-shape`);
  return (x: number, z: number) => {
    const index = type(x / 184, z / 184) * (EDGE_SHAPES.length - 1);
    const i = Math.floor(index);
    const a = EDGE_SHAPES[i]!;
    const b = EDGE_SHAPES[Math.min(i + 1, EDGE_SHAPES.length - 1)]!;
    const t = index - i;
    const broad = (a.broad + (b.broad - a.broad) * t) * 10;
    const fine = (a.detail + (b.detail - a.detail) * t) * 4;
    const diagonal = (a.diagonal + (b.diagonal - a.diagonal) * t) * 3.5;
    const shear = (detail((x + z) / 76, (z - x) / 59) - 0.5) * diagonal;
    return {
      x: x + (east(x / 39, z / 39) - 0.5) * broad + (detail(x / 15, z / 15) - 0.5) * fine + shear,
      z: z + (south(x / 39, z / 39) - 0.5) * broad + (detail(x / 15 + 91, z / 15) - 0.5) * fine - shear,
    };
  };
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const hill = (x: number, z: number): number => Math.max(0, 1 - x * x - z * z) ** 2;
const ridge = (x: number, z: number): number => hill(x * 0.62, z * 1.8);

/** Heights are in world units. The enclosing fade keeps adjoining profiles from forming seams. */
export const RELIEF_SHAPES: Readonly<Record<string, (x: number, z: number, texture: number) => number>> = {
  "rolling knolls": (x, z) => 1.5 * hill(x + 0.55, z + 0.15) + 0.95 * hill(x - 0.65, z - 0.45),
  "shallow dell": (x, z) => -0.88 * hill(x, z) + 0.64 * hill(x - 0.85, z + 0.3),
  "open saddle": (x, z) => 1.5 * (hill(x - 0.8, z) + hill(x + 0.8, z)) - 0.42 * hill(x, z),
  "sloping shoulder": (x, z) => 1.85 * hill(x - 0.65, z * 0.57) - 0.44 * hill(x + 0.75, z),
  "twin peaks": (x, z) => 3.3 * hill((x + 0.65) * 1.35, z + 0.23) + 2.5 * hill((x - 0.55) * 1.25, z - 0.26),
  "long escarpment": (x, z) => 2.65 * ridge(x, z - 0.38) - 0.68 * ridge(x, z + 0.45),
  "branching ravine": (x, z) => -1.25 * Math.max(ridge(x, z - x * 0.23), ridge(x - 0.27, z + 0.41 * x)) + 0.58 * hill(x, z + 0.7),
  "glacial bowl": (x, z) => 1.5 * hill(x * 0.71, (z + 0.48) * 1.13) - 1.35 * hill(x, z - 0.18),
  "braided levees": (x, z) => 0.58 * ridge(x, z - 0.33 * Math.sin(x * 2.4)) + 0.32 * ridge(x, z - 0.63) - 0.24 * hill(x, z + 0.52),
  "eroded caldera": (x, z, texture) => 2.0 * Math.max(0, 1 - Math.abs(Math.hypot(x, z) - 0.8) * 2.8) * (0.5 + texture * 0.65) - 1.0 * hill(x, z),
  "cinder cones": (x, z) => 3.2 * hill((x + 0.34) * 1.41, z * 1.22) + 1.65 * hill((x - 0.62) * 1.6, (z - 0.49) * 1.8),
  "wind-carved swales": (x, z, texture) => (Math.sin(z * 7.5 + x * x + texture) + 0.2 * Math.sin(z * 15)) * 0.64 * hill(x * 0.5, z * 0.56),
};

const RELIEF_BY_BIOME: Partial<Record<Biome, readonly (keyof typeof RELIEF_SHAPES)[]>> = {
  meadow: ["rolling knolls", "shallow dell", "open saddle", "sloping shoulder"],
  forest: ["shallow dell", "open saddle", "sloping shoulder", "branching ravine"],
  snow: ["glacial bowl", "open saddle", "twin peaks", "sloping shoulder"],
  mountain: ["twin peaks", "long escarpment", "branching ravine", "glacial bowl"],
  marsh: ["braided levees", "shallow dell"],
  volcanic: ["eroded caldera", "cinder cones", "long escarpment"],
  dunes: ["wind-carved swales", "sloping shoulder", "open saddle"],
};

export function createRegionalRelief(seed: string) {
  const root = createRng(seed).fork("regional-relief");
  type Shape = { x: number; z: number; cos: number; sin: number; size: number; gain: number; sample: (typeof RELIEF_SHAPES)[string] };
  const profiles = new WeakMap<Region, Shape>();
  return (region: Region, x: number, z: number, texture: number) => {
    const choices = RELIEF_BY_BIOME[region.biome];
    if (!choices) return 0;
    let profile = profiles.get(region);
    if (!profile) {
      const rng = root.fork(region.id);
      const angle = rng.range(0, Math.PI * 2);
      profile = {
        x: region.site.x + rng.range(-5, 5),
        z: region.site.z + rng.range(-5, 5),
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        size: rng.range(10, 15.5),
        gain: rng.range(0.65, 1.18) * (region.biome === "marsh" ? 0.42 : 1),
        sample: RELIEF_SHAPES[rng.pick(choices)],
      };
      profiles.set(region, profile);
    }
    const dx = (x - profile.x) / profile.size;
    const dz = (z - profile.z) / profile.size;
    const fade = clamp(1 - (Math.hypot(dx, dz) - 0.72) / 1.0);
    if (fade === 0) return 0;
    return profile.sample!(dx * profile.cos + dz * profile.sin, dz * profile.cos - dx * profile.sin, texture)
      * fade * fade * (3 - 2 * fade) * profile.gain;
  };
}
