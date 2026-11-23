import { createRng } from "../core";
import { REGION_SIZE, type Point } from "./coords";
import { capabilitiesForCount, footprintHalf, landmarksBeforeAct, LANDMARK_WINDOW } from "./landmarks";
import { reachableRegions } from "./progression";
import { isWater } from "./terrain";
import type { Region, World } from "./world";

export const FUJI_RAIL_SEED = "fuji-rail";
export const RAIL_HALF_LENGTH = 60;
export const RAIL_HALF_WIDTH = 0.97;
export const PLATFORM_TOP = -0.12;
export const PLATFORM_END = 9.75;
const GRADE_BLEND = 4;
const STATION_TAIL = 11.7;
const STATION_SIDE = 3.05;

export interface FujiStation {
  readonly distance: number;
  readonly shrineId: string;
  readonly stand: Point;
}

interface RailAlignment {
  readonly origin: Point;
  readonly along: Point;
  /** Positive across is the platform side. The mountain is across the other side. */
  readonly across: Point;
}

export interface FujiRailway extends RailAlignment {
  readonly height: number;
  readonly start: number;
  readonly end: number;
  readonly landmarkId: string;
  readonly stations: readonly [FujiStation, FujiStation];
  readonly crossedRegions: readonly string[];
  readonly requiredRegions: readonly string[];
}

export function railPoint(line: RailAlignment, distance: number, across = 0): Point {
  return {
    x: line.origin.x + line.along.x * distance + line.across.x * across,
    z: line.origin.z + line.along.z * distance + line.across.z * across,
  };
}

function rectangleDistance(along: number, across: number, length: number, width: number): number {
  return Math.hypot(Math.max(0, Math.abs(along) - length), Math.max(0, Math.abs(across) - width));
}

function platformDistance(along: number, across: number, station: FujiStation): number {
  return rectangleDistance(along - station.distance, across - STATION_SIDE, PLATFORM_END + 0.8, 2.35);
}

/** Distance from the track bed and platform approach that the layout reserves. */
export function railwayClearance(line: Pick<FujiRailway, keyof RailAlignment | "stations" | "start" | "end">, x: number, z: number): number {
  const dx = x - line.origin.x, dz = z - line.origin.z;
  const along = dx * line.along.x + dz * line.along.z;
  const across = dx * line.across.x + dz * line.across.z;
  const halfLength = (line.end - line.start) / 2;
  const centre = (line.end + line.start) / 2;
  let distance = rectangleDistance(along - centre, across, halfLength, 1.45);
  for (const station of line.stations) {
    distance = Math.min(distance, platformDistance(along, across, station));
  }
  return distance;
}

/** Use the actual occupied tiles, including edge tiles, so a narrow region crossing still counts. */
function crossedRegions(world: World, line: RailAlignment, start: number, end: number): string[] {
  const halfLength = (end - start) / 2;
  const centre = railPoint(line, (end + start) / 2);
  const extentX = Math.abs(line.along.x) * halfLength + Math.abs(line.across.x) * RAIL_HALF_WIDTH;
  const extentZ = Math.abs(line.along.z) * halfLength + Math.abs(line.across.z) * RAIL_HALF_WIDTH;
  const halfTileAlong = (Math.abs(line.along.x) + Math.abs(line.along.z)) / 2;
  const halfTileAcross = (Math.abs(line.across.x) + Math.abs(line.across.z)) / 2;
  const regions = new Set<string>();
  for (let z = Math.floor(centre.z - extentZ); z <= Math.floor(centre.z + extentZ); z++) {
    for (let x = Math.floor(centre.x - extentX); x <= Math.floor(centre.x + extentX); x++) {
      const dx = x + 0.5 - centre.x, dz = z + 0.5 - centre.z;
      if (Math.abs(dx * line.along.x + dz * line.along.z) > halfLength + halfTileAlong) continue;
      if (Math.abs(dx * line.across.x + dz * line.across.z) > RAIL_HALF_WIDTH + halfTileAcross) continue;
      regions.add(world.regionAt(x + 0.5, z + 0.5).id);
    }
  }
  return [...regions];
}

function hasShrineClearance(world: World, line: Pick<FujiRailway, keyof RailAlignment | "stations" | "start" | "end">): boolean {
  const a = railPoint(line, line.start), b = railPoint(line, line.end);
  const fromX = Math.floor(Math.min(a.x, b.x) / REGION_SIZE) - 1;
  const toX = Math.floor(Math.max(a.x, b.x) / REGION_SIZE) + 1;
  const fromZ = Math.floor(Math.min(a.z, b.z) / REGION_SIZE) - 1;
  const toZ = Math.floor(Math.max(a.z, b.z) / REGION_SIZE) + 1;
  const projection = Math.abs(line.along.x) + Math.abs(line.along.z);
  for (let z = fromZ; z <= toZ; z++) {
    for (let x = fromX; x <= toX; x++) {
      const region = world.region(x, z);
      const radius = region.landmark ? footprintHalf(region.landmark) * projection + 1.5 : 4;
      if (railwayClearance(line, region.shrine.x, region.shrine.z) < radius) return false;
    }
  }
  return true;
}

