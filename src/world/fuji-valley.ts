import { createRng } from "../core";
import type { Point } from "./coords";
import { fujiRailway, railPoint, railwayClearance, type FujiRailway } from "./fuji-railway";
import { footprintHalf, LANDMARK_BLEND } from "./landmarks";
import type { World } from "./world";

export type FujiField = "bank" | "paddy" | "rice" | "channel";

interface Plot {
  readonly distance: number;
  readonly across: number;
  readonly halfLength: number;
  readonly halfWidth: number;
}

interface ValleyProp extends Point {
  readonly kind: "cherry" | "farmhouse";
  readonly scale: number;
  readonly rotation: number;
  readonly variant: number;
}

interface Valley {
  readonly line: FujiRailway;
  readonly plots: readonly Plot[];
  readonly props: readonly ValleyProp[];
}

const valleys = new WeakMap<World, Valley | null>();

/** Borrow the ride's landmarks in order: houses, irrigated fields, then cherry trees. */
export function fujiValley(world: World): Valley | null {
  const cached = valleys.get(world);
  if (cached !== undefined) return cached;
  const railway = fujiRailway(world);
  if (!railway) {
    valleys.set(world, null);
    return null;
  }

  const line = railway;
  const random = createRng(world.seed).fork("fuji-valley");
  const plots: Plot[] = [];
  const props: ValleyProp[] = [];
  const distanceAt = (progress: number) => line.stations[0].distance
    + (line.stations[1].distance - line.stations[0].distance) * progress;

  function fits(distance: number, across: number, halfLength: number, halfWidth: number, shrineClearance = 10): boolean {
    for (let dx = -halfLength; dx <= halfLength; dx += 1) {
      for (let dz = -halfWidth; dz <= halfWidth; dz += 1) {
        const { x, z } = railPoint(line, distance + dx, across + dz);
        const region = world.regionAt(x, z);
        if (!line.requiredRegions.includes(region.id)) return false;
        if (region.biome !== "meadow" && region.biome !== "mountain") return false;
        const sx = Math.abs(x - region.shrine.x), sz = Math.abs(z - region.shrine.z);
        if (region.landmark
          ? Math.max(sx, sz) <= footprintHalf(region.landmark) + LANDMARK_BLEND + 1
          : Math.hypot(sx, sz) <= shrineClearance) return false;
        if (railwayClearance(line, x, z) < 1.4) return false;
      }
    }
    return true;
  }

  for (const progress of [0.24, 0.36, 0.48, 0.60, 0.71]) {
    const distance = distanceAt(progress);
    for (const across of [-10.5, 12, -22, 23]) {
      const halfLength = Math.min(7, (line.stations[1].distance - line.stations[0].distance) * 0.052);
      if (!fits(distance, across, halfLength + 1, 6, 12.5)) continue;
      plots.push({ distance, across, halfLength, halfWidth: 5 });
      if (plots.length >= 7) break;
    }
    if (plots.length >= 7) break;
  }

  // Fit smaller plots on tighter corridors without enlarging the reserved landscape.
  if (plots.length < 2) {
    for (const progress of [0.32, 0.43, 0.55, 0.65]) {
      const distance = distanceAt(progress);
      for (const across of [-8, 8, -16, 16]) {
        if (plots.some((plot) => Math.abs(plot.distance - distance) < plot.halfLength + 5
          && Math.abs(plot.across - across) < plot.halfWidth + 4)) continue;
        if (!fits(distance, across, 5, 5, 12.5)) continue;
        plots.push({ distance, across, halfLength: 4, halfWidth: 4 });
        break;
      }
      if (plots.length >= 2) break;
    }
  }

  for (const progress of [0.05, 0.095, 0.145, 0.855, 0.905, 0.95]) {
    const distance = distanceAt(progress);
    for (const across of [-9, 10, -16, 17]) {
      if (!fits(distance, across, 3, 3)) continue;
      const point = railPoint(line, distance, across);
      if (props.some((p) => Math.hypot(p.x - point.x, p.z - point.z) < 6)) continue;
      props.push({ ...point, kind: "farmhouse", scale: random.range(0.9, 1.1), rotation: -Math.atan2(line.along.z, line.along.x), variant: random.next() });
      break;
    }
  }
  for (const progress of [0.73, 0.76, 0.79, 0.82, 0.85, 0.88, 0.91, 0.94]) {
    const distance = distanceAt(progress);
    for (const across of [-5.5, 7.5, -13]) {
      if (!fits(distance, across, 2, 2)) continue;
      const point = railPoint(line, distance, across);
      if (props.some((p) => Math.hypot(p.x - point.x, p.z - point.z) < 3.8)) continue;
      props.push({ ...point, kind: "cherry", scale: random.range(1.2, 1.65), rotation: random.range(0, Math.PI * 2), variant: random.next() });
      break;
    }
  }

  const valley = { line, plots, props };
  valleys.set(world, valley);
  return valley;
}

export function fujiFieldAt(valley: Valley, x: number, z: number): { kind: FujiField; inset: number } | undefined {
  const { line, plots } = valley;
  const dx = x - line.origin.x, dz = z - line.origin.z;
  const distance = dx * line.along.x + dz * line.along.z;
  const across = dx * line.across.x + dz * line.across.z;
  if (Math.abs(across) > 28 || distance < line.start || distance > line.end) return;
  for (const plot of plots) {
    const u = distance - plot.distance, v = across - plot.across;
    const inset = Math.min(plot.halfLength - Math.abs(u), plot.halfWidth - Math.abs(v));
    if (inset < 0) continue;
    if (inset < 0.9) return { kind: "bank", inset };
    if (v > 2.4) return { kind: "channel", inset };
    return { kind: Math.floor(u + plot.halfLength) % 3 === 0 ? "rice" : "paddy", inset };
  }
}

/** Green foothills fade into the seed’s own ground away from the sleeper bed. */
export function fujiVergeAt(line: FujiRailway, x: number, z: number): number {
  const dx = x - line.origin.x, dz = z - line.origin.z;
  const along = dx * line.along.x + dz * line.along.z;
  const across = Math.abs(dx * line.across.x + dz * line.across.z);
  const beyond = Math.max(0, line.start - along, along - line.end);
  const edge = Math.max(across - 4, beyond * 1.35);
  const t = Math.min(1, Math.max(0, 1 - edge / 14));
  return t * t * (3 - 2 * t);
}
