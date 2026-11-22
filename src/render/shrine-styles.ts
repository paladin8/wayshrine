import { SHRINE_PILLAR_OFFSET, type Biome } from "../world";
import { palette } from "./palette";

type TimberEnd = readonly [number, number, number];

export interface ShrineParts {
  box(width: number, height: number, depth: number, color: number, x: number, y: number, z: number, pitch?: number): void;
  round(top: number, bottom: number, height: number, sides: number, color: number, x: number, y: number, z: number): void;
  timber(start: TimberEnd, end: TimberEnd, width: number, depth: number, color: number): void;
}

const POSTS = [-SHRINE_PILLAR_OFFSET, SHRINE_PILLAR_OFFSET] as const;
const IVORY = 0xe3d6ac;
const VERMILION = 0xa74838;
const INK = 0x383530;

export function modelShrine(biome: Biome, p: ShrineParts): void {
  const { box, round } = p;

  switch (biome) {
    case "meadow":
      round(1.49, 1.66, 0.18, 8, palette.rock, 0, 0.08, 0);
      for (const x of POSTS) round(0.13, 0.16, 2.38, 6, palette.red, x, 1.34, 0);
      box(2.40, 0.16, 0.20, palette.red, 0, 2.04, 0);
      beamEnds(p, 2.62, 0.21, 0.35, 0.27, 0.10, palette.roof);
      return;

    case "water":
      // A cedar dock held just above the lake by piles sunk into the water.
      deck(p, 0xa78765, 0xc6a583, 0.39);
      for (const x of POSTS) {
        for (const z of [-0.67, 0.79]) {
          round(0.12, 0.14, 1.16, 6, 0x716753, x, -0.09, z);
          round(0.15, 0.15, 0.08, 6, 0x515e56, x, 0.15, z);
        }
        round(0.13, 0.17, 2.03, 6, 0x896847, x, 1.53, 0);
        round(0.178, 0.178, 0.09, 6, 0x5c6258, x, 0.69, 0);
        box(0.24, 0.22, 0.23, IVORY, x, 0.64, 0.79);
        box(0.29, 0.06, 0.27, 0x817460, x, 0.78, 0.79);
        round(0.145, 0.145, 0.08, 6, 0xd3aa6c, x, 2.08, 0);
      }
      box(2.28, 0.16, 0.24, 0x987955, 0, 1.95, 0);
      box(2.91, 0.18, 0.43, 0xad8d64, 0, 2.44, 0);
      box(1.16, 0.07, 0.24, 0x817460, 0, 2.55, 0);
      paper(p, 2.0, IVORY);
      return;

    case "snow":
      // A steeper roof sheds snow and shelters a blue-painted lintel.
      round(1.47, 1.63, 0.20, 8, 0x91a4aa, 0, 0.09, 0);
      for (const x of POSTS) {
        box(0.31, 2.20, 0.28, 0x64859a, x, 1.23, 0);
        box(0.37, 0.31, 0.35, 0xa6b8bc, x, 0.28, 0);
      }
      box(2.28, 0.16, 0.27, 0x8da2ad, 0, 2.05, 0);
      gable(p, 2.36, 0.67, 3.03, 2.95, 0x536874, 0xe7eef0);
      return;

    case "mountain":
      // Square dressed granite, with a heavy cap and a small bronze tablet.
      round(1.56, 1.69, 0.17, 8, 0x777975, 0, 0.075, 0);
      for (const x of POSTS) {
        for (let i = 0; i < 3; i++) box(0.39 - i * 0.035, 0.70, 0.32, i === 1 ? 0x9c9d93 : 0x858781, x, 0.51 + i * 0.73, 0);
        box(0.38, 0.16, 0.38, 0xb2ada0, x, 2.32, 0);
      }
      box(2.36, 0.18, 0.34, 0x85847c, 0, 1.96, 0);
      box(2.62, 0.27, 0.46, 0x828783, 0, 2.50, 0);
      box(2.29, 0.11, 0.39, 0xbbbaaa, 0, 2.69, 0);
      box(0.29, 0.27, 0.075, 0xb88959, 0, 2.35, 0.26);
      return;

    case "marsh":
      // Low rush shelter lashed to a boardwalk, with hanging paper above the passage.
      deck(p, 0x67634a, 0x898060);
      for (const x of POSTS) {
        round(0.10, 0.155, 2.19, 5, 0x72634c, x, 1.22, 0);
        round(0.17, 0.17, 0.12, 5, 0x4d674d, x, 0.27, 0);
      }
      box(2.30, 0.13, 0.19, 0x9b8760, 0, 1.91, 0);
      gable(p, 2.24, 0.83, 2.30, 2.94, 0x707958, 0x949367);
      paper(p, 1.90, IVORY);
      return;

    case "forest":
      // A high cedar gate with moss flashing and warm paper at the shaded opening.
      round(1.42, 1.57, 0.16, 8, 0x66735d, 0, 0.07, 0);
      for (const x of POSTS) {
        round(0.15, 0.19, 2.66, 6, 0x584537, x, 1.43, 0);
        box(0.35, 0.21, 0.34, 0x716150, x, 2.45, 0);
      }
      box(2.46, 0.18, 0.27, 0x825c47, 0, 2.14, 0);
      gable(p, 2.70, 0.56, 2.99, 3.14, 0x3d6557, 0x658165);
      paper(p, 2.13, 0xe6d696);
      return;

    case "volcanic":
      // Rough basalt columns and a forged, copper-colored beam.
      round(1.39, 1.56, 0.20, 6, 0x51474a, 0, 0.09, 0);
      for (const x of POSTS) {
        round(0.16, 0.20, 2.44, 6, 0x433b3e, x, 1.35, 0);
        round(0.174, 0.183, 0.11, 6, 0xb16140, x, 1.92, 0);
      }
      box(2.22, 0.18, 0.27, 0x9c593c, 0, 2.00, 0);
      box(2.57, 0.20, 0.53, 0x4b4145, 0, 2.56, 0);
      box(2.91, 0.13, 0.41, 0x635054, 0, 2.72, 0);
      box(1.70, 0.08, 0.25, 0xc17b4d, 0, 2.83, 0);
      return;

    case "sea":
      // An offshore torii with submerged stone feet and a long swept cap.
      for (const x of POSTS) {
        round(0.134, 0.177, 2.79, 7, VERMILION, x, 1.51, 0);
        round(0.18, 0.21, 0.93, 7, 0x4c585b, x, -0.11, 0);
        round(0.204, 0.207, 0.09, 7, 0x667d72, x, 0.13, 0);
      }
      box(2.61, 0.18, 0.25, 0xc46b52, 0, 2.19, 0);
      beamEnds(p, 2.82, 0.25, 0.43, 0.53, 0.25, 0x414b50);
      beamEnds(p, 2.97, 0.065, 0.34, 0.50, 0.23, 0xe4c9a7);
      box(0.31, 0.33, 0.13, 0x7c4235, 0, 2.42, 0.14);
      return;

    case "dunes":
      round(1.51, 1.64, 0.18, 8, 0xad9475, 0, 0.08, 0);
      for (const x of POSTS) round(0.13, 0.18, 2.27, 6, 0x997a57, x, 1.26, 0);
      box(2.43, 0.18, 0.26, 0xb79770, 0, 1.99, 0);
      beamEnds(p, 2.47, 0.20, 0.35, 0.33, 0.18, INK);
      paper(p, 1.99, 0xe7cfad);
  }
}

