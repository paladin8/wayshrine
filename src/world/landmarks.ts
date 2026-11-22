import { createRng } from "../core";
import { regionId, type Point, type RegionCoord } from "./coords";
import { groundOf } from "./landmark-ground";
import { canTraverse, type Biome, type Capability } from "./terrain";
import type { Region } from "./world";

/**
 * Landmarks: hand-crafted places emblematic of Japan, one per special region.
 * Restoring them, not shrines, unlocks abilities (ADR 0006). The full list is
 * in docs/landmarks.md; the code holds the acts whose biomes exist.
 */
export interface LandmarkSpec {
  readonly id: string;
  /** 1-based act; acts are bands of landmarks that sit progressively farther out. */
  readonly act: number;
  /** The region's biome. It must be traversable with the abilities held when the act begins. */
  readonly biome: Biome;
}

export interface Landmark extends LandmarkSpec {
  /** 1-based position in the overall order. */
  readonly order: number;
}

export const LANDMARK_SPECS: readonly LandmarkSpec[] = [
  { id: "fushimi-inari", act: 1, biome: "meadow" },
  { id: "kinkaku-ji", act: 1, biome: "meadow" },
  { id: "todai-ji-daibutsu", act: 1, biome: "meadow" },
  { id: "itsukushima-torii", act: 2, biome: "water" },
  { id: "himeji-castle", act: 2, biome: "meadow" },
  { id: "kiyomizu-dera", act: 2, biome: "meadow" },
  { id: "meoto-iwa", act: 2, biome: "water" },
  { id: "enoshima-lighthouse", act: 2, biome: "water" },
  { id: "shirakawa-go", act: 3, biome: "snow" },
  { id: "matsumoto-castle", act: 3, biome: "meadow" },
  { id: "hirosaki-castle", act: 3, biome: "snow" },
  { id: "zao-juhyo", act: 3, biome: "snow" },
  { id: "kenroku-en", act: 3, biome: "snow" },
  { id: "mount-fuji", act: 4, biome: "mountain" },
  { id: "nikko-toshogu", act: 4, biome: "mountain" },
  { id: "kegon-falls", act: 4, biome: "mountain" },
  { id: "kappa-bashi", act: 4, biome: "mountain" },
  { id: "tateyama-kurobe", act: 4, biome: "mountain" },
  { id: "koyasan-okunoin", act: 4, biome: "mountain" },
  { id: "yoshino-yama", act: 4, biome: "meadow" },
  { id: "kushiro-shitsugen", act: 5, biome: "marsh" },
  { id: "oze", act: 5, biome: "marsh" },
  { id: "yanagawa", act: 5, biome: "marsh" },
  { id: "kurashiki-bikan", act: 5, biome: "marsh" },
  { id: "byodo-in", act: 5, biome: "water" },
  { id: "senso-ji", act: 5, biome: "meadow" },
  { id: "kamakura-daibutsu", act: 5, biome: "meadow" },
  { id: "tokyo-tower", act: 5, biome: "meadow" },
  { id: "osaka-castle", act: 5, biome: "meadow" },
  { id: "horyu-ji", act: 5, biome: "meadow" },
  { id: "jomon-sugi", act: 6, biome: "forest" },
  { id: "shiratani-unsuikyo", act: 6, biome: "forest" },
  { id: "arashiyama", act: 6, biome: "forest" },
  { id: "nachi-falls", act: 6, biome: "forest" },
  { id: "meiji-jingu", act: 6, biome: "forest" },
  { id: "ise-jingu", act: 6, biome: "forest" },
  { id: "izumo-taisha", act: 6, biome: "forest" },
  { id: "takachiho", act: 6, biome: "forest" },
  { id: "iya-kazurabashi", act: 6, biome: "forest" },
  { id: "ginkaku-ji", act: 6, biome: "meadow" },
  { id: "ryoan-ji", act: 6, biome: "meadow" },
  { id: "sakurajima", act: 7, biome: "volcanic" },
  { id: "mount-aso", act: 7, biome: "volcanic" },
  { id: "beppu-hells", act: 7, biome: "volcanic" },
  { id: "owakudani", act: 7, biome: "volcanic" },
  { id: "kumamoto-castle", act: 7, biome: "meadow" },
  { id: "dazaifu", act: 7, biome: "meadow" },
  { id: "dogo-onsen", act: 7, biome: "meadow" },
  { id: "kintaikyo", act: 7, biome: "water" },
  { id: "gunkanjima", act: 8, biome: "sea" },
  { id: "naruto", act: 8, biome: "sea" },
  { id: "shuri-castle", act: 8, biome: "sea" },
  { id: "taketomi", act: 8, biome: "sea" },
  { id: "matsushima", act: 8, biome: "sea" },
  { id: "amanohashidate", act: 8, biome: "sea" },
  { id: "tottori-dunes", act: 8, biome: "dunes" },
  { id: "shiretoko", act: 9, biome: "snow" },
  { id: "otaru-canal", act: 9, biome: "snow" },
  { id: "goryokaku", act: 9, biome: "snow" },
  { id: "blue-pond", act: 9, biome: "snow" },
  { id: "furano", act: 9, biome: "meadow" },
  { id: "ouchi-juku", act: 9, biome: "snow" },
  { id: "ginzan-onsen", act: 9, biome: "snow" },
  { id: "chuson-ji", act: 9, biome: "snow" },
  { id: "yamadera", act: 9, biome: "snow" },
  { id: "snow-monkeys", act: 9, biome: "snow" },
];

