import { createRng, type Rng } from "../core";
import type { Point } from "./coords";
import { CHUNK_SIZE, type Terrain } from "./terrain-grid";
import type { Biome } from "./terrain";
import type { Region, World } from "./world";

/** What the world needs to know about a text in order to place its monument. */
export interface MonumentSpec {
  readonly id: string;
  readonly kind: string;
  /** If set, the monument goes in a region of this biome (haiku, which describe a scene). */
  readonly biome?: Biome;
}

/** A standing stone carrying one text. */
export interface Monument {
  /** The id of the text it shows. */
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  /** Ground height at the foot of the stone. */
  readonly y: number;
  readonly regionId: string;
  /** Rotation about the vertical axis, radians. */
  readonly rotation: number;
  /** In [0, 1): picks small visual variation. */
  readonly variant: number;
}

/** Chance of a region holding 0, 1 or 2 monuments. Most of the world is peacefully empty. */
const COUNT_WEIGHTS = [0.2, 0.55, 0.25] as const;

/** Monuments keep this far from every region boundary, so the wave and fog treat them as inside. */
export const MONUMENT_EDGE_MARGIN = 5;
/** And this far from the shrine, which has its own plateau and lanterns. */
const SHRINE_CLEARANCE = 10;
const MAX_SHRINE_DISTANCE = 42;
const PAIR_SEPARATION = 16;
/** Props are cleared from this radius around a monument. */
export const MONUMENT_CLEARING = 1.8;

function countFor(rng: Rng): number {
  let roll = rng.next();
  for (let n = 0; n < COUNT_WEIGHTS.length; n++) {
    const w = COUNT_WEIGHTS[n] ?? 0;
    if (roll < w) return n;
    roll -= w;
  }
  return 1;
}

/** Regions in rings of increasing Chebyshev distance from the origin cell. */
function ring(radius: number): Array<[number, number]> {
  if (radius === 0) return [[0, 0]];
  const cells: Array<[number, number]> = [];
  for (let i = -radius; i <= radius; i++) {
    cells.push([i, -radius], [i, radius]);
    if (i > -radius && i < radius) cells.push([-radius, i], [radius, i]);
  }
  return cells;
}

/** Distance to the nearest region boundary, approximated through the bisector with the nearest rival sites. */
function edgeMargin(world: World, region: Region, x: number, z: number): number {
  const own = Math.hypot(x - region.site.x, z - region.site.z);
  let margin = Infinity;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dz === 0) continue;
      const other = world.region(region.coord.rx + dx, region.coord.rz + dz);
      margin = Math.min(margin, (Math.hypot(x - other.site.x, z - other.site.z) - own) / 2);
    }
  }
  return margin;
}

function pickPosition(world: World, terrain: Terrain, region: Region, rng: Rng, avoid: Point | null): Point {
  const valid = (p: Point, margin: number): boolean => {
    if (world.regionAt(p.x, p.z) !== region) return false;
    if (terrain.tileAtPoint(p.x, p.z).biome !== region.biome) return false;
    if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < PAIR_SEPARATION) return false;
    return edgeMargin(world, region, p.x, p.z) >= margin;
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(SHRINE_CLEARANCE, MAX_SHRINE_DISTANCE);
    const p = { x: region.site.x + Math.cos(a) * r, z: region.site.z + Math.sin(a) * r };
    if (valid(p, MONUMENT_EDGE_MARGIN)) return p;
  }
  // Squeezed regions: take the direction with the most room, close to the shrine.
  let best: Point = { x: region.site.x + SHRINE_CLEARANCE, z: region.site.z };
  let bestMargin = -Infinity;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const p = { x: region.site.x + Math.cos(a) * 12, z: region.site.z + Math.sin(a) * 12 };
    if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < PAIR_SEPARATION) continue;
    const m = edgeMargin(world, region, p.x, p.z);
    if (m > bestMargin) {
      bestMargin = m;
      best = p;
    }
  }
  return best;
}

/** Monuments whose clearing could touch a chunk: within its half-diagonal plus the clearing radius. */
export function monumentsAroundChunk(plan: MonumentPlan, cx: number, cz: number): Monument[] {
  const centre = { x: (cx + 0.5) * CHUNK_SIZE, z: (cz + 0.5) * CHUNK_SIZE };
  return plan.near(centre.x, centre.z, CHUNK_SIZE * 0.71 + MONUMENT_CLEARING);
}