function deck({ box }: ShrineParts, edge: number, plank: number, height = 0): void {
  box(2.73, 0.10, 2.07, edge, 0, height + 0.05, 0.12);
  for (let i = -3; i <= 3; i++) box(2.65, 0.075, 0.263, plank, 0, height + 0.128, i * 0.281 + 0.12);
}

function beamEnds({ box, timber }: ShrineParts, y: number, h: number, depth: number, tip: number, lift: number, color: number): void {
  box(2.27, h, depth, color, 0, y, 0);
  for (const side of [-1, 1]) timber([side * 1.10, y, 0], [side * (1.10 + tip), y + lift, 0], h, depth, color);
}

function gable({ box }: ShrineParts, eaves: number, rise: number, ridge: number, width: number, dark: number, top: number): void {
  const run = 0.78;
  const pitch = Math.atan2(rise, run);
  const slope = Math.hypot(rise, run);
  for (const side of [-1, 1]) {
    const y = (eaves + ridge) / 2;
    box(width, 0.13, slope, dark, 0, y, side * run * 0.48, side * pitch);
    box(width * 0.96, 0.055, slope * 0.97, top, 0, y + 0.077, side * run * 0.48, side * pitch);
    box(width + 0.045, 0.11, 0.11, dark, 0, eaves, side * run);
  }
  box(width + 0.13, 0.16, 0.23, dark, 0, ridge + 0.015, 0);
}

function paper({ box, timber }: ShrineParts, y: number, color: number): void {
  for (const side of [-1, 1]) {
    timber([side * 0.86, y - 0.01, 0.13], [0, y - 0.16, 0.13], 0.047, 0.048, 0x9c8057);
    box(0.095, 0.19, 0.042, color, side * 0.55, y - 0.15, 0.14, side * 0.13);
  }
}
