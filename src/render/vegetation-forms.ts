import * as THREE from "three";
import type { Biome, PropKind } from "../world";
import { at, box, cone, cylinder, ico, type Part } from "./shapes";

const leafGeometry = ico();
const tipGeometry = cone(1, 1, 5);
const branchGeometry = cylinder(0.7, 1, 1, 5);
const up = new THREE.Vector3(0, 1, 0);
type Point3 = readonly [number, number, number];

function branch(a: Point3, b: Point3, radius: number, color: number): Part {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const vector = end.clone().sub(start);
  const twist = new THREE.Quaternion().setFromUnitVectors(up, vector.clone().normalize());
  const scale = new THREE.Vector3(radius, vector.length(), radius);
  return { geometry: branchGeometry, color, matrix: new THREE.Matrix4().compose(start.lerp(end, 0.5), twist, scale) };
}

function leaf(color: number, x: number, y: number, z: number, w: number, h: number, d: number): Part {
  return { geometry: leafGeometry, color, matrix: at(x, y, z, w, h, d) };
}

const brown = 0x6e5945;
const paleBark = 0xc5bdab;
const needles = 0x3d674d;
const foliage = 0x708d4e;
const TREE_FORMS: Readonly<Record<string, { readonly height: number; readonly build: (variant: number) => Part[] }>> = {
  "white birch": { height: 2.8, build: (variant) => {
    const h = 2.18 + variant * 0.10;
    return [
      branch([0, 0, 0], [0.15, h, 0.02], 0.105, paleBark),
      branch([0.06, 0.96, 0.01], [-0.38, 1.85, -0.15], 0.062, paleBark),
      ...[0.42, 0.73, 1.1, 1.45].map((y, i) => ({ geometry: box(0.11, 0.045, 0.012), color: 0x68645d, matrix: at(y * 0.063, y, 0.087 - i * 0.011) })),
      leaf(0xb0ad66, 0.16, h, 0.03, 0.48, 0.59, 0.43),
      leaf(0x82995c, -0.34, 1.87, -0.12, 0.43, 0.47, 0.36),
      leaf(0xa5a45f, 0.34, 1.9, 0.32, 0.31, 0.35, 0.35),
    ];
  } },
  "red maple": { height: 2.1, build: (variant) => {
    const leaves = [0xa45f49, 0xb86a4d, 0xc28253, 0xa26a4e];
    return [
      branch([0, 0, 0], [0.05, 1.43, 0.12], 0.13, brown),
      branch([0.05, 0.63, 0.04], [-0.57, 1.25, -0.12], 0.082, brown),
      branch([0.03, 0.88, 0.04], [0.68, 1.53, -0.22], 0.077, brown),
      ...[[-0.56, 1.43, -0.10], [0.04, 1.69, 0.14], [0.63, 1.58, -0.2], [0.15, 1.34, 0.54]].map(([x, y, z], i) =>
        leaf(leaves[(i + variant) % leaves.length]!, x!, y!, z!, 0.60 - i * 0.04, 0.26 + (i % 2) * 0.09, 0.42)),
    ];
  } },
  "umbrella pine": { height: 2.65, build: (variant) => {
    const h = 1.88 + variant * 0.12;
    const branches = Array.from({ length: 5 }, (_, i) => {
      const angle = i * Math.PI * 2 / 5;
      const x = Math.cos(angle) * 0.75;
      const z = Math.sin(angle) * 0.67;
      return [branch([0.06, h * 0.65, 0], [x, h, z], 0.065, brown),
        leaf(i % 2 ? 0x668150 : needles, x, h + 0.07, z, 0.57, 0.24, 0.48)];
    });
    return [branch([0, 0, 0], [0.08, h, 0], 0.13, brown), leaf(0x52734b, 0, h + 0.18, 0, 0.63, 0.27, 0.61), ...branches.flat()];
  } },
  "gold ginkgo": { height: 2.8, build: (variant) => {
    const h = 2.1 + variant * 0.10;
    return [
      branch([0, 0, 0], [0, h, 0], 0.14, 0x827553),
      ...Array.from({ length: 4 }, (_, i) => {
        const side = i % 2 ? -1 : 1;
        const x = side * (0.58 - i * 0.085);
        const y = h * (0.58 + i * 0.125);
        const z = Math.sin(i * 2) * 0.3;
        return [branch([0, y * 0.73, 0], [x, y, z], 0.062, brown),
          leaf(i % 2 ? 0xbd9f54 : 0xd0b564, x, y + 0.14, z, 0.51 - i * 0.06, 0.38, 0.38)];
      }).flat(),
    ];
  } },
  "forked hinoki": { height: 3.5, build: (variant) => {
    const h = 2.56 + variant * 0.14;
    return [
      branch([0, 0, 0], [-0.21, h, 0.05], 0.17, 0x5c4a3f),
      branch([-0.06, h * 0.42, 0], [0.48, h * 0.86, -0.13], 0.11, 0x5c4a3f),
      ...[[-0.18, 0.69, 0.56], [-0.21, 0.85, 0.48], [-0.22, 0.98, 0.31], [0.48, 0.74, 0.46], [0.48, 0.89, 0.3]].map(([x, level, w], i) => ({
        geometry: tipGeometry,
        color: [0x315843, 0x40604a, 0x4a7256][i % 3]!,
        matrix: at(x!, h * level!, i < 3 ? 0.1 : -0.14, w!, h * 0.41, w! * 0.82),
      })),
    ];
  } },
  "streamside alder": { height: 2.3, build: (variant) => [
    ...[[-0.38, 1.61, -0.16], [0.05, 1.88, 0.22], [0.38, 1.68, -0.18]].flatMap(([x, y, z], i) => [
      branch([0, 0, 0], [x!, y!, z!], 0.09 - i * 0.012, i % 2 ? 0x756654 : 0x655c50),
      leaf([0x74985c, 0x8ba16c, 0x65884d][(i + variant) % 3]!, x!, y!, z!, 0.48, 0.43, 0.35),
    ]),
  ] },
  "trailing willow": { height: 2.85, build: (variant) => {
    const h = 2.09 + variant * 0.13;
    const points: Point3[] = [[-0.81, h * 0.83, -0.1], [-0.19, h, 0.45], [0.41, h * 0.94, -0.5], [0.79, h * 0.83, 0.23]];
    return [
      branch([0, 0, 0], [-0.12, h * 0.84, 0], 0.15, brown),
      ...points.flatMap(([x, y, z], i) => [
        branch([-0.10, h * 0.57, 0], [x, y, z], 0.075, brown),
        leaf(i % 2 ? 0x87a26b : 0x6c935e, x, y, z, 0.48, 0.32, 0.45),
        leaf(i % 2 ? 0x719457 : 0x597d57, x * 1.22, y - 0.35, z * 1.17, 0.22, 0.65, 0.20),
      ]),
    ];
  } },
  "wind-pruned black pine": { height: 1.95, build: (variant) => {
    const bend = 0.37 + variant * 0.11;
    return [
      branch([0, 0, 0], [bend, 0.81, 0.08], 0.16, 0x544c43),
      branch([bend, 0.81, 0.08], [bend * 1.34, 1.54, 0.23], 0.092, brown),
      branch([bend, 0.81, 0.08], [-0.23, 1.03, -0.19], 0.084, brown),
      leaf(0x416750, bend * 1.36, 1.52, 0.21, 0.79, 0.23, 0.48),
      leaf(0x64835b, bend * 0.82, 1.68, 0.20, 0.54, 0.23, 0.35),
      leaf(0x47664b, -0.29, 1.06, -0.22, 0.58, 0.20, 0.37),
    ];
  } },
};