const plans = new WeakMap<World, FujiRailway | null>();

/** Plan rail terrain before grading or prop placement, using the seed's existing shrine sites. */
export function fujiRailway(world: World): FujiRailway | null {
  const cached = plans.get(world);
  if (cached !== undefined) return cached;
  const plan = world.seed === FUJI_RAIL_SEED ? planPilot(world) : planSeededRailway(world);
  plans.set(world, plan);
  return plan;
}

function planPilot(world: World): FujiRailway | null {
  const fuji = world.regionById("-7,-2");
  const valleyShrine = world.regionById("-6,-2");
  const foothillShrine = world.regionById("-7,-3");
  if (fuji.landmark?.id !== "mount-fuji" || valleyShrine.landmark || foothillShrine.landmark) return null;
  const angle = 237.5 * Math.PI / 180;
  const along = { x: Math.cos(angle), z: Math.sin(angle) };
  const across = { x: -along.z, z: along.x };
  const offset = 49;
  const origin = { x: fuji.site.x - 3.2 + across.x * offset, z: fuji.site.z - 3.2 + across.z * offset };
  const alignment = { origin, along, across };
  const stations = [
    { distance: -48, shrineId: valleyShrine.id, stand: railPoint(alignment, -46.6, 3.05) },
    { distance: 48, shrineId: foothillShrine.id, stand: railPoint(alignment, 49.4, 3.05) },
  ] as const;
  const route = { ...alignment, start: -RAIL_HALF_LENGTH, end: RAIL_HALF_LENGTH, stations };
  if (!hasShrineClearance(world, route)) return null;
  const crossed = crossedRegions(world, route, route.start, route.end);
  return {
    ...route,
    height: 3.30,
    landmarkId: fuji.id,
    crossedRegions: crossed,
    requiredRegions: [...new Set([...crossed, valleyShrine.id, foothillShrine.id, fuji.id])],
  };
}

interface Approach {
  readonly inner: Region;
  readonly terminal: Region;
  readonly from: number;
  readonly to: number;
}

/** Trace out from Fuji until there is room for a platform and buffers in the second region. */
function traceApproach(world: World, line: RailAlignment, fuji: Region, direction: -1 | 1, reachable: ReadonlySet<string>, act: number, allowWaterStations: boolean): Approach | null {
  let inner: Region | undefined;
  let terminal: Region | undefined;
  let from = 0;
  let to = 0;
  for (let step = 2; step <= REGION_SIZE * 3.5; step += 2) {
    const p = railPoint(line, direction * step);
    const region = world.regionAt(p.x, p.z);
    if (region.id === fuji.id && !inner) continue;
    if (terminal && region !== terminal) break;
    if (!reachable.has(region.id) || (region.landmark && region.landmark.act > act)) return null;
    if (!inner) inner = region;
    if (!terminal && region !== inner) {
      if (region.landmark || (!allowWaterStations && isWater(region.biome))) return null;
      terminal = region;
      from = step;
    }
    if (terminal) to = step;
  }
  if (!inner || !terminal || to - from < STATION_TAIL * 2 + 2) return null;
  return { inner, terminal, from: from + STATION_TAIL, to: to - STATION_TAIL };
}

function stationChoices(world: World, line: RailAlignment, approach: Approach, direction: -1 | 1): FujiStation[] {
  const candidates: FujiStation[] = [];
  const middle = (approach.from + approach.to) / 2;
  const distances = [middle];
  for (let offset = 4; offset <= (approach.to - approach.from) / 2; offset += 4) {
    distances.push(middle - offset, middle + offset);
  }
  for (const magnitude of distances) {
    const distance = direction * magnitude;
    const stand = railPoint(line, distance + 1.4, STATION_SIDE);
    const platform = [
      stand,
      railPoint(line, distance - PLATFORM_END, 1.05),
      railPoint(line, distance - PLATFORM_END, 4),
      railPoint(line, distance + PLATFORM_END, 1.05),
      railPoint(line, distance + PLATFORM_END, 4),
    ];
    if (platform.every(({ x, z }) => world.regionAt(Math.floor(x) + 0.5, Math.floor(z) + 0.5) === approach.terminal)) {
      candidates.push({ distance, shrineId: approach.terminal.id, stand });
    }
  }
  return candidates;
}

