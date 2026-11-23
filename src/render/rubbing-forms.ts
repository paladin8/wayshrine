import * as THREE from "three";
import { at, box, cone, cylinder, ico, type Part } from "./shapes";

const stone = 0xb4aea3;
const gray = 0x7e8179;
const moss = 0x78875a;
const bark = 0x816345;
const darkWood = 0x5a4738;
const iron = 0x4b504d;
const brass = 0xaa9364;
const paper = 0xdcc59b;
const ink = 0x51433c;

type Block = (color: number, w: number, h: number, d: number, x: number, y: number, z: number) => Part;
export const block: Block = (color, w, h, d, x, y, z) => ({
  geometry: box(w, h, d), color, matrix: at(x, y, z),
});

export function incisions(x: number, y: number, z: number, columns: number, spacing = 0.105): Part[] {
  const marks: Part[] = [];
  for (let column = 0; column < columns; column++) {
    const cx = x + (column - (columns - 1) / 2) * spacing;
    for (let row = 0; row < 3; row++) {
      marks.push(block(ink, 0.051 - ((column + row) % 3) * 0.01, 0.017, 0.01, cx, y + (1 - row) * 0.085, z));
    }
  }
  return marks;
}

function panel(x: number, y: number, z: number, width: number, border: number, face = paper, columns = 4): Part[] {
  return [
    block(border, width + 0.10, 0.44, 0.075, x, y, z),
    block(face, width, 0.35, 0.018, x, y, z + 0.044),
    ...incisions(x, y, z + 0.056, columns),
  ];
}

function round(radius: number, height: number, color: number, x: number, y: number, z: number, sides = 7): Part {
  return { geometry: cylinder(radius, radius * 1.10, height, sides), color, matrix: at(x, y, z) };
}

function facet(x: number, y: number, z: number, w: number, h: number, d: number, color: number): Part {
  return { geometry: ico(), color, matrix: at(x, y, z, w, h, d) };
}

function tilt(part: Part, z: number): Part {
  part.matrix.multiply(new THREE.Matrix4().makeRotationZ(z));
  return part;
}

function roof(w: number, y: number, color: number): Part {
  return { geometry: cone(w, 0.38, 4), color, matrix: at(0, y, 0, 1, 1, 0.76).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)) };
}

interface RubbingForm {
  readonly glow: number;
  readonly build: () => Part[];
}

