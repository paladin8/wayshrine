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

/** How a hokora stands: on stone steps, on piles over a lake, on a boardwalk, or on a rock in the sea. */
type HokoraFooting = "steps" | "piles" | "boardwalk" | "rock";

interface HokoraStyle {
  readonly footing: HokoraFooting;
  /** The footing's two tones: lower and upper step, piles and deck, or rock and slab. */
  readonly foot: readonly [number, number];
  readonly body: number;
  readonly post: number;
  readonly door: number;
  /** The band above the doorway. */
  readonly trim: number;
  readonly roof: number;
  readonly ridge: number;
  /** Rise of each roof slope over its 0.44 run. */
  readonly rise: number;
  /** Roof thickness: thin shingles, thick thatch or a stone slab. */
  readonly thick: number;
  /** A layer of snow on the roof. */
  readonly snow?: number;
  /** Straw rope and paper streamers across the eaves, in the paper's colour. */
  readonly paper?: number;
}

/**
 * One hokora per biome, in the materials of that biome's gate, so a gate and its shrine read as a pair.
 * Roofs stay lighter than a gate's black cap where the two overlap on screen.
 */
const HOKORA_STYLES: Readonly<Record<Biome, HokoraStyle>> = {
  meadow: {
    footing: "steps", foot: [0x9a958c, 0xb3aea3], body: 0xa9784f, post: 0x7f5a3c, door: 0x3a2f2a, trim: palette.red,
    roof: 0x7d5b43, ridge: 0x5a4031, rise: 0.27, thick: 0.07, paper: IVORY,
  },
  water: {
    // Raised on piles beside the dock's cedar, like the gate it stands behind.
    footing: "piles", foot: [0x716753, 0xc6a583], body: 0xb08d66, post: 0x896847, door: 0x3d342c, trim: IVORY,
    roof: 0x987955, ridge: 0x6e5a42, rise: 0.25, thick: 0.07, paper: IVORY,
  },
  snow: {
    // Blue-grey timber and a steep roof that sheds snow, keeping a white cap.
    footing: "steps", foot: [0x91a4aa, 0xa6b8bc], body: 0x7d93a1, post: 0x536874, door: 0x2f3a42, trim: 0x8da2ad,
    roof: 0x536874, ridge: 0x45565f, rise: 0.42, thick: 0.08, snow: 0xe7eef0, paper: IVORY,
  },
  mountain: {
    // A stone hokora: dressed granite walls under one heavy slab, with a bronze band.
    footing: "steps", foot: [0x777975, 0x858781], body: 0x9c9d93, post: 0x858781, door: 0x3b3c3a, trim: 0xb88959,
    roof: 0x8d918b, ridge: 0x6f716d, rise: 0.16, thick: 0.14,
  },
  marsh: {
    // Weathered boards and a thick rush thatch, on a short boardwalk above the wet ground.
    footing: "boardwalk", foot: [0x67634a, 0x898060], body: 0x8a7a5c, post: 0x72634c, door: 0x3c3a2e, trim: IVORY,
    roof: 0x7d8560, ridge: 0x5a6146, rise: 0.34, thick: 0.12, paper: 0xd9c48a,
  },
  forest: {
    // Dark cedar with a moss-grown roof and warm paper, as at the forest gate.
    footing: "steps", foot: [0x66735d, 0x7d8a70], body: 0x6b5442, post: 0x584537, door: 0x2c241e, trim: 0xe6d696,
    roof: 0x4f7a68, ridge: 0x658165, rise: 0.30, thick: 0.08, paper: 0xe6d696,
  },
  volcanic: {
    // Basalt walls under a copper roof gone warm with heat.
    footing: "steps", foot: [0x51474a, 0x635054], body: 0x4b4145, post: 0x433b3e, door: 0x241f21, trim: 0xb16140,
    roof: 0x9c593c, ridge: 0xc17b4d, rise: 0.22, thick: 0.07,
  },
  sea: {
    // Vermilion like the offshore torii, set on a rock that stands out of the water.
    footing: "rock", foot: [0x4c585b, 0x667d72], body: VERMILION, post: 0x8f3a2e, door: 0x2d2523, trim: 0xe4c9a7,
    roof: 0x56636a, ridge: 0x414b50, rise: 0.27, thick: 0.07, paper: IVORY,
  },
  dunes: {
    footing: "steps", foot: [0xad9475, 0xc2a985], body: 0x997a57, post: 0x7d6346, door: 0x3a2f26, trim: 0xe7cfad,
    roof: 0x6e5641, ridge: INK, rise: 0.24, thick: 0.07, paper: 0xe7cfad,
  },
};

