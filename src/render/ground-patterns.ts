import { Color } from "three";
import type { Biome } from "../world";

type Field = (u: number, v: number, n: number) => number;
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
const lobe = (u: number, v: number, width: number): number => clamp(1 - Math.hypot(u, v) / width) ** 1.4;
const trace = (v: number, width: number): number => clamp(1 - Math.abs(v) / width) ** 1.6;
const band = (x: number): number => (1 + Math.sin(x)) / 2;

interface ColorField {
  readonly color: Color;
  readonly strength: number;
  readonly field: Field;
}

function tint(hex: number, strength: number, field: Field): ColorField {
  return { color: new Color(hex), strength, field };
}

export const WATER_PATTERNS = {
  "glacial basin": tint(0x224e69, 0.75, (u, v, n) => lobe(u * 0.7, v * 0.93, 1.65 + n * 0.24)),
  "braided sand channels": tint(0x9cbfa9, 0.55, (u, v, n) => Math.max(trace(v - Math.sin(u * 1.9) * 0.36, 0.43), trace(v + 0.78 + Math.sin(u * 2.2) * 0.32, 0.29)) * n),
  "reedy shallows": tint(0x79a689, 0.61, (u, v, n) => lobe(u * 0.55, v + 0.48, 1.22) * clamp(n * 1.65 - 0.25)),
  "spring-fed lake": tint(0x84d0bc, 0.49, (u, v, n) => band(Math.hypot(u * 0.7, v) * 5 + n * 2) ** 4 * lobe(u, v, 2.5)),
  "offshore trench": tint(0x152e5b, 0.79, (u, v, n) => trace(v + 0.67 * Math.sin(u * 1.1), 0.80 + n * 0.48)),
  "tidal shelf": tint(0x5caaa1, 0.62, (u, v, n) => trace(v - 0.16 * Math.sin(u * 3), 1.1) * (0.58 + 0.42 * band(v * 13 + u * 0.4 + n))),
  "kelp reef": tint(0x346c62, 0.68, (u, v, n) => clamp((n - 0.38) * 2.1) * band(v * 5.4 + u * 1.3 + n * 2) ** 1.5),
  "sand-wave banks": tint(0x669eaa, 0.62, (u, v, n) => band(v * 10 + Math.sin(u * 2) * 2 + n * 3) ** 3 * lobe(u * 0.6, v, 2.2)),
};

export const GROUND_PATTERNS = {
  "dry grass ribbons": tint(0xb8aa60, 0.40, (u, v, n) => trace(v + Math.sin(u * 1.25) * 0.75, 0.8) * n),
  "old meadow channel": tint(0x587d64, 0.55, (u, v, n) => trace(v - Math.sin(u * 2.3) * 0.44, 0.59 + n * 0.21)),
  "moss carpets": tint(0x718950, 0.36, (u, v, n) => clamp((n - 0.39) * 2.3) * band(u * 4 + Math.sin(v * 2.5))),
  "cedar needle floor": tint(0x76664b, 0.44, (u, v, n) => band(v * 7 + Math.sin(u * 0.8) * 3) ** 3 * clamp((0.68 - n) * 2.1)),
  "bog channels": tint(0x435e57, 0.50, (u, v, n) => trace(v - Math.sin(u * 2.5) * 0.37, 0.43) * (0.5 + n * 0.5)),
  "iron seep": tint(0xa78353, 0.48, (u, v, n) => lobe(u, v - 0.3, 1.8) * band(u * 8 - v * 4 + n * 3)),
  "wind-scoured snow": tint(0x9fb4c5, 0.61, (u, v, n) => band(v * 8 + Math.sin(u * 1.4) * 2) ** 3 * clamp(1.19 - n)),
  "blue ice line": tint(0x85b8cb, 0.55, (u, v, n) => trace(v + Math.sin(u * 1.4) * 0.45, 0.39 + n * 0.31)),
  "slate strata": tint(0x626777, 0.54, (u, v, n) => band((v + u * 0.16) * 12 + n * 2) ** 4 * (0.45 + n * 0.55)),
  "pumice fan": tint(0x997665, 0.53, (u, v, n) => trace(v / (1.22 + u * u), 0.70) * band(u * 3.5 + n * 2.8)),
  "sulfur veins": tint(0xa48a54, 0.57, (u, v, n) => trace(v - Math.sin(u * 2.1) * 0.47 + n * 0.45, 0.30) * (0.5 + n * 0.5)),
  "sand slipfaces": tint(0xa88554, 0.43, (u, v, n) => band(v * 8.5 + u * 0.5 + Math.sin(u * 1.8) * 2 + n * 1.1) ** 5),
};

export const PATTERNS_BY_BIOME: Readonly<Record<Biome, readonly ColorField[]>> = {
  meadow: [GROUND_PATTERNS["dry grass ribbons"], GROUND_PATTERNS["old meadow channel"]],
  forest: [GROUND_PATTERNS["moss carpets"], GROUND_PATTERNS["cedar needle floor"]],
  marsh: [GROUND_PATTERNS["bog channels"], GROUND_PATTERNS["iron seep"]],
  snow: [GROUND_PATTERNS["wind-scoured snow"], GROUND_PATTERNS["blue ice line"]],
  mountain: [GROUND_PATTERNS["slate strata"], GROUND_PATTERNS["pumice fan"]],
  volcanic: [GROUND_PATTERNS["pumice fan"], GROUND_PATTERNS["sulfur veins"]],
  dunes: [GROUND_PATTERNS["sand slipfaces"]],
  water: [WATER_PATTERNS["glacial basin"], WATER_PATTERNS["braided sand channels"], WATER_PATTERNS["reedy shallows"], WATER_PATTERNS["spring-fed lake"]],
  sea: [WATER_PATTERNS["offshore trench"], WATER_PATTERNS["tidal shelf"], WATER_PATTERNS["kelp reef"], WATER_PATTERNS["sand-wave banks"]],
};
