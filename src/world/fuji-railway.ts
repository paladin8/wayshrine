import type { Point } from "./coords";
import type { Terrain } from "./terrain-grid";

export const FUJI_RAIL_SEED = "fuji-rail";
export const RAIL_HALF_LENGTH = 60;
export const PLATFORM_TOP = 0.43;
export const PLATFORM_END = 9.75;
export const STAIRS = { offsets: [-6.7, 6.7], depth: 0.25, count: 6, edge: 3.955, width: 2.3 } as const;


export interface FujiStation {
  readonly distance: number;
  readonly shrineId: string;
  readonly stand: Point;
}

export interface FujiRailway {
  readonly origin: Point;
  readonly along: Point;
  /** Positive across is the platform side. The mountain is across the other side. */
  readonly across: Point;
  readonly height: number;
  readonly landmarkId: string;
  readonly stations: readonly [FujiStation, FujiStation];
}

export function railPoint(line: Pick<FujiRailway, "origin" | "along" | "across">, distance: number, across = 0): Point {
  return {
    x: line.origin.x + line.along.x * distance + line.across.x * across,
    z: line.origin.z + line.along.z * distance + line.across.z * across,
  };
}

/** The first line is fitted by hand to the ground and shrine layout of one seed. */
export function fujiRailway(terrain: Terrain): FujiRailway | null {
  const { world } = terrain;
  if (world.seed !== FUJI_RAIL_SEED) return null;
  const fuji = world.regionById("-7,-2");
  const foothillShrine = world.regionById("-7,-3");
  if (fuji.landmark?.id !== "mount-fuji" || foothillShrine.landmark) return null;
  const angle = 242.5 * Math.PI / 180;
  const along = { x: Math.cos(angle), z: Math.sin(angle) };
  const across = { x: -along.z, z: along.x };
  // Run along the lower valley floor, 46 units from the cone's centre inside the landmark.
  const offset = 46;
  const origin = { x: fuji.site.x - 3.2 + across.x * offset, z: fuji.site.z - 3.2 + across.z * offset };
  const alignment = { origin, along, across };
  return {
    ...alignment,
    height: 3.35,
    landmarkId: fuji.id,
    stations: [
      { distance: -48, shrineId: fuji.id, stand: railPoint(alignment, -46.6, 3.05) },
      { distance: 48, shrineId: foothillShrine.id, stand: railPoint(alignment, 49.4, 3.05) },
    ],
  };
}

/** The prototype platforms sit above the generated ground. These surfaces only support the player's pose. */
export function stationFloor(line: FujiRailway, terrain: Terrain, pos: Point): number | undefined {
  const dx = pos.x - line.origin.x;
  const dz = pos.z - line.origin.z;
  const distance = dx * line.along.x + dz * line.along.z;
  const across = dx * line.across.x + dz * line.across.z;
  for (const station of line.stations) {
    if (Math.abs(distance - station.distance) <= PLATFORM_END && across >= 1.045 && across <= STAIRS.edge) {
      return line.height + PLATFORM_TOP;
    }
    const step = Math.floor((across - STAIRS.edge) / STAIRS.depth);
    if (step < 0 || step >= STAIRS.count) continue;
    const stair = STAIRS.offsets.find((offset) => Math.abs(distance - station.distance - offset) < STAIRS.width / 2);
    if (stair === undefined) continue;
    const base = railPoint(line, station.distance + stair, STAIRS.edge + STAIRS.count * STAIRS.depth);
    const low = terrain.groundAt(base.x, base.z);
    return low + (line.height + PLATFORM_TOP - low) * (STAIRS.count - step) / STAIRS.count;
  }
  return undefined;
}