const FLOWER_FORMS = {
  "white daisies": { stems: 5, height: 0.29, petal: 0xf3e4cb, heart: 0xd3a75f, shape: [0.069, 0.024, 0.073], spread: 0.20 },
  "blue irises": { stems: 3, height: 0.61, petal: 0x7d78b2, heart: 0xc5af8a, shape: [0.058, 0.077, 0.082], spread: 0.16 },
  "scarlet lilies": { stems: 4, height: 0.42, petal: 0xc65b51, heart: 0xe2aa7a, shape: [0.081, 0.048, 0.082], spread: 0.21 },
  "field mustard": { stems: 6, height: 0.48, petal: 0xd4bb60, heart: 0xe5d58b, shape: [0.048, 0.059, 0.049], spread: 0.19 },
  "violet asters": { stems: 5, height: 0.33, petal: 0xa181ae, heart: 0xd8b673, shape: [0.078, 0.026, 0.077], spread: 0.22 },
  "alpine pinks": { stems: 4, height: 0.20, petal: 0xd294a5, heart: 0xe7c8ae, shape: [0.062, 0.031, 0.063], spread: 0.21 },
} as const;

const UNDERSTORY_FORMS = {
  "ostrich fern": { count: 6, height: 0.54, reach: 0.39, color: 0x789454, spread: 0.08, shape: "fronds" },
  "horsetail stand": { count: 7, height: 0.74, reach: 0.24, color: 0x7e8e53, spread: 0.17, shape: "spikes" },
  "sasa bamboo": { count: 6, height: 0.91, reach: 0.39, color: 0x648b61, spread: 0.14, shape: "fronds" },
  "azalea mound": { count: 5, height: 0.42, reach: 0.32, color: 0x617e52, spread: 0.20, shape: "azalea" },
  "low juniper": { count: 5, height: 0.29, reach: 0.43, color: 0x557560, spread: 0.15, shape: "needles" },
  "shore sedges": { count: 8, height: 0.46, reach: 0.32, color: 0x96a46a, spread: 0.19, shape: "spikes" },
} as const;

