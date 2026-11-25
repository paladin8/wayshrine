import * as THREE from "three";
import { CHUNK_SIZE, MONUMENT_CLEARING, propsInChunk, type Biome, type Monument, type Prop, type PropKind, type Terrain } from "../world";
import { biomePropLook, biomePropParts } from "./biome-props";
import { addMonument } from "./monument-mesh";
import { palette } from "./palette";
import { at, box, cone, cylinder, ico, type Part } from "./shapes";
import { vegetationHeight, vegetationLook, vegetationParts } from "./vegetation-forms";
import { VitalityBuilder, type VitalityMesh } from "./vitality-mesh";

const LEAF = 0x5f9a52;
const PINE = 0x4f8a5a;
const STONE = 0xb9b4ac;

/** Part lists are built once per kind and variant bucket, then reused for every instance. */
const FLOWER_COLORS = [palette.blossom, palette.cream, palette.red] as const;
const FLOWER_STEMS = [[-0.13, 0.07, 0.23], [0.07, -0.10, 0.32], [0.15, 0.14, 0.20]] as const;

function partsFor(kind: PropKind, variant: number): Part[] {
  switch (kind) {
    case "tree": {
      const trunk: Part = { geometry: cylinder(0.07, 0.11, 0.66, 5), color: palette.wood, matrix: at(0, 0.33, 0) };
      const crowns: Part[][] = [
        [{ geometry: cone(0.47, 1.14, 6), color: LEAF, matrix: at(0, 1.01, 0) }],
        [{ geometry: ico(), color: 0x6a9f52, matrix: at(0, 0.86, 0, 0.56, 0.4, 0.46) }],
        [
          { geometry: ico(), color: 0x528448, matrix: at(-0.20, 0.91, 0.05, 0.39, 0.44, 0.36) },
          { geometry: ico(), color: 0x70a256, matrix: at(0.23, 1.04, -0.05, 0.42, 0.50, 0.4) },
        ],
        [
          { geometry: ico(), color: 0x779a54, matrix: at(0.03, 0.71, 0, 0.66, 0.31, 0.52) },
          { geometry: ico(), color: 0x88a55e, matrix: at(0.08, 0.94, 0.05, 0.42, 0.24, 0.36) },
        ],
      ];
      return [trunk, ...crowns[variant]!];
    }
    case "bush":
      return [
        { geometry: ico(), color: LEAF, matrix: at(-0.12, 0.18, 0, 0.29, 0.22, 0.25) },
        { geometry: ico(), color: 0x739e57, matrix: at(0.16, 0.11, 0.08, 0.22, 0.16, 0.20) },
      ];
    case "flower":
      return FLOWER_STEMS.flatMap(([x, z, h], i) => [
        { geometry: cylinder(0.014, 0.016, h, 3), color: LEAF, matrix: at(x, h / 2, z) },
        { geometry: ico(), color: FLOWER_COLORS[(variant + Number(i === 2)) % FLOWER_COLORS.length]!, matrix: at(x, h, z, 0.095, 0.055, 0.095) },
      ]);
    case "pine":
      return [
        { geometry: cylinder(0.07, 0.09, 0.4, 5), color: palette.wood, matrix: at(0, 0.2, 0) },
        { geometry: cone(0.5, 0.8, 6), color: PINE, matrix: at(0, 0.7, 0) },
        { geometry: cone(0.35, 0.7, 6), color: PINE, matrix: at(0, 1.2, 0) },
        { geometry: cone(0.18, 0.28, 6), color: palette.snow, matrix: at(0, 1.5, 0) },
      ];
    case "rock":
      return [{ geometry: ico(), color: palette.rock, matrix: at(0, 0.12, 0, 0.32, 0.2, 0.28) }];
    case "crag":
      return [
        { geometry: new THREE.OctahedronGeometry(1, 0), color: palette.rock, matrix: at(0, 0.55, 0, 0.35, 0.7, 0.3) },
        { geometry: ico(), color: palette.rock, matrix: at(0.35, 0.15, 0.1, 0.25, 0.18, 0.22) },
      ];
    case "cherry": {
      const blossom = [0xf2b6c4, 0xe5a3b4, 0xffcad1, 0xedacbc][variant]!;
      return [
        { geometry: cylinder(0.09, 0.15, 1.4, 6), color: 0x785c50, matrix: at(0, 0.7, 0) },
        ...[[-0.43, 1.45, 0.14], [0.42, 1.61, -0.19], [0, 1.99, 0], [0.12, 1.64, 0.42]].map(([x, y, z]) =>
          ({ geometry: ico(), color: blossom, matrix: at(x!, y!, z!, 0.71, 0.55, 0.65) })),
      ];
    }
    case "city-building": {
      const tint = [0xd0bfaa, 0xaeb6af, 0xc6ab9c, 0xb2b8bf][variant]!;
      const roof = [0x6a6d70, 0x61696d, 0x635a57, 0x626974][variant]!;
      const floors = [3, 5, 4, 6][variant]!;
      const height = floors * 1.15;
      const parts: Part[] = [
        { geometry: box(4.1, height, 3.85), color: tint, matrix: at(0, height / 2, 0) },
        { geometry: box(4.25, 0.28, 4), color: roof, matrix: at(0, height + 0.14, 0) },
        { geometry: box(1.15, 0.62, 1.35), color: roof, matrix: at(0.85, height + 0.5, -0.8) },
        { geometry: box(4.2, 0.24, 0.7), color: 0x586568, matrix: at(0, 1.14, 2.1) },
      ];
      for (let floor = 0; floor < floors; floor++) {
        for (const column of [-1, 0, 1]) {
          const y = (floor + 0.52) * 1.15;
          const color = floor === 0 ? 0xdac592 : (floor + column + variant) % 4 === 0 ? 0xdbbe8b : 0x657781;
          parts.push(
            { geometry: box(0.77, 0.56, 0.035), color, matrix: at(column * 1.24, y, 1.94) },
            { geometry: box(0.035, 0.56, 0.72), color, matrix: at(2.06, y, column * 1.10) },
          );
        }
      }
      return parts;
    }
    case "farmhouse": {
      const roof = [0x45545c, 0x555152, 0x4f5c59, 0x66605d][variant]!;
      const timber = 0x7f6951;
      return [
        { geometry: box(3.8, 0.75, 2.65), color: 0x989078, matrix: at(0, -0.28, 0) },
        { geometry: box(3.65, 1.62, 2.5), color: 0xdad0ac, matrix: at(0, 0.88, 0) },
        { geometry: box(4.05, 0.19, 0.22), color: roof, matrix: at(0, 2.36, 0) },
        ...[-1, 1].flatMap((side) => [
          { geometry: box(4.17, 0.13, 1.63).rotateX(side * 0.43), color: roof, matrix: at(0, 2.03, side * 0.71) },
          { geometry: box(3.66, 0.14, 0.05), color: timber, matrix: at(0, 0.40, side * 1.26) },
          { geometry: box(1.33, 0.54, 0.05), color: 0x4f6364, matrix: at(side * 0.68, 1.08, side * 1.28) },
          { geometry: box(0.56, 1.12, 0.07), color: timber, matrix: at(-side * 1.01, 0.59, side * 1.27) },
        ]),
      ];
    }
    case "lantern":
      return [
        { geometry: box(0.3, 0.12, 0.3), color: STONE, matrix: at(0, 0.06, 0) },
        { geometry: cylinder(0.05, 0.06, 0.5, 5), color: STONE, matrix: at(0, 0.37, 0) },
        { geometry: box(0.26, 0.24, 0.26), color: palette.cream, matrix: at(0, 0.74, 0) },
        { geometry: cone(0.24, 0.16, 4), color: STONE, matrix: at(0, 0.94, 0) },
      ];
  }
}

