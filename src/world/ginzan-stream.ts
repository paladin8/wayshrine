import { createRng } from "../core";
import type { Point } from "./coords";
import { footprintHalf } from "./landmarks";
import type { Tile } from "./terrain-grid";
import type { Region, World } from "./world";

export type GinzanSurface = "stream" | "bank" | "bath" | "rim" | "bridge";

interface StreamPoint extends Point {
  readonly regionId: string;
  readonly distance: number;
}

interface Spring extends StreamPoint {
  readonly radius: number;
  readonly entranceAngle: number;
}

interface Bridge extends StreamPoint {
  readonly yaw: number;
}

interface StreamTile {
  readonly surface: GinzanSurface;
  readonly heightOffset: number;
  readonly grade: number;
}

interface GinzanStream {
  readonly sourceId: string;
  readonly path: readonly StreamPoint[];
  readonly springs: readonly Spring[];
  readonly bridges: readonly Bridge[];
  readonly cells: ReadonlyMap<string, ReadonlyMap<string, StreamTile>>;
}

const streams = new WeakMap<World, GinzanStream | null>();

function safeSnow(region: Region, source: Region, x: number, z: number): boolean {
  if (region.biome !== "snow") return false;
  const dx = x - region.shrine.x, dz = z - region.shrine.z;
  if (region === source) return Math.max(Math.abs(dx), Math.abs(dz)) > footprintHalf(region.landmark!);
  if (region.landmark) return false;
  return dx * dx + dz * dz > 9 ** 2;
}

function trace(world: World, source: Region, angle: number): StreamPoint[] {
  // The authored street opens to world +Z. Turn gradually once outside the model.
  const edge = footprintHalf(source.landmark!);
  let x = source.site.x, z = source.site.z + edge + 0.55;
  const path: StreamPoint[] = [];
  for (let distance = 0; distance <= 142; distance += 2) {
    const region = world.regionAt(x, z);
    if (!safeSnow(region, source, x, z)) break;
    path.push({ x, z, regionId: region.id, distance });
    const heading = angle * Math.min(1, distance / 24);
    x += Math.sin(heading) * 2;
    z += Math.cos(heading) * 2;
  }
  return path;
}

function springsAlong(world: World, source: Region, path: readonly StreamPoint[]): Spring[] {
  const springs: Spring[] = [];
  let currentRegion = source.id;
  for (const point of path) {
    if (point.regionId !== currentRegion) {
      if (currentRegion !== source.id && !springs.some((s) => s.regionId === currentRegion)) break;
      currentRegion = point.regionId;
    }
    if (point.regionId === source.id || point.distance < 18 || springs.some((s) => s.regionId === point.regionId)) continue;
    if (springs.some((s) => point.distance - s.distance < 16)) continue;
    const region = world.regionById(point.regionId);
    const radius = 3.8;
    const fits = [-5, 0, 5].every((dx) => [-5, 0, 5].every((dz) =>
      world.regionAt(point.x + dx, point.z + dz) === region
      && Math.hypot(point.x + dx - region.shrine.x, point.z + dz - region.shrine.z) > 11.75,
    ));
    if (fits && point.distance + 6 <= (path.at(-1)?.distance ?? 0)) {
      const previous = path[point.distance / 2 - 1]!;
      const next = path[point.distance / 2 + 1]!;
      const downstream = Math.atan2(next.z - previous.z, next.x - previous.x);
      // Put the steps on the more visible side of the stream in the isometric view.
      const entranceAngle = downstream + (Math.cos(downstream) > Math.sin(downstream) ? Math.PI / 2 : -Math.PI / 2);
      springs.push({ ...point, radius, entranceAngle });
    }
    if (springs.length === 2) break;
  }
  return springs;
}