export const LANDMARKS: readonly Landmark[] = LANDMARK_SPECS.map((s, i) => ({ ...s, order: i + 1 }));

/**
 * Landmarks that must be restored before each ability is held. Each threshold is the end of an
 * act (acts hold 3, 5, 5, 7, 10, 11, 8, 7, 10 landmarks), so an act never needs the ability it unlocks.
 */
export const CAPABILITY_THRESHOLDS: Readonly<Record<Capability, number>> = {
  boat: 3,
  snowshoes: 8,
  climbing: 13,
  geta: 20,
  lantern: 30,
  ashSandals: 41,
  ship: 49,
};

/**
 * Far sight: at the end of act VIII every unrestored landmark is marked on the map. It opens no
 * terrain, so it never affects where landmarks can be placed.
 */
export const FAR_SIGHT_STARS = 56;

export function capabilitiesForCount(count: number): ReadonlySet<Capability> {
  const held = new Set<Capability>();
  for (const [cap, need] of Object.entries(CAPABILITY_THRESHOLDS) as Array<[Capability, number]>) {
    if (count >= need) held.add(cap);
  }
  return held;
}

/** Landmarks restored by the time `act` begins, i.e. the total of all earlier acts. */
export function landmarksBeforeAct(act: number): number {
  return LANDMARKS.filter((l) => l.act < act).length;
}

/**
 * The ground is the landmark's footprint (a square) at model height, easing to
 * natural height over LANDMARK_BLEND further units so it never stands as a wall.
 * A landmark without a model yet gets a flat footprint of the default half-width.
 */
export const LANDMARK_PLATEAU_RADIUS = 9.7;
export const LANDMARK_BLEND = 8;
/** Monuments keep clear of the footprint and its slope (Chebyshev distance from the site). */
export const LANDMARK_MONUMENT_CLEARANCE = LANDMARK_PLATEAU_RADIUS + LANDMARK_BLEND + 1.5;
/** A placeholder is one solid disc at the site. */
export const LANDMARK_SOLID_RADIUS = 3.0;
/** Activation extends this many units past the edges of the landmark footprint. */
export const LANDMARK_REACH_MARGIN = 3.5;

/** Half-width of a landmark's flat or model-shaped footprint. */
export function footprintHalf(landmark: LandmarkSpec): number {
  return groundOf(landmark.id)?.half ?? LANDMARK_PLATEAU_RADIUS;
}

