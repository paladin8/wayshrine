/** Region-grid coordinates and ids. World space is (x, z) on the ground plane. */

/** Side length of one region grid cell, in world units. */
export const REGION_SIZE = 64;

/** Upper bound on the distance from any point in a region to its Voronoi site. */
export const REGION_REACH = REGION_SIZE * 1.125;

export interface Point {
  readonly x: number;
  readonly z: number;
}

export interface RegionCoord {
  readonly rx: number;
  readonly rz: number;
}

export function regionId(rx: number, rz: number): string {
  return `${rx},${rz}`;
}

export function parseRegionId(id: string): RegionCoord {
  const m = /^(-?\d+),(-?\d+)$/.exec(id);
  if (!m) throw new Error(`invalid region id: ${id}`);
  return { rx: Number(m[1]), rz: Number(m[2]) };
}

const NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The four edge-adjacent regions. */
export function neighborsOf(c: RegionCoord): RegionCoord[] {
  return NEIGHBOR_OFFSETS.map(([dx, dz]) => ({ rx: c.rx + dx, rz: c.rz + dz }));
}