function rasterize(world: World, source: Region, path: readonly StreamPoint[], springs: readonly Spring[], bridges: readonly Bridge[]) {
  const cells = new Map<string, Map<string, StreamTile>>();
  const best = new Map<string, number>();
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1]!, end = path[i]!;
    const dx = end.x - start.x, dz = end.z - start.z;
    for (let tz = Math.floor(Math.min(start.z, end.z) - 5.5); tz <= Math.floor(Math.max(start.z, end.z) + 5.5); tz++) {
      for (let tx = Math.floor(Math.min(start.x, end.x) - 5.5); tx <= Math.floor(Math.max(start.x, end.x) + 5.5); tx++) {
        const x = tx + 0.5, z = tz + 0.5;
        const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / (dx * dx + dz * dz)));
        const across = Math.hypot(x - start.x - t * dx, z - start.z - t * dz);
        if (across > 5.5) continue;
        const key = `${tx},${tz}`;
        if ((best.get(key) ?? Infinity) <= across) continue;
        const region = world.regionAt(x, z);
        if (!safeSnow(region, source, x, z)) continue;
        // A ribbon can follow the outline of its region, but cannot energize a third stop.
        if (region.id !== source.id && !springs.some((spring) => spring.regionId === region.id)) continue;
        const distance = start.distance + t * 2;
        const bath = springs.find((spring) => spring.regionId === region.id && Math.hypot(x - spring.x, z - spring.z) < spring.radius + 0.9);
        const bathDistance = bath ? Math.hypot(x - bath.x, z - bath.z) : Infinity;
        if (!bath && across > 3.8) continue;
        const surface: GinzanSurface = bath && bathDistance < bath.radius ? "bath"
          : bath ? "rim"
          : bridges.some((bridge) => Math.abs(distance - bridge.distance) < 1.2) && across < 2.9 ? "bridge"
          : across < 1.3 ? "stream" : "bank";
        const depth = surface === "stream" || surface === "bath" ? -0.30 : surface === "bridge" ? 0.12 : 0;
        const blending = bath && surface === "rim"
          ? Math.max(0, Math.min(1, (bath.radius + 0.9 - bathDistance) / 0.9))
          : Math.min(1, Math.max(0, (3.8 - across) / 1.45));
        const grade = bath && surface === "bath" ? 1 : blending * blending * (3 - 2 * blending);
        const regionCells = cells.get(region.id) ?? new Map<string, StreamTile>();
        regionCells.set(key, { surface, heightOffset: depth - 0.003 * distance, grade });
        cells.set(region.id, regionCells);
        best.set(key, across);
      }
    }
  }
  return cells;
}

/** Reserve a snowy channel leading from Ginzan into up to two ordinary snow regions. */
export function ginzanStream(world: World): GinzanStream | null {
  const cached = streams.get(world);
  if (cached !== undefined) return cached;
  const source = world.landmarks.find((r) => r.landmark?.id === "ginzan-onsen");
  if (!source) {
    streams.set(world, null);
    return null;
  }
  const rng = createRng(world.seed).fork("ginzan-stream");
  let best: { path: StreamPoint[]; springs: Spring[]; score: number } | undefined;
  for (let step = -14; step <= 14; step++) {
    const path = trace(world, source, step * 0.17);
    const springs = springsAlong(world, source, path);
    const score = springs.length * 400 + (springs.at(-1)?.distance ?? path.length) * -0.4
      + (springs.length === 0 ? path.length * 2 : 0) + rng.next();
    if (!best || score > best.score) best = { path, springs, score };
  }
  const springs = best?.springs ?? [];
  const last = springs.at(-1)?.distance ?? 24;
  const path = (best?.path ?? []).filter(({ distance }) => distance <= last + 6);
  const bridges: Bridge[] = [];
  for (const distance of new Set([14, ...springs.map((spring) => spring.distance - 8)])) {
    const i = distance / 2;
    const before = path[i - 1], point = path[i], after = path[i + 1];
    if (!before || !point || !after) continue;
    if (point.regionId !== source.id && !springs.some((spring) => spring.regionId === point.regionId)) continue;
    bridges.push({ ...point, yaw: Math.atan2(after.x - before.x, after.z - before.z) });
  }
  const cells = rasterize(world, source, path, springs, bridges);
  const result = { sourceId: source.id, path, springs, bridges, cells };
  streams.set(world, result);
  return result;
}

export function ginzanTile(plan: GinzanStream, regionId: string, tx: number, tz: number): StreamTile | undefined {
  const region = plan.cells.get(regionId);
  return region?.get(`${tx},${tz}`);
}

/** Warmth needs the source and the local shrine. Progress can be sampled mid-wave. */
export function ginzanWarmth(plan: GinzanStream, regionId: string, progressOf: (id: string) => number): number {
  return Math.min(progressOf(plan.sourceId), progressOf(regionId));
}

/** A bath or channel holds liquid water only after both ends of the spring are restored. */
export function isThawedGinzanWater(
  plan: GinzanStream | null,
  tile: Pick<Tile, "ginzanSurface" | "regionId">,
  restored: ReadonlySet<string>,
): boolean {
  return plan !== null && (tile.ginzanSurface === "stream" || tile.ginzanSurface === "bath")
    && restored.has(plan.sourceId) && restored.has(tile.regionId);
}

/** Keep procedural trees and boulders out of the short walk to the bathing steps. */
export function ginzanApproachClearing(spring: Spring, x: number, z: number): boolean {
  const dx = x - spring.x, dz = z - spring.z;
  const c = Math.cos(spring.entranceAngle), s = Math.sin(spring.entranceAngle);
  const along = dx * c + dz * s;
  return along > spring.radius - 0.2 && along < spring.radius + 4.4 && Math.abs(dz * c - dx * s) < 2.25;
}