/** Wear marks, inscriptions and bases are legible at the normal camera distance. */
export const RUBBING_FORMS = {
  "stone lantern pedestal": { glow: 2.36, build: () => [
    round(0.48, 0.16, gray, 0, 0.08, 0, 8), round(0.19, 1.09, stone, 0, 0.70, 0, 6),
    block(gray, 0.58, 0.11, 0.51, 0, 1.22, 0),
    block(stone, 0.47, 0.36, 0.45, 0, 1.45, 0),
    block(0x72624c, 0.23, 0.20, 0.014, 0, 1.44, 0.23),
    ...incisions(0, 1.45, 0.242, 2),
    roof(0.53, 1.78, gray),
    facet(0, 1.99, 0, 0.11, 0.13, 0.10, stone),
  ] },
  "forked driftwood": { glow: 2.19, build: () => [
    round(0.16, 1.55, 0x8e785f, -0.20, 0.80, -0.02, 6),
    tilt(round(0.10, 1.35, bark, 0.04, 0.75, -0.02, 6), -0.33),
    tilt(round(0.079, 0.78, 0x9e8b73, -0.41, 1.12, 0.04, 5), 0.51),
    round(0.21, 0.057, brass, -0.20, 1.24, 0, 8),
    facet(0.42, 0.10, 0.22, 0.33, 0.15, 0.22, gray),
    ...panel(-0.03, 0.97, 0.14, 0.52, darkWood),
  ] },
  "bronze mirror": { glow: 2.05, build: () => [
    round(0.52, 0.20, gray, 0, 0.10, 0, 8),
    block(darkWood, 0.16, 1.31, 0.21, 0, 0.81, -0.08),
    ...[0.40, 0.29, 0.22].map((radius, i) => ({
      geometry: cylinder(radius, radius, 0.065, 12),
      color: [brass, 0x6b7967, 0xbcb18a][i]!,
      matrix: at(0, 1.35, 0.016 + i * 0.037).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
    })),
    ...incisions(0, 1.34, 0.13, 3),
    ...panel(0, 0.52, 0.07, 0.47, bark),
  ] },
  "slate waymark": { glow: 1.85, build: () => [
    facet(0.02, 0.11, 0, 0.72, 0.19, 0.51, gray),
    tilt(block(0x737986, 0.69, 1.18, 0.17, -0.11, 0.68, -0.03), -0.14),
    tilt(block(0x9b9e9b, 0.42, 0.40, 0.034, -0.10, 0.87, 0.065), -0.14),
    tilt(block(gray, 0.24, 0.64, 0.29, 0.37, 0.34, 0.03), 0.17),
    ...incisions(-0.10, 0.87, 0.089, 3),
    facet(0.22, 0.19, 0.32, 0.23, 0.088, 0.15, moss),
  ] },
  "pilgrim's chest": { glow: 1.61, build: () => [
    block(gray, 1.11, 0.17, 0.78, 0, 0.085, 0), block(bark, 0.91, 0.56, 0.58, 0, 0.44, 0),
    block(darkWood, 0.97, 0.12, 0.62, 0, 0.75, 0), block(brass, 0.19, 0.19, 0.06, 0, 0.64, 0.31),
    ...[-0.31, 0.31].flatMap((x) => [
      block(iron, 0.066, 0.53, 0.025, x, 0.45, 0.30),
      block(iron, 0.066, 0.02, 0.59, x, 0.819, 0),
    ]),
    ...panel(0, 0.41, 0.29, 0.50, darkWood),
  ] },
  "votive rack": { glow: 2.31, build: () => [
    ...[-0.56, 0.56].flatMap((x) => [
      round(0.19, 0.15, gray, x, 0.075, 0, 6),
      block(bark, 0.12, 1.75, 0.14, x, 0.96, 0),
    ]),
    block(darkWood, 1.31, 0.08, 0.17, 0, 1.55, 0), block(darkWood, 1.29, 0.075, 0.15, 0, 1.04, 0),
    roof(0.76, 1.87, 0x66685e),
    ...[-0.36, 0.04, 0.39].flatMap((x, i) => [
      block(brass, 0.025, 0.19, 0.02, x, 1.41, 0.105),
      ...panel(x, 1.21 - (i % 2) * 0.11, 0.10, 0.235, bark, paper, 2),
    ]),
  ] },
  "split basalt rune": { glow: 2.26, build: () => [
    round(0.53, 0.15, gray, 0, 0.08, 0, 6),
    tilt(round(0.28, 1.60, 0x5a5459, -0.26, 0.86, 0.04, 6), 0.10),
    tilt(round(0.22, 1.13, 0x6d5657, 0.32, 0.63, -0.07, 6), -0.16),
    round(0.15, 0.63, 0x665d5d, 0.04, 0.39, -0.22, 7),
    facet(0.16, 0.19, 0.34, 0.30, 0.15, 0.20, 0x8d6b59),
    ...panel(-0.12, 1.04, 0.30, 0.56, iron, stone),
  ] },
  "inscribed earthenware": { glow: 1.80, build: () => [
    round(0.56, 0.14, gray, 0, 0.07, 0, 8),
    { geometry: new THREE.LatheGeometry([[0.29, 0.14], [0.44, 0.28], [0.48, 0.57], [0.35, 0.88], [0.26, 1.08]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 10), color: 0xa77558, matrix: at(0, 0, 0) },
    round(0.31, 0.08, 0x855e4b, 0, 1.12, 0, 10),
    round(0.48, 0.053, 0x7a8e85, 0, 0.58, 0, 10),
    round(0.29, 0.046, 0x839385, 0, 1.02, 0, 10),
    ...panel(0, 0.70, 0.44, 0.54, bark, 0xe0c9a5),
  ] },
  "sacred root": { glow: 2.45, build: () => [
    tilt(round(0.28, 1.79, 0x6c5949, -0.12, 0.97, 0.03, 6), -0.10),
    ...[-0.9, 0.07, 0.96].map((angle) => {
      const x = 0.57 * Math.sin(angle), z = 0.53 * Math.cos(angle);
      return facet(x, 0.19, z, 0.34, 0.30, 0.39, bark);
    }),
    facet(-0.36, 1.77, -0.08, 0.54, 0.31, 0.46, moss),
    round(0.34, 0.06, brass, -0.1, 1.49, 0.035, 9),
    ...panel(0, 0.96, 0.30, 0.55, darkWood),
    ...[-0.32, 0.19].map((x) => tilt(block(0xe8dbbf, 0.075, 0.23, 0.024, x, 1.34, 0.29), 0.32)),
  ] },
  "net mender's post": { glow: 2.36, build: () => [
    facet(0, 0.12, 0, 0.53, 0.19, 0.46, stone),
    block(bark, 0.16, 1.79, 0.18, 0, 0.96, 0),
    tilt(block(darkWood, 1.25, 0.12, 0.16, 0.05, 1.70, 0), 0.087),
    ...[-0.47, -0.30, 0.33, 0.50].map((x, i) => block(brass, 0.031, 0.43 + i * 0.11, 0.032, x, 1.40 - i * 0.055, 0.04)),
    ...[1.14, 1.29, 1.47].map((y, i) => tilt(block(brass, 0.44 - i * 0.024, 0.026, 0.02, 0.40, y, 0.06), -0.23)),
    ...panel(-0.16, 0.97, 0.13, 0.48, darkWood),
  ] },
  "folded stone screen": { glow: 1.95, build: () => [
    block(gray, 1.40, 0.16, 0.83, 0, 0.08, 0),
    ...[-0.47, 0, 0.47].flatMap((x, i) => [
      block(i === 1 ? stone : 0xa39b86, 0.41, 1.29 - Math.abs(x) * 0.76, 0.20, x, 0.74 - Math.abs(x) * 0.38, i % 2 ? 0.105 : 0),
      block(brass, 0.35, 0.072, 0.23, x, 1.36 - Math.abs(x) * 0.76, i % 2 ? 0.105 : 0),
      ...incisions(x, 0.92 - Math.abs(x) * 0.39, i % 2 ? 0.212 : 0.109, 2, 0.11),
    ]),
  ] },
  "stone boundary lanterns": { glow: 1.84, build: () => [
    round(0.39, 0.13, gray, 0, 0.065, 0, 6),
    ...[-0.53, 0.53].flatMap((x, i) => [
      round(0.20, 0.69, gray, x, 0.38, -0.025, 5),
      block(paper, 0.23, 0.19, 0.23, x, 0.73 + i * 0.07, -0.025),
      round(0.22, 0.08, stone, x, 0.88 + i * 0.07, -0.025, 6),
    ]),
    block(stone, 0.77, 0.54, 0.18, 0, 0.61, 0.13),
    ...incisions(0, 0.64, 0.229, 5),
  ] },
} satisfies Readonly<Record<string, RubbingForm>>;