export interface MonumentPlan {
  readonly all: readonly Monument[];
  byId(id: string): Monument | undefined;
  inRegion(regionId: string): readonly Monument[];
  /** Monuments within `radius` of a point, nearest first. */
  near(x: number, z: number, radius: number): Monument[];
}

/**
 * Where every text's monument stands: a pure function of the seed and the specs.
 *
 * The world is infinite but the set of texts is finite, so monuments are laid out
 * in rings around the starting region, filling only as many regions as it takes.
 * Each region holds at most two, which keeps them far apart: finding one is an
 * expedition.
 */
export function planMonuments(terrain: Terrain, specs: readonly MonumentSpec[]): MonumentPlan {
  const world = terrain.world;
  const root = createRng(world.seed).fork("monuments");

  // 1. Slots: (region, index), ring by ring until there are enough.
  const slots: Array<{ region: Region; index: number }> = [];
  for (let r = 0; slots.length < specs.length; r++) {
    const ringSlots: Array<{ region: Region; index: number }> = [];
    for (const [rx, rz] of ring(r)) {
      const region = world.region(rx, rz);
      const n = countFor(root.fork(`count:${region.id}`));
      for (let index = 0; index < n; index++) ringSlots.push({ region, index });
    }
    const room = specs.length - slots.length;
    if (ringSlots.length > room) {
      // Trim the last ring at random so it isn't biased towards one side.
      const trim = root.fork(`trim:${r}`);
      while (ringSlots.length > room) ringSlots.splice(trim.int(0, ringSlots.length), 1);
    }
    slots.push(...ringSlots);
  }

  // 2. Assign texts to slots. Scenery-bound texts take a slot in a matching biome; the rest fill in at random.
  const free = slots.map((_, i) => i);
  const assigned = new Array<MonumentSpec>(slots.length);
  const take = (rng: Rng, accept: (i: number) => boolean): number | null => {
    const candidates = free.filter(accept);
    if (candidates.length === 0) return null;
    const pick = candidates[rng.int(0, candidates.length)] as number;
    free.splice(free.indexOf(pick), 1);
    return pick;
  };
  const bound = specs.filter((s) => s.biome);
  const assignRng = root.fork("assign");
  for (const spec of bound) {
    const slot =
      take(assignRng, (i) => slots[i]?.region.biome === spec.biome) ?? take(assignRng, () => true);
    if (slot === null) throw new Error("more specs than slots");
    assigned[slot] = spec;
  }
  const rest = specs.filter((s) => !s.biome);
  const shuffle = root.fork("shuffle");
  for (let i = rest.length - 1; i > 0; i--) {
    const j = shuffle.int(0, i + 1);
    [rest[i], rest[j]] = [rest[j] as MonumentSpec, rest[i] as MonumentSpec];
  }
  free.sort((a, b) => a - b);
  free.forEach((slot, k) => {
    assigned[slot] = rest[k] as MonumentSpec;
  });

  // 3. Positions.
  const placed = new Map<string, Point>();
  const all: Monument[] = slots.map(({ region, index }, i) => {
    const spec = assigned[i] as MonumentSpec;
    const rng = root.fork(`pos:${region.id}:${index}`);
    const p = pickPosition(world, terrain, region, rng, placed.get(region.id) ?? null);
    placed.set(region.id, p);
    return {
      id: spec.id,
      kind: spec.kind,
      x: p.x,
      z: p.z,
      y: terrain.tileAtPoint(p.x, p.z).height,
      regionId: region.id,
      rotation: rng.range(-0.5, 0.5),
      variant: rng.next(),
    };
  });

  const byId = new Map(all.map((m) => [m.id, m]));
  const byRegion = new Map<string, Monument[]>();
  for (const m of all) byRegion.set(m.regionId, [...(byRegion.get(m.regionId) ?? []), m]);
  return {
    all,
    byId: (id) => byId.get(id),
    inRegion: (id) => byRegion.get(id) ?? [],
    near: (x, z, radius) =>
      all
        .map((m) => ({ m, d: Math.hypot(m.x - x, m.z - z) }))
        .filter((e) => e.d <= radius)
        .sort((a, b) => a.d - b.d)
        .map((e) => e.m),
  };
}
