import * as THREE from "three";
import type { Monument } from "../world";
import { at, box, cone, ico, type Part } from "./shapes";
import { VitalityBuilder } from "./vitality-mesh";

const STONE = 0xbdb8ae;
const STONE_DARK = 0x9d978d;
const MOSS = 0x6f9a5a;
const INK = 0x4a4038;

/**
 * Each kind of text has its own silhouette, so a traveller can tell what they
 * have found before reaching it: tall slim stones carry haiku, broad stelae
 * carry proverbs, square pillars carry four-character sayings, low boulders idioms.
 */
function partsFor(kind: string): Part[] {
  const slab: Part = { geometry: box(1.3, 0.14, 1.3), color: STONE_DARK, matrix: at(0, 0.07, 0) };
  const moss: Part = { geometry: ico(), color: MOSS, matrix: at(0.45, 0.14, 0.4, 0.28, 0.1, 0.22) };
  switch (kind) {
    case "haiku":
      return [
        slab,
        { geometry: box(0.5, 1.6, 0.2), color: STONE, matrix: at(0, 0.94, 0) },
        { geometry: cone(0.36, 0.22, 4), color: STONE_DARK, matrix: at(0, 1.85, 0, 1, 1, 0.45) },
        { geometry: box(0.1, 1.0, 0.02), color: INK, matrix: at(0, 1.0, 0.11) },
        moss,
      ];
    case "proverb":
      return [
        slab,
        { geometry: box(0.95, 1.1, 0.26), color: STONE, matrix: at(0, 0.69, 0) },
        { geometry: ico(), color: STONE, matrix: at(0, 1.24, 0, 0.5, 0.26, 0.14) },
        { geometry: box(0.5, 0.6, 0.02), color: INK, matrix: at(0, 0.75, 0.14) },
        moss,
      ];
    case "fourCharacter":
      return [
        slab,
        { geometry: box(0.5, 1.4, 0.5), color: STONE, matrix: at(0, 0.84, 0) },
        { geometry: cone(0.42, 0.34, 4), color: STONE_DARK, matrix: at(0, 1.71, 0) },
        { geometry: box(0.14, 0.8, 0.02), color: INK, matrix: at(0, 0.9, 0.26) },
        moss,
      ];
    default:
      return [
        slab,
        { geometry: ico(), color: STONE, matrix: at(0, 0.42, 0, 0.62, 0.42, 0.45) },
        { geometry: ico(), color: STONE_DARK, matrix: at(0.5, 0.2, 0.15, 0.25, 0.16, 0.22) },
        { geometry: ico(), color: MOSS, matrix: at(-0.2, 0.8, 0.1, 0.3, 0.1, 0.22) },
      ];
  }
}

const cache = new Map<string, Part[]>();
const place = new THREE.Matrix4();
const instance = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** Adds a monument's stone to a chunk's geometry, so it is drawn with the ground and fades with its region. */
export function addMonument(builder: VitalityBuilder, m: Monument): void {
  let parts = cache.get(m.kind);
  if (!parts) {
    parts = partsFor(m.kind);
    cache.set(m.kind, parts);
  }
  place.compose(
    new THREE.Vector3(m.x, m.y - 0.02, m.z),
    new THREE.Quaternion().setFromAxisAngle(UP, m.rotation),
    new THREE.Vector3(1, 1, 1),
  );
  for (const part of parts) {
    const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    instance.multiplyMatrices(place, part.matrix);
    geo.applyMatrix4(instance);
    const color = new THREE.Color(part.color).offsetHSL(0, 0, (m.variant - 0.5) * 0.06);
    builder.addTriangles(geo.getAttribute("position").array, color, m.regionId);
    geo.dispose();
  }
}
