import * as THREE from "three";
import { CHUNK_SIZE, MONUMENT_CLEARING, propsInChunk, type Monument, type Prop, type PropKind, type Terrain } from "../world";
import { addMonument } from "./monument-mesh";
import { palette } from "./palette";
import { at, box, cone, cylinder, ico, type Part } from "./shapes";
import { VitalityBuilder, type VitalityMesh } from "./vitality-mesh";

const LEAF = 0x5f9a52;
const PINE = 0x4f8a5a;
const STONE = 0xb9b4ac;

/** Part lists are built once per kind and variant bucket, then reused for every instance. */
const FLOWER_COLORS = [palette.blossom, palette.cream, palette.red] as const;

function partsFor(kind: PropKind, variant: number): Part[] {
  switch (kind) {
    case "tree":
      return variant < 0.5
        ? [
            { geometry: cylinder(0.07, 0.1, 0.5, 5), color: palette.wood, matrix: at(0, 0.25, 0) },
            { geometry: cone(0.45, 1.0, 6), color: LEAF, matrix: at(0, 0.95, 0) },
          ]
        : [
            { geometry: cylinder(0.07, 0.1, 0.55, 5), color: palette.wood, matrix: at(0, 0.27, 0) },
            { geometry: ico(), color: LEAF, matrix: at(0, 0.85, 0, 0.45, 0.4, 0.45) },
          ];
    case "bush":
      return [{ geometry: ico(), color: LEAF, matrix: at(0, 0.15, 0, 0.28, 0.2, 0.28) }];
    case "flower":
      return [
        { geometry: cylinder(0.015, 0.015, 0.25, 3), color: LEAF, matrix: at(0, 0.12, 0) },
        {
          geometry: ico(),
          color: FLOWER_COLORS[Math.floor(variant * 3) % 3]!,
          matrix: at(0, 0.27, 0, 0.07, 0.05, 0.07),
        },
      ];
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
function cachedParts(kind: PropKind, variant: number): Part[] {
  const bucket = kind === "tree" ? (variant < 0.5 ? 0 : 1) : kind === "flower" ? Math.floor(variant * 3) % 3 : 0;
  const key = `${kind}:${bucket}`;
  let parts = partCache.get(key);
  if (!parts) {
    parts = partsFor(kind, variant);
    partCache.set(key, parts);
  }
  return parts;
}

const place = new THREE.Matrix4();
const instance = new THREE.Matrix4();

/** How tall each kind's swaying part is, before the prop's own scale. Rigid props are absent. */
const SWAY_HEIGHT: Partial<Record<PropKind, number>> = {
  tree: 1.5,
  bush: 0.4,
  flower: 0.35,
  pine: 1.7,
};

function addProp(builder: VitalityBuilder, p: Prop): void {
  const height = SWAY_HEIGHT[p.kind];
  const motion = height ? { sway: { baseY: p.y, height: height * p.scale } } : undefined;
  place.compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation),
    new THREE.Vector3(p.scale, p.scale, p.scale),
  );
  for (const part of cachedParts(p.kind, p.variant)) {
    const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    instance.multiplyMatrices(place, part.matrix);
    geo.applyMatrix4(instance);
    const color = new THREE.Color(part.color).offsetHSL(0, 0, (p.variant - 0.5) * 0.08);
    builder.addTriangles(geo.getAttribute("position").array, color, p.regionId, motion);
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
  const builder = new VitalityBuilder((id) => terrain.world.regionById(id).site);
  const clearings = monuments.map((m) => ({ x: m.x, z: m.z, radius: MONUMENT_CLEARING }));
  for (const p of propsInChunk(terrain, cx, cz, clearings)) addProp(builder, p);
  for (const m of monuments) {
    if (Math.floor(m.x / CHUNK_SIZE) === cx && Math.floor(m.z / CHUNK_SIZE) === cz) addMonument(builder, m);
  }
  return builder.isEmpty ? null : builder.build(vitalityOf);
}
