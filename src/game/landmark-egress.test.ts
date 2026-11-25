import { expect, it } from "vitest";
import { monumentSpecs } from "../content";
import {
  capabilitiesForCount, createObstacles, createTerrain, createWorld, footprintHalf,
  isWater, landmarksBeforeAct, planMonuments, standPoint,
  type Capability, type Obstacles, type Point, type Region, type Terrain,
} from "../world";
import { blockerAt, PLAYER_RADIUS } from "./player";

const STEP = 0.25;
// Pad the discs slightly so sampling the ends and midpoint cannot miss a clipped edge.
const CLEARANCE = PLAYER_RADIUS + 0.01;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function canLeaveLandmark(
  terrain: Terrain, obstacles: Obstacles, region: Region, caps: ReadonlySet<Capability>, arrival: Point,
): boolean {
  const half = footprintHalf(region.landmark!);
  const limit = half + 10;
  const solids = obstacles.near(region.shrine.x, region.shrine.z, Math.SQRT2 * limit);
  const area = new Map<string, typeof solids>();
  for (const o of solids) {
    const r = o.r + CLEARANCE;
    for (let z = Math.floor(o.z - r); z <= Math.floor(o.z + r); z++) {
      for (let x = Math.floor(o.x - r); x <= Math.floor(o.x + r); x++) {
        const key = `${x},${z}`;
        const bin = area.get(key) ?? [];
        bin.push(o);
        area.set(key, bin);
      }
    }
  }
  const isOpen = (x: number, z: number): boolean =>
    !(area.get(`${Math.floor(x)},${Math.floor(z)}`) ?? []).some((o) => Math.hypot(x - o.x, z - o.z) < o.r + CLEARANCE)
    && blockerAt(terrain, caps, x, z) === null;
  if (!isOpen(arrival.x, arrival.z)) return false;
  const needWater = isWater(region.biome);
  const queue: Array<readonly [number, number]> = [[0, 0]];
  const seen = new Set(["0,0"]);
  for (let i = 0; i < queue.length; i++) {
    const [gx, gz] = queue[i]!;
    const x = arrival.x + gx * STEP;
    const z = arrival.z + gz * STEP;
    const distance = Math.max(Math.abs(x - region.shrine.x), Math.abs(z - region.shrine.z));
    if (distance > half + 1 && (!needWater || terrain.tileAtPoint(x, z).biome === region.biome)) return true;
    for (const [dx, dz] of DIRECTIONS) {
      const nx = gx + dx;
      const nz = gz + dz;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      const px = x + dx * STEP;
      const pz = z + dz * STEP;
      if (Math.max(Math.abs(px - region.shrine.x), Math.abs(pz - region.shrine.z)) > limit) continue;
      if (isOpen(px, pz) && isOpen((px + x) / 2, (pz + z) / 2)) {
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
  }
  return false;
}

it.each(["wayshrine", "winter-coast", "tile-b", "spring", "fuji-rail"])("has an exit from every landmark teleport in %s", (seed) => {
  const terrain = createTerrain(createWorld(seed));
  const obstacles = createObstacles(terrain, planMonuments(terrain, monumentSpecs));
  const trapped: string[] = [];
  for (const region of terrain.world.landmarks) {
    const landmark = region.landmark!;
    const caps = capabilitiesForCount(landmarksBeforeAct(landmark.act));
    if (!canLeaveLandmark(terrain, obstacles, region, caps, standPoint(region))) trapped.push(landmark.id);
  }
  expect(trapped).toEqual([]);
}, 60_000);