/** Authored scale of every hokora: about 1.4 to the ridge on steps. */
const HOKORA_SCALE = 1.15;

/**
 * A hokora: a small gabled shrine with its doorway facing +z (toward the gate), drawn at (x, z) in the
 * shrine's frame in the style of `biome`. Returns the height of its ridge, for placing the orb above it.
 */
export function modelHokora(biome: Biome, p: ShrineParts, x: number, z: number): number {
  const s = HOKORA_STYLES[biome];
  const at = shift(p, x, z, HOKORA_SCALE);
  const { box, round } = at;
  const [low, high] = s.foot;

  // The footing; `floor` is where the body stands.
  let floor: number;
  switch (s.footing) {
    case "steps":
      box(1.04, 0.24, 0.94, low, 0, 0.12, 0);
      box(0.86, 0.12, 0.78, high, 0, 0.30, 0);
      floor = 0.36;
      break;
    case "piles":
      // Level with the dock's deck, its piles running down into the lake.
      for (const sx of [-0.38, 0.38]) for (const sz of [-0.34, 0.34]) round(0.06, 0.07, 1.0, 6, low, sx, -0.08, sz);
      box(1.0, 0.08, 0.92, 0xa78765, 0, 0.42, 0);
      box(0.94, 0.05, 0.86, high, 0, 0.485, 0);
      floor = 0.51;
      break;
    case "boardwalk":
      for (const sx of [-0.4, 0.4]) for (const sz of [-0.36, 0.36]) round(0.05, 0.06, 0.3, 5, 0x4d674d, sx, 0.05, sz);
      box(1.02, 0.08, 0.94, low, 0, 0.2, 0);
      for (let i = -2; i <= 2; i++) box(0.96, 0.04, 0.17, high, 0, 0.25, i * 0.18);
      floor = 0.27;
      break;
    case "rock":
      round(0.6, 0.74, 1.0, 7, low, 0, -0.08, 0);
      box(0.92, 0.12, 0.84, high, 0, 0.48, 0);
      floor = 0.54;
      break;
  }

  // Body: walls, corner posts, a dark doorway and the band above it.
  box(0.60, 0.52, 0.50, s.body, 0, floor + 0.26, -0.02);
  for (const sx of [-0.3, 0.3]) for (const sz of [-0.25, 0.23]) box(0.07, 0.54, 0.07, s.post, sx, floor + 0.27, sz);
  box(0.30, 0.34, 0.02, s.door, 0, floor + 0.22, 0.235);
  box(0.36, 0.05, 0.03, s.trim, 0, floor + 0.41, 0.24);

  // Gabled roof, its ridge running across the front.
  const eaves = floor + 0.52;
  const run = 0.44;
  const pitch = Math.atan2(s.rise, run);
  const slope = Math.hypot(s.rise, run);
  for (const side of [-1, 1]) {
    const y = eaves + s.rise / 2 + s.thick / 2;
    box(0.88, s.thick, slope + 0.06, s.roof, 0, y, side * run * 0.5, side * pitch);
    if (s.snow !== undefined) box(0.82, 0.045, slope * 0.9, s.snow, 0, y + s.thick / 2 + 0.02, side * run * 0.47, side * pitch);
  }
  const ridge = eaves + s.rise + s.thick / 2 + 0.03;
  box(0.94, 0.07, 0.09, s.snow ?? s.ridge, 0, ridge, 0);

  if (s.paper !== undefined) {
    at.timber([-0.33, eaves - 0.02, 0.30], [0.33, eaves - 0.02, 0.30], 0.045, 0.045, 0xd9c48a);
    for (const sx of [-0.13, 0.13]) box(0.06, 0.13, 0.015, s.paper, sx, eaves - 0.11, 0.31);
  }
  return (ridge + 0.035) * HOKORA_SCALE;
}

/** The same parts, scaled by `k` about the origin and then moved to (x, z). */
function shift(p: ShrineParts, x: number, z: number, k = 1): ShrineParts {
  const at = (v: TimberEnd): TimberEnd => [v[0] * k + x, v[1] * k, v[2] * k + z];
  return {
    box: (w, h, d, color, bx, y, bz, pitch) => p.box(w * k, h * k, d * k, color, bx * k + x, y * k, bz * k + z, pitch),
    round: (top, bottom, h, sides, color, rx, y, rz) =>
      p.round(top * k, bottom * k, h * k, sides, color, rx * k + x, y * k, rz * k + z),
    timber: (start, end, w, d, color) => p.timber(at(start), at(end), w * k, d * k, color),
  };
}