/** The point the compass aims at, in world space. */
export function anchorOf(region: Region): Point {
  const g = region.landmark ? groundOf(region.landmark.id) : undefined;
  return g ? { x: region.shrine.x + g.interact[0], z: region.shrine.z + g.interact[1] } : region.shrine;
}

/** Where the player arrives when travelling to a region: free ground beside its shrine or landmark. */
export function standPoint(region: Region): Point {
  if (!region.landmark) return { x: region.shrine.x, z: region.shrine.z + 2 };
  const g = groundOf(region.landmark.id);
  return g
    ? { x: region.shrine.x + g.stand[0], z: region.shrine.z + g.stand[1] }
    : { x: region.shrine.x, z: region.shrine.z + LANDMARK_SOLID_RADIUS + 1.5 };
}

/** Regions within this many region-widths of the origin are always meadow, so the start is open. */
export const HOME_RADIUS = 2;
export type LandmarkLayout = "spread" | "compact" | "close";

/** Keep the previous layout reproducible for saves that address landmarks by region ID. */
const LANDMARK_SPACING = {
  spread: { area: 18, start: 5 },
  compact: { area: 14.4, start: 4 },
  /** Radii 20% under "compact" (area scales with the square of the radius). */
  close: { area: 9.216, start: 3.2 },
} as const;
/** The planner searches this far (Chebyshev, in regions) for somewhere to put a landmark. */
export const LANDMARK_WINDOW = 28;
const WINDOW = LANDMARK_WINDOW;
/** Landmarks keep at least this many regions apart where there is room. */
const SEPARATION = 2;
const GOLDEN_ANGLE = 2.399963;
/** Half-width of the arc an act's landmarks are spread over, radians. */
const ARC = 1.6;

/** Radius (in regions) of the disc that holds `n` landmarks at the target density, beyond the empty start. */
export function ringRadius(n: number, layout: LandmarkLayout = "close"): number {
  const { area, start } = LANDMARK_SPACING[layout];
  return start + Math.sqrt((area * n) / Math.PI);
}

/**
 * Chooses a region for every landmark. A pure function of the seed.
 *
 * Landmarks grow outward from the origin in acts: act k fills the annulus
 * between ringRadius(N_{k-1}) and ringRadius(N_k), centred on a bearing that
 * is rotated per act (so growth is radial, not a chain). Only regions the
 * player can already walk to, with the abilities held when the act begins,
 * are candidates, and a placement is rejected if it would cut off any earlier
 * landmark. That makes progress constructive: the next landmark is always
 * reachable (ADR 0006).
 */
