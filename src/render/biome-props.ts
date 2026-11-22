import * as THREE from "three";
import type { Biome, PropKind } from "../world";
import { at, cone, cylinder, ico, type Part } from "./shapes";

const branchGeometry = cylinder(0.062, 0.10, 1, 5);
const crownGeometry = ico();
const cedarGeometry = cone(1, 1, 7);
const pillarGeometry = cylinder(0.76, 1, 1, 6);
const stoneGeometry = new THREE.DodecahedronGeometry(1, 0);

function bough(x: number, y: number, z: number, ex: number, ey: number, ez: number, color: number): Part {
  const from = new THREE.Vector3(x, y, z);
  const to = new THREE.Vector3(ex, ey, ez);
  const direction = to.clone().sub(from);
  const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return { geometry: branchGeometry, color, matrix: new THREE.Matrix4().compose(from.lerp(to, 0.5), turn, new THREE.Vector3(1, direction.length(), 1)) };
}

function cedar(variant: number): Part[] {
  const h = [2.95, 4.28, 2.65, 3.32][variant]!;
  const parts: Part[] = [{ geometry: pillarGeometry, color: 0x51463c, matrix: at(0, h * 0.37, 0, 0.15, h * 0.74, 0.125) }];
  const palette = [0x284a3b, 0x375742, 0x426347, 0x547052];
  for (let i = 0; i < 4; i++) {
    const y = h * (0.48 + i * 0.132);
    const width = [0.82, 0.66, 0.52, 0.34][i]! * (variant === 2 ? 1.3 : 1);
    const geometry = variant === 2 ? crownGeometry : cedarGeometry;
    parts.push({ geometry, color: palette[(variant + i) % palette.length]!, matrix: at(i * 0.044 - 0.10, y, Math.sin(i) * 0.16, width, h * (variant === 2 ? 0.14 : 0.35), width * 0.88) });
  }
  if (variant === 1 || variant === 3) {
    parts.push(bough(0, h * 0.40, 0, 0.52, h * 0.53, -0.25, 0x55493e));
    parts.push({ geometry: crownGeometry, color: 0x315642, matrix: at(0.52, h * 0.55, -0.25, 0.56, 0.26, 0.48) });
  }
  return parts;
}

function wetShrub(variant: number): Part[] {
  const h = [0.76, 0.96, 0.68, 1.13][variant]!;
  return [-1, 0, 1].flatMap((side, i) => {
    const x = side * 0.19;
    const y = h * (1 - Math.abs(side) * 0.22);
    const stem = bough(x * 0.3, 0, i * -0.08, x * 1.4, y, i * -0.08, 0x65754b);
    return [stem, { geometry: crownGeometry, color: i % 2 ? 0x997349 : 0x755537, matrix: at(x * 1.4, y, i * -0.08, 0.055, 0.14, 0.055) }];
  });
}

function basalt(variant: number, tall: boolean): Part[] {
  const h = (tall ? 1.38 : 0.52) * [0.85, 1.38, 0.72, 1.11][variant]!;
  return [
    { geometry: pillarGeometry, color: [0x433b43, 0x514449, 0x38383f, 0x52454a][variant]!, matrix: at(0, h / 2, 0, 0.32, h, 0.31) },
    { geometry: pillarGeometry, color: 0x695251, matrix: at(-0.25, h * 0.33, 0.18, 0.18, h * 0.66, 0.19) },
    { geometry: stoneGeometry, color: 0x79605b, matrix: at(0.22, h * 0.15, -0.21, 0.2, h * 0.23, 0.22) },
  ];
}

function shoreTree(variant: number, ocean: boolean): Part[] {
  const h = (ocean ? 1.15 : 1.37) + variant * 0.13;
  const bend = ocean ? 0.38 : 0.28;
  const lower = bough(0, 0, 0, bend * 0.65, h * 0.63, 0.07, ocean ? 0x5d554a : 0x77624a);
  const upper = bough(bend * 0.65, h * 0.63, 0.07, bend * 1.4, h, 0.14, 0x5e5944);
  return [
    lower, upper,
    { geometry: crownGeometry, color: ocean ? 0x3b6556 : 0x779555, matrix: at(bend * 1.3, h * 0.99, 0.14, 0.69, ocean ? 0.23 : 0.38, 0.55) },
    { geometry: crownGeometry, color: ocean ? 0x537b60 : 0x8da66e, matrix: at(bend * 2.3, h * 1.05, 0.07, 0.54, 0.21, 0.39) },
  ];
}

export function biomePropLook(biome: Biome, kind: PropKind): string {
  if ((biome === "water" || biome === "sea") && kind === "tree") return biome === "sea" ? "shore-pine" : "willow";
  if (biome === "water" && kind === "bush") return "cattail";
  if (biome === "forest" && kind === "tree") return "cedar";
  if (biome === "marsh" && kind === "bush") return "cattail";
  if (biome === "volcanic" && (kind === "crag" || kind === "rock")) return kind === "crag" ? "basalt-stack" : "basalt";
  if (biome === "mountain" && kind === "crag") return "slate";
  return kind;
}

export function biomePropParts(look: string, variant: number): Part[] | undefined {
  switch (look) {
    case "shore-pine": return shoreTree(variant, true);
    case "willow": return shoreTree(variant, false);
    case "cedar": return cedar(variant);
    case "cattail": return wetShrub(variant);
    case "basalt-stack": return basalt(variant, true);
    case "basalt": return basalt(variant, false);
    case "slate": return [
      { geometry: stoneGeometry, color: 0x837d77, matrix: at(0, 0.45, 0, 0.43, 0.60 + variant * 0.11, 0.25) },
      { geometry: stoneGeometry, color: 0xa69b8c, matrix: at(0.14, 0.74, -0.04, 0.26, 0.25, 0.22) },
    ];
  }
  return undefined;
}