function planSeededRailway(world: World): FujiRailway | null {
  const fuji = world.landmarks.find((region) => region.landmark?.id === "mount-fuji");
  if (!fuji?.landmark) return null;
  const act = fuji.landmark.act;
  const caps = capabilitiesForCount(landmarksBeforeAct(act));
  const reachable = new Set(reachableRegions(world, caps, LANDMARK_WINDOW).map(({ id }) => id));
  const random = createRng(world.seed).fork("fuji-railway");
  const phase = random.range(0, Math.PI * 2);
  const half = footprintHalf(fuji.landmark);
  const offsets = [21, 23, 25, 27, 29, 31, 33];
  return findRoute(world, fuji, act, half, reachable, phase, 72, offsets, random.next, false)
    ?? findRoute(world, fuji, act, half, reachable, phase, 288, Array.from({ length: 19 }, (_, i) => 19 + i), random.next, true);
}

function findRoute(
  world: World, fuji: Region, act: number, half: number, reachable: ReadonlySet<string>,
  phase: number, bearings: number, offsets: readonly number[], tieBreak: () => number, allowWaterStations: boolean,
): FujiRailway | null {
  const possible: { alignment: RailAlignment; before: Approach; after: Approach; score: number }[] = [];
  for (let bearing = 0; bearing < bearings; bearing++) {
    const angle = phase + bearing * 2 * Math.PI / bearings;
    const along = { x: Math.cos(angle), z: Math.sin(angle) };
    const across = { x: -along.z, z: along.x };
    for (const offset of offsets) {
      if (offset < half * (Math.abs(across.x) + Math.abs(across.z)) + 3) continue;
      const origin = { x: fuji.site.x + across.x * offset, z: fuji.site.z + across.z * offset };
      if (world.regionAt(origin.x, origin.z) !== fuji) continue;
      const alignment = { origin, along, across };
      const before = traceApproach(world, alignment, fuji, -1, reachable, act, allowWaterStations);
      const after = traceApproach(world, alignment, fuji, 1, reachable, act, allowWaterStations);
      if (!before || !after) continue;
      const neighbors = [before.terminal, before.inner, after.inner, after.terminal];
      if (new Set(neighbors).size !== 4) continue;
      const meadow = neighbors.filter(({ biome }) => biome === "meadow").length;
      const snow = neighbors.filter(({ biome }) => biome === "snow").length;
      const water = neighbors.filter(({ biome }) => isWater(biome)).length;
      const otherLandmarks = neighbors.filter(({ landmark }) => landmark !== null).length;
      const waterStations = Number(isWater(before.terminal.biome)) + Number(isWater(after.terminal.biome));
      const score = meadow * 24 - snow * 12 - (water + otherLandmarks) * 110 - waterStations * 500
        - (before.from + after.from) * 0.12 + tieBreak();
      possible.push({ alignment, before, after, score });
    }
  }
  possible.sort((a, b) => b.score - a.score);
  for (const { alignment, before, after } of possible) {
    const expected = [before.terminal.id, before.inner.id, fuji.id, after.inner.id, after.terminal.id];
    const crosses = new Set(expected);
    for (const first of stationChoices(world, alignment, before, -1)) {
      for (const second of stationChoices(world, alignment, after, 1)) {
        const start = first.distance - STATION_TAIL, end = second.distance + STATION_TAIL;
        const stations = [first, second] as const;
        const route = { ...alignment, start, end, stations };
        if (!hasShrineClearance(world, route)) continue;
        const physical = crossedRegions(world, route, start, end);
        if (physical.length !== expected.length || physical.some((id) => !crosses.has(id))) continue;
        return { ...route, height: 2.55, landmarkId: fuji.id, crossedRegions: expected, requiredRegions: expected };
      }
    }
  }
  return null;
}

/** The platforms are paved at the same grade as their walk-up approaches. */
export function railwayGround(line: FujiRailway, x: number, z: number, height: number): number {
  const distance = railwayClearance(line, x, z);
  return blendGrade(line, distance, height);
}

/** Give a station in a water region a small paved islet, with a sloping bank to land a boat. */
export function railwayBank(line: FujiRailway, stations: readonly FujiStation[], x: number, z: number, height: number): number {
  const dx = x - line.origin.x, dz = z - line.origin.z;
  const along = dx * line.along.x + dz * line.along.z;
  const across = dx * line.across.x + dz * line.across.z;
  let nearest = Infinity;
  for (const { distance } of stations) {
    nearest = Math.min(nearest, rectangleDistance(along - distance, across - 1.5, PLATFORM_END + 0.8, 4));
  }
  return blendGrade(line, nearest, height);
}

function blendGrade(line: FujiRailway, distance: number, height: number): number {
  if (distance >= GRADE_BLEND) return height;
  const t = distance / GRADE_BLEND;
  const blend = t * t * (3 - 2 * t);
  const level = line.height + PLATFORM_TOP;
  return level + (height - level) * blend;
}
