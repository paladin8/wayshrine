import type { Biome } from "../world";

export interface BirdForm {
  readonly body: number;
  readonly wings: number;
  readonly head: number;
  readonly beak: number;
  readonly span: number;
  readonly size: number;
  readonly tail: number;
  readonly bill: number;
  readonly speed: number;
  readonly altitude: number;
  readonly cadence: number;
  readonly orbit: number;
  readonly glide: number;
}

export const BIRD_FORMS = {
  "barn swallow": { body: 0x344853, wings: 0x313a47, head: 0x995c49, beak: 0x50483e, span: 0.83, size: 0.82, tail: 1.42, bill: 0.50, speed: 1.75, altitude: 1.50, cadence: 33, orbit: 4.4, glide: 0.17 },
  "white wagtail": { body: 0xd7d9cb, wings: 0x666c6b, head: 0x343e46, beak: 0x635e52, span: 0.76, size: 0.80, tail: 1.18, bill: 0.52, speed: 1.45, altitude: 0.75, cadence: 30, orbit: 2.7, glide: 0.12 },
  "Japanese white-eye": { body: 0x849b5a, wings: 0x687f50, head: 0xb0aa68, beak: 0x666247, span: 0.74, size: 0.73, tail: 0.63, bill: 0.55, speed: 1.10, altitude: 1.12, cadence: 28, orbit: 2.2, glide: 0.19 },
  "varied tit": { body: 0xb08364, wings: 0x535b67, head: 0x3e4649, beak: 0xe0d7ac, span: 0.75, size: 0.82, tail: 0.76, bill: 0.48, speed: 1.21, altitude: 1.45, cadence: 33, orbit: 3.1, glide: 0.14 },
  "egret": { body: 0xe0decf, wings: 0xeae9d4, head: 0xe5ded2, beak: 0xc2a15d, span: 1.48, size: 1.41, tail: 0.63, bill: 1.36, speed: 0.50, altitude: 2.15, cadence: 11, orbit: 4.1, glide: 0.40 },
  "kingfisher": { body: 0xb27551, wings: 0x487f8b, head: 0x52949a, beak: 0x525348, span: 0.72, size: 0.84, tail: 0.50, bill: 1.28, speed: 1.93, altitude: 0.67, cadence: 36, orbit: 3.2, glide: 0.15 },
  "mountain hawk": { body: 0x8e7359, wings: 0x695748, head: 0xb79e7f, beak: 0xa48c59, span: 1.52, size: 1.30, tail: 1.22, bill: 0.78, speed: 0.61, altitude: 3.50, cadence: 12, orbit: 6.5, glide: 0.89 },
  "black-tailed gull": { body: 0xd9ddd6, wings: 0xa8b5b6, head: 0xe7e9db, beak: 0xd6aa6b, span: 1.32, size: 1.20, tail: 0.80, bill: 1.03, speed: 0.84, altitude: 2.52, cadence: 15, orbit: 5.7, glide: 0.66 },
} satisfies Readonly<Record<string, BirdForm>>;

export interface FishForm {
  readonly body: number;
  readonly fins: number;
  readonly length: number;
  readonly width: number;
  readonly depth: number;
  readonly tail: number;
  readonly speed: number;
  readonly orbit: number;
  readonly dart: number;
  readonly surfacing: number;
  readonly school: number;
}

export const FISH_FORMS = {
  "koi": { body: 0xd6ad8a, fins: 0xce8459, length: 1.22, width: 1.18, depth: 1.04, tail: 1.15, speed: 0.60, orbit: 1.9, dart: 0.08, surfacing: 0.52, school: 3 },
  "crucian carp": { body: 0xa69d75, fins: 0x81805f, length: 0.96, width: 1.32, depth: 1.21, tail: 0.91, speed: 0.53, orbit: 1.58, dart: 0.11, surfacing: 0.42, school: 3 },
  "ayu": { body: 0xb6c0a0, fins: 0x939678, length: 0.87, width: 0.63, depth: 0.60, tail: 0.65, speed: 1.28, orbit: 1.4, dart: 0.32, surfacing: 0.35, school: 4 },
  "trout": { body: 0x9fa7a3, fins: 0xc3a28e, length: 1.15, width: 0.83, depth: 0.82, tail: 0.83, speed: 1.23, orbit: 2.1, dart: 0.38, surfacing: 0.75, school: 2 },
  "sardines": { body: 0xb2c5c5, fins: 0x7c9ba0, length: 0.75, width: 0.59, depth: 0.70, tail: 0.72, speed: 1.48, orbit: 2.35, dart: 0.22, surfacing: 0.42, school: 5 },
  "mackerel": { body: 0x8ba5ac, fins: 0x536d7d, length: 1.24, width: 0.81, depth: 0.78, tail: 0.93, speed: 1.68, orbit: 2.75, dart: 0.48, surfacing: 0.37, school: 3 },
  "young sea bream": { body: 0xbb9b8b, fins: 0x876e74, length: 0.94, width: 1.18, depth: 1.50, tail: 0.85, speed: 0.69, orbit: 2.05, dart: 0.10, surfacing: 0.30, school: 3 },
  "flying fish": { body: 0x8ca7af, fins: 0x96b1be, length: 1.13, width: 0.65, depth: 0.65, tail: 1.19, speed: 1.52, orbit: 3.05, dart: 0.42, surfacing: 1.0, school: 3 },
} satisfies Readonly<Record<string, FishForm>>;

const b = BIRD_FORMS;
export const BIRDS_BY_BIOME: Readonly<Record<Biome, readonly BirdForm[]>> = {
  meadow: [b["barn swallow"], b["white wagtail"], b["Japanese white-eye"], b["varied tit"]],
  forest: [b["Japanese white-eye"], b["varied tit"], b["varied tit"]],
  snow: [b["varied tit"], b["mountain hawk"], b["white wagtail"]],
  mountain: [b["mountain hawk"], b["mountain hawk"], b["white wagtail"]],
  volcanic: [b["mountain hawk"], b["white wagtail"]],
  marsh: [b.egret, b.kingfisher, b["white wagtail"]],
  water: [b.kingfisher, b.egret, b["barn swallow"]],
  sea: [b["black-tailed gull"], b["black-tailed gull"], b.egret],
  dunes: [b["white wagtail"], b["black-tailed gull"]],
};

export const LAKE_FISH: readonly FishForm[] = [FISH_FORMS.koi, FISH_FORMS["crucian carp"], FISH_FORMS.ayu, FISH_FORMS.trout];
export const SEA_FISH: readonly FishForm[] = [FISH_FORMS.sardines, FISH_FORMS.mackerel, FISH_FORMS["young sea bream"], FISH_FORMS["flying fish"]];
