import * as THREE from "three";
import type { Monument } from "../world";
import { at, box, cone, cylinder, ico, type Part } from "./shapes";
import { palette } from "./palette";
import { RUBBING_FORMS, block, incisions } from "./rubbing-forms";
import { VitalityBuilder } from "./vitality-mesh";

const STONE = 0xbdb8ae;
const STONE_DARK = 0x9d978d;
const MOSS = 0x6f9a5a;
const INK = 0x4a4038;
const PARCHMENT = 0xddc69d;
const ROOF = 0x56514c;
const BRONZE = 0x817450;
const FORMS = ["stone", "stone", "plaqueTree", "shelter", "boundRock", "trailPost", "bell", "stack", "pairedStones"] as const;
type ClassicForm = (typeof FORMS)[number];
type NewForm = keyof typeof RUBBING_FORMS;
type Form = ClassicForm | NewForm;
const allForms: readonly Form[] = [...FORMS, ...Object.keys(RUBBING_FORMS) as NewForm[]];
const formOf = (m: Monument): Form => allForms[Math.floor(m.variant * allForms.length)] ?? "stone";
const isNewForm = (form: Form): form is NewForm => Object.hasOwn(RUBBING_FORMS, form);

const glowHeight: Readonly<Record<ClassicForm, number>> = {
  stone: 2.3,
  plaqueTree: 2.85,
  shelter: 2.35,
  boundRock: 1.75,
  trailPost: 2.15,
  bell: 2.55,
  stack: 2.4,
  pairedStones: 2.05,
};

export function monumentGlowHeight(monument: Monument): number {
  const form = formOf(monument);
  return isNewForm(form) ? RUBBING_FORMS[form].glow : glowHeight[form];
}

/**
 * Each kind of text has its own silhouette, so a traveller can tell what they
 * have found before reaching it: tall slim stones carry haiku, broad stelae
 * carry proverbs, square pillars carry four-character sayings, low boulders idioms.
 */
function stoneParts(kind: string): Part[] {
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

function variants(form: ClassicForm, kind: string): Part[] {
  const plaque = (x: number, y: number, z: number, width = 0.43): Part[] => [
    block(palette.wood, width + 0.1, 0.49, 0.09, x, y, z),
    block(PARCHMENT, width, 0.4, 0.018, x, y, z + 0.05),
    ...incisions(x, y, z + 0.065, width > 0.6 ? 5 : 3),
  ];
  switch (form) {
    case "stone":
      return stoneParts(kind);
    case "plaqueTree":
      return [
        { geometry: cylinder(0.13, 0.27, 1.9, 6), color: palette.wood, matrix: at(0, 0.95, 0) },
        { geometry: ico(), color: 0x8f9752, matrix: at(-0.31, 1.89, -0.08, 0.52, 0.47, 0.48) },
        { geometry: ico(), color: 0xc39d58, matrix: at(0.25, 2.14, -0.12, 0.62, 0.55, 0.54) },
        { geometry: ico(), color: 0xaba653, matrix: at(0.02, 2.29, 0.19, 0.56, 0.38, 0.43) },
        { geometry: cylinder(0.23, 0.23, 0.065, 9), color: palette.cream, matrix: at(0, 1.39, 0) },
        block(palette.red, 0.095, 0.32, 0.022, 0.24, 1.23, 0.12),
        ...plaque(0, 1.02, 0.22),
      ];
    case "shelter":
      return [
        block(STONE_DARK, 1.30, 0.16, 0.86, 0, 0.08, 0),
        ...[-0.47, 0.47].map((x) => block(palette.wood, 0.14, 1.55, 0.14, x, 0.93, 0)),
        block(palette.wood, 1.14, 0.13, 0.23, 0, 1.68, 0),
        { geometry: cone(0.89, 0.35, 4), color: ROOF, matrix: at(0, 1.88, 0, 1, 1, 0.67).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)) },
        ...plaque(0, 1.11, 0.09, 0.72),
      ];
    case "boundRock":
      return [
        { geometry: ico(), color: STONE_DARK, matrix: at(0, 0.54, 0, 0.72, 0.69, 0.61) },
        { geometry: cylinder(0.57, 0.60, 0.045, 9), color: 0xb1986c, matrix: at(0, 0.53, 0, 1, 1, 0.88) },
        { geometry: ico(), color: MOSS, matrix: at(-0.26, 0.75, -0.06, 0.34, 0.20, 0.20) },
        block(STONE, 0.45, 0.34, 0.09, 0.07, 0.76, 0.43),
        ...incisions(0.07, 0.76, 0.485, 3),
      ];
    case "trailPost":
      return [
        { geometry: ico(), color: STONE_DARK, matrix: at(0, 0.12, 0, 0.40, 0.26, 0.39) },
        block(0x846446, 0.21, 1.72, 0.22, 0, 0.86, 0),
        block(ROOF, 0.37, 0.11, 0.34, 0, 1.7, 0),
        block(palette.red, 0.28, 0.10, 0.25, 0, 0.77, 0),
        ...plaque(0.095, 1.26, 0.14),
      ];
    case "bell":
      return [
        block(STONE_DARK, 1.15, 0.15, 0.85, 0, 0.075, 0),
        ...[-0.44, 0.44].map((x) => block(palette.red, 0.14, 1.74, 0.20, x, 0.98, 0)),
        block(ROOF, 1.3, 0.20, 0.64, 0, 1.91, 0),
        { geometry: cylinder(0.23, 0.32, 0.46, 8), color: BRONZE, matrix: at(0, 1.52, 0) },
        { geometry: cylinder(0.04, 0.07, 0.24, 6), color: INK, matrix: at(0, 1.28, 0) },
        ...plaque(0, 0.84, 0.09),
      ];
    case "stack":
      return [
        { geometry: cylinder(0.49, 0.64, 0.18, 7), color: STONE_DARK, matrix: at(0, 0.09, 0) },
        { geometry: ico(), color: STONE_DARK, matrix: at(-0.03, 0.37, 0.01, 0.47, 0.31, 0.43) },
        { geometry: ico(), color: STONE, matrix: at(0.04, 0.78, -0.04, 0.36, 0.23, 0.30) },
        { geometry: ico(), color: STONE_DARK, matrix: at(-0.06, 1.07, 0.07, 0.26, 0.17, 0.25) },
        { geometry: ico(), color: MOSS, matrix: at(0.02, 1.31, 0, 0.17, 0.16, 0.17) },
        ...plaque(0.07, 0.54, 0.39),
      ];
    case "pairedStones":
      return [
        { geometry: ico(), color: STONE_DARK, matrix: at(0, 0.09, 0, 0.69, 0.24, 0.48) },
        block(STONE, 0.40, 1.40, 0.29, -0.29, 0.74, -0.02),
        block(STONE_DARK, 0.34, 1.04, 0.34, 0.27, 0.55, 0.055),
        block(PARCHMENT, 0.83, 0.071, 0.075, 0, 0.72, 0.24),
        ...incisions(-0.29, 1.03, 0.13, 2, 0.09),
        ...incisions(0.27, 0.90, 0.23, 2, 0.09),
      ];
  }
}

const cache = new Map<string, Part[]>();
const place = new THREE.Matrix4();
const instance = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** Adds an inscription carrier to the chunk so it fades with its region. */
export function addMonument(builder: VitalityBuilder, m: Monument): void {
  const form = formOf(m);
  const key = form === "stone" ? m.kind : form;
  let parts = cache.get(key);
  if (!parts) {
    parts = isNewForm(form) ? RUBBING_FORMS[form].build() : variants(form, m.kind);
    cache.set(key, parts);
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