export function planLandmarks(
  seed: string,
  ambient: (rx: number, rz: number) => Biome,
  layout: LandmarkLayout = "close",
): ReadonlyMap<string, Landmark> {
  const rng = createRng(seed).fork("landmarks");
  const phase = rng.range(0, Math.PI * 2);
  const placed = new Map<string, Landmark>();

  // The search window as a flat grid, so the many reachability checks stay cheap.
  const side = 2 * WINDOW + 1;
  const cell = (rx: number, rz: number): number => (rz + WINDOW) * side + (rx + WINDOW);
  const grid: Biome[] = new Array<Biome>(side * side);
  for (let rz = -WINDOW; rz <= WINDOW; rz++) for (let rx = -WINDOW; rx <= WINDOW; rx++) grid[cell(rx, rz)] = ambient(rx, rz);

  /** Cells walkable from the origin with the given abilities. */
  const flood = (caps: ReadonlySet<Capability>): Uint8Array => {
    const seen = new Uint8Array(side * side);
    const start = cell(0, 0);
    if (!canTraverse(grid[start]!, caps)) return seen;
    const queue = [start];
    seen[start] = 1;
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]!;
      const x = (at % side) - WINDOW;
      const z = Math.floor(at / side) - WINDOW;
      for (const [dx, dz] of FOUR) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < -WINDOW || nx > WINDOW || nz < -WINDOW || nz > WINDOW) continue;
        const n = cell(nx, nz);
        if (seen[n] || !canTraverse(grid[n]!, caps)) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return seen;
  };

  const acts = [...new Set(LANDMARKS.map((l) => l.act))];
  const actCaps = new Map(acts.map((act) => [act, capabilitiesForCount(landmarksBeforeAct(act))]));
  const stillReachable = (upTo: number): boolean => {
    for (const act of acts) {
      if (act > upTo) break;
      const mine = [...placed.entries()].filter(([, l]) => l.act === act);
      if (mine.length === 0) continue;
      const seen = flood(actCaps.get(act)!);
      for (const [id] of mine) {
        const [rx, rz] = id.split(",").map(Number) as [number, number];
        if (!seen[cell(rx, rz)]) return false;
      }
    }
    return true;
  };

  for (const act of acts) {
    const members = LANDMARKS.filter((l) => l.act === act);
    const before = landmarksBeforeAct(act);
    const caps = actCaps.get(act)!;
    const seen = flood(caps);
    const lo = ringRadius(before, layout);
    const hi = ringRadius(before + members.length, layout);
    const bearing = phase + act * GOLDEN_ANGLE;
    members.forEach((landmark, i) => {
      if (!canTraverse(landmark.biome, caps)) throw new Error(`${landmark.id} needs more than act ${act} holds`);
      const r = lo + ((hi - lo) * (i + 0.5)) / members.length;
      const a = bearing + (members.length === 1 ? 0 : ((i / (members.length - 1)) * 2 - 1) * ARC) + rng.range(-0.15, 0.15);
      const tx = Math.cos(a) * r;
      const tz = Math.sin(a) * r;
      // Candidates are regions the player can already reach, then (as a last resort) the ones
      // beside them: the landmark's own biome makes it reachable, e.g. a lake next to the shore.
      const ranked: Array<{ rx: number; rz: number; d: number; adj: boolean }> = [];
      for (let rz = -WINDOW; rz <= WINDOW; rz++) {
        for (let rx = -WINDOW; rx <= WINDOW; rx++) {
          if ((rx === 0 && rz === 0) || (landmark.biome !== "meadow" && Math.hypot(rx, rz) <= HOME_RADIUS) || placed.has(regionId(rx, rz))) continue;
          let adj = false;
          if (!seen[cell(rx, rz)]) {
            adj = FOUR.some(([dx, dz]) => {
              const nx = rx + dx;
              const nz = rz + dz;
              return nx >= -WINDOW && nx <= WINDOW && nz >= -WINDOW && nz <= WINDOW && seen[cell(nx, nz)] === 1;
            });
            if (!adj) continue;
          }
          ranked.push({ rx, rz, d: Math.hypot(rx - tx, rz - tz), adj });
        }
      }
      ranked.sort((p, q) => p.d - q.d || p.rx - q.rx || p.rz - q.rz);
      const apart = (c: RegionCoord): boolean => {
        for (const id of placed.keys()) {
          const [px, pz] = id.split(",").map(Number) as [number, number];
          if (Math.hypot(px - c.rx, pz - c.rz) < SEPARATION) return false;
        }
        return true;
      };
      for (const [spacing, adjacent] of [[true, false], [false, false], [true, true], [false, true]] as const) {
        for (const c of ranked) {
          if (c.adj && !adjacent) continue;
          if (spacing && !apart(c)) continue;
          const id = regionId(c.rx, c.rz);
          const was = grid[cell(c.rx, c.rz)]!;
          placed.set(id, landmark);
          grid[cell(c.rx, c.rz)] = landmark.biome;
          if (stillReachable(act)) return;
          placed.delete(id);
          grid[cell(c.rx, c.rz)] = was;
        }
      }
      throw new Error(`no room for ${landmark.id}`);
    });
  }
  return placed;
}

const FOUR = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
