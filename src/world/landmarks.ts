import { createRng } from "../core";
import { regionId, type RegionCoord } from "./coords";
import { canTraverse, type Biome, type Capability } from "./terrain";

/**
 * Landmarks: hand-crafted places emblematic of Japan, one per special region.
 * Restoring them, not shrines, unlocks abilities (ADR 0006). The full list of
 * fifty is in docs/landmarks.md; the code holds the acts whose biomes exist.
 */
export interface LandmarkSpec {
  readonly id: string;
  /** 1-based act; acts are bands of landmarks that sit progressively farther out. */
  readonly act: number;
  /** The region's biome. It must be traversable with the abilities held when the act begins. */
  readonly biome: Biome;
  /** Radius of the solid footprint, if the model is larger than the placeholder's. */
  readonly radius?: number;
}

export interface Landmark extends LandmarkSpec {
  /** 1-based position in the overall order. */
  readonly order: number;
}

export const LANDMARK_SPECS: readonly LandmarkSpec[] = [
  { id: "fushimi-inari", act: 1, biome: "meadow", radius: 7.5 },
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
];

export const LANDMARKS: readonly Landmark[] = LANDMARK_SPECS.map((s, i) => ({ ...s, order: i + 1 }));

/** Landmarks that must be restored before each ability is held. */
export const CAPABILITY_THRESHOLDS: Readonly<Record<Capability, number>> = {
  boat: 3,
  snowshoes: 8,
  climbing: 13,
};

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
 * A landmark region's plateau is a flat square of this half-width (the models are
 * square dioramas), and the ground eases back to natural height over
 * LANDMARK_BLEND further units so it never stands as a wall.
 */
export const LANDMARK_PLATEAU_RADIUS = 9.7;
export const LANDMARK_BLEND = 8;
/** Monuments keep clear of the plateau and its slope (Chebyshev distance from the site). */
export const LANDMARK_MONUMENT_CLEARANCE = LANDMARK_PLATEAU_RADIUS + LANDMARK_BLEND + 1.5;
/**
 * A landmark stands at its region's site and is the shrine: the player restores
 * it from just outside this radius (within LANDMARK_REACH_MARGIN of the edge).
 */
export const LANDMARK_SOLID_RADIUS = 3.0;

/** The solid footprint of a landmark, in world units. */
export function landmarkRadius(landmark: LandmarkSpec): number {
  return landmark.radius ?? LANDMARK_SOLID_RADIUS;
}

/** How far beyond its footprint a landmark can be used from. */
export const LANDMARK_REACH_MARGIN = 3.5;

/** Regions within this many region-widths of the origin are always meadow, so the start is open. */
export const HOME_RADIUS = 2;
/** Region-grid area per landmark: itself plus about ten shrines. */
const AREA_PER_LANDMARK = 11;
/** The planner searches this far (Chebyshev, in regions) for somewhere to put a landmark. */
const WINDOW = 16;
/** Landmarks keep at least this many regions apart where there is room. */
const SEPARATION = 2;
const GOLDEN_ANGLE = 2.399963;
/** Half-width of the arc an act's landmarks are spread over, radians. */
const ARC = 0.9;

/** Radius (in regions) of the disc that holds `n` landmarks at the target density. */
export function ringRadius(n: number): number {
  return Math.sqrt((AREA_PER_LANDMARK * n) / Math.PI);
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
    const lo = ringRadius(before);
    const hi = ringRadius(before + members.length);
    const bearing = phase + act * GOLDEN_ANGLE;
    members.forEach((landmark, i) => {
      if (!canTraverse(landmark.biome, caps)) throw new Error(`${landmark.id} needs more than act ${act} holds`);
      const r = lo + ((hi - lo) * (i + 0.5)) / members.length;
      const a = bearing + (members.length === 1 ? 0 : ((i / (members.length - 1)) * 2 - 1) * ARC) + rng.range(-0.15, 0.15);
      const tx = Math.cos(a) * r;
      const tz = Math.sin(a) * r;
      const ranked: Array<{ rx: number; rz: number; d: number }> = [];
      for (let rz = -WINDOW; rz <= WINDOW; rz++) {
        for (let rx = -WINDOW; rx <= WINDOW; rx++) {
          if (!seen[cell(rx, rz)] || (rx === 0 && rz === 0) || (landmark.biome !== "meadow" && Math.hypot(rx, rz) <= HOME_RADIUS) || placed.has(regionId(rx, rz))) continue;
          ranked.push({ rx, rz, d: Math.hypot(rx - tx, rz - tz) });
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
      for (const spacing of [true, false]) {
        for (const c of ranked) {
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