type Flower = keyof typeof FLOWER_FORMS;
type Understory = keyof typeof UNDERSTORY_FORMS;

const TREES: Partial<Record<Biome, readonly string[]>> = {
  meadow: ["tree", "tree", "white birch", "red maple", "umbrella pine", "gold ginkgo", "streamside alder"],
  forest: ["cedar", "cedar", "cedar", "forked hinoki", "forked hinoki", "red maple", "sasa bamboo"],
  snow: ["pine", "pine", "white birch", "white birch", "wind-pruned black pine"],
  water: ["trailing willow", "trailing willow", "streamside alder", "white birch"],
  sea: ["wind-pruned black pine", "wind-pruned black pine", "umbrella pine"],
  marsh: ["streamside alder", "trailing willow", "white birch"],
};
const FLOWERS: Partial<Record<Biome, readonly Flower[]>> = {
  meadow: ["white daisies", "scarlet lilies", "field mustard", "violet asters"],
  forest: ["white daisies", "violet asters"],
  marsh: ["blue irises", "blue irises", "scarlet lilies", "white daisies"],
  mountain: ["alpine pinks", "violet asters"],
  snow: ["alpine pinks"],
  water: ["white daisies", "blue irises", "field mustard"],
  sea: ["alpine pinks", "field mustard"],
};
const UNDERSTORY: Partial<Record<Biome, readonly (Understory | string)[]>> = {
  meadow: ["bush", "azalea mound", "ostrich fern"],
  forest: ["ostrich fern", "sasa bamboo", "bush", "azalea mound"],
  marsh: ["cattail", "horsetail stand", "shore sedges"],
  water: ["cattail", "shore sedges", "horsetail stand"],
  sea: ["shore sedges", "low juniper"],
  mountain: ["low juniper", "low juniper", "azalea mound"],
  snow: ["low juniper"],
  dunes: ["shore sedges"],
};

export function vegetationLook(biome: Biome, kind: PropKind, family: number): string | undefined {
  const options = kind === "tree" || kind === "pine" ? TREES[biome]
    : kind === "flower" ? FLOWERS[biome] : kind === "bush" ? UNDERSTORY[biome] : undefined;
  return options?.[Math.floor(family * options.length)];
}

export function vegetationHeight(look: string): number | undefined {
  return TREE_FORMS[look]?.height ?? FLOWER_FORMS[look as Flower]?.height ?? UNDERSTORY_FORMS[look as Understory]?.height;
}

export function vegetationParts(look: string, variant: number): Part[] | undefined {
  if (Object.hasOwn(TREE_FORMS, look)) return TREE_FORMS[look]!.build(variant);
  if (Object.hasOwn(FLOWER_FORMS, look)) {
    const form = FLOWER_FORMS[look as Flower];
    return Array.from({ length: form.stems }, (_, i) => {
      const angle = i * 2.4 + variant * 0.77;
      const radius = form.spread * (0.38 + 0.14 * i);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = form.height * (0.74 + (i * 3 % 7) * 0.065);
      return [
        branch([x * 0.65, 0, z * 0.65], [x, y, z], 0.014, foliage),
        leaf(foliage, x * 0.8 + 0.038, y * 0.44, z * 0.8, 0.057, 0.017, 0.035),
        leaf(form.petal, x, y, z, form.shape[0], form.shape[1], form.shape[2]),
        leaf(form.heart, x, y + form.shape[1] * 0.65, z, 0.023, 0.018, 0.026),
      ];
    }).flat();
  }
  const form = Object.hasOwn(UNDERSTORY_FORMS, look) ? UNDERSTORY_FORMS[look as Understory] : undefined;
  if (!form) return;
  return Array.from({ length: form.count }, (_, i) => {
    const angle = i * 2.4 + variant * 0.51;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    const h = form.height * (0.62 + (i * 5 % 9) * 0.063);
    const a: Point3 = [x * form.spread, 0, z * form.spread];
    const b: Point3 = [x * form.reach, h, z * form.reach];
    const stem = branch(a, b, form.shape === "spikes" ? 0.019 : 0.022, form.color);
    if (form.shape === "azalea") return [stem, leaf(form.color, b[0], h, b[2], 0.21, 0.13, 0.18),
      leaf(i % 2 ? 0xb57788 : 0xc69198, b[0] + 0.07, h + 0.10, b[2], 0.065, 0.035, 0.065)];
    if (form.shape === "needles") return [stem, leaf(form.color, b[0], h, b[2], 0.24, 0.12, 0.16)];
    return [stem, ...[0.43, 0.67, 0.9].map((t) => {
      const px = THREE.MathUtils.lerp(a[0], b[0], t);
      const pz = THREE.MathUtils.lerp(a[2], b[2], t);
      return leaf(form.color, px, h * t, pz, form.shape === "spikes" ? 0.035 : 0.105, 0.034, form.shape === "spikes" ? 0.035 : 0.086);
    })];
  }).flat();
}