const partCache = new Map<string, Part[]>();
function cachedParts(kind: PropKind, look: string, variant: number): Part[] {
  const bucket = look !== kind || kind === "tree" || kind === "cherry" || kind === "farmhouse" || kind === "city-building" ? Math.floor(variant * 4) : kind === "flower" ? Math.floor(variant * FLOWER_COLORS.length) : 0;
  const key = `${look}:${bucket}`;
  let parts = partCache.get(key);
  if (!parts) {
    parts = vegetationParts(look, bucket) ?? biomePropParts(look, bucket) ?? partsFor(kind, bucket);
    partCache.set(key, parts);
  }
  return parts;
}

const place = new THREE.Matrix4();
const instance = new THREE.Matrix4();

/** How tall each kind's swaying part is, before the prop's own scale. Rigid props are absent. */
const SWAY_HEIGHT: Partial<Record<PropKind, number>> = {
  tree: 1.5,
  cherry: 2.15,
  bush: 0.4,
  flower: 0.35,
  pine: 1.7,
};

function addProp(builder: VitalityBuilder, p: Prop, biome: Biome): void {
  const look = vegetationLook(biome, p.kind, p.family ?? p.variant) ?? biomePropLook(biome, p.kind);
  const height = vegetationHeight(look) ?? (look === "cedar" ? 4.2 : look === "cattail" ? 1 : SWAY_HEIGHT[p.kind]);
  const motion = height ? {
    sway: { baseY: p.y, height: height * p.scale },
    bloomBase: p.kind === "flower" ? p.y : undefined,
  } : undefined;
  place.compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation),
    new THREE.Vector3(p.scale, p.scale, p.scale),
  );
  for (const [i, part] of cachedParts(p.kind, look, p.variant).entries()) {
    const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    instance.multiplyMatrices(place, part.matrix);
    geo.applyMatrix4(instance);
    const color = new THREE.Color(part.color).offsetHSL(0, 0, (p.variant - 0.5) * 0.08);
    const cherryBlossom = p.kind === "cherry" && biome === "snow" && i > 0;
    builder.addTriangles(geo.getAttribute("position").array, color, p.regionId,
      cherryBlossom ? { ...motion, bloomBase: p.y - 0.02 } : motion);
    geo.dispose();
  }
}

/**
 * The scenery of one chunk, or null if it has none. `monuments` are those near
 * the chunk: stones inside it are drawn, and scatter is cleared around all of them.
 */
export function buildPropChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  vitalityOf: (regionId: string) => number,
  monuments: readonly Monument[] = [],
): VitalityMesh | null {
  const builder = new VitalityBuilder((id) => terrain.world.regionById(id).shrine);
  const clearings = monuments.map((m) => ({ x: m.x, z: m.z, radius: MONUMENT_CLEARING }));
  for (const p of propsInChunk(terrain, cx, cz, clearings)) addProp(builder, p, terrain.world.regionById(p.regionId).biome);
  for (const m of monuments) {
    if (Math.floor(m.x / CHUNK_SIZE) === cx && Math.floor(m.z / CHUNK_SIZE) === cz) addMonument(builder, m);
  }
  return builder.isEmpty ? null : builder.build(vitalityOf);
}
