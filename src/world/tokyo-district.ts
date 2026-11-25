import { createRng } from "../core";
import type { Point } from "./coords";
import type { Region, World } from "./world";

export type TokyoSurface = "street" | "sidewalk" | "garden";

export const TOKYO_DISTRICT_EDGE = 27;

export function tokyoSurfaceAt(region: Region, x: number, z: number): TokyoSurface | undefined {
  const dx = Math.abs(x - region.site.x), dz = Math.abs(z - region.site.z);
  const edge = Math.max(dx, dz);
  if (edge < 10.5 || edge > TOKYO_DISTRICT_EDGE) return;
  const distance = Math.min(dx, dz, Math.abs(dx - 14), Math.abs(dz - 14));
  if (distance < 1.1) return "street";
  if (distance < 2.1 || edge < 12.5) return "sidewalk";
  return "garden";
}

interface Building extends Point {
  readonly scale: number;
  readonly rotation: number;
  readonly variant: number;
}

const buildings = new WeakMap<World, readonly Building[]>();

/** The tower keeps its original plaza. Street blocks occupy the space around it. */
export function tokyoBuildings(world: World): readonly Building[] {
  const hit = buildings.get(world);
  if (hit) return hit;
  const district = world.landmarks.find((r) => r.landmark?.id === "tokyo-tower");
  const result: Building[] = [];
  buildings.set(world, result);
  if (!district) return result;
  const rng = createRng(world.seed).fork("tokyo-district");
  const blocks = [-23, -17, -9, 9, 17, 23];
  for (const z of blocks) {
    for (const x of blocks) {
      if (Math.max(Math.abs(x), Math.abs(z)) < 15) continue;
      const point = { x: district.site.x + x, z: district.site.z + z };
      const scale = rng.range(0.85, 1.04);
      const variant = rng.next();
      const fits = [-2.4, 2.4].every((dx) => [-2.4, 2.4].every((dz) =>
        world.regionAt(point.x + dx, point.z + dz) === district));
      if (fits) result.push({ ...point, scale, variant, rotation: x < 0 ? Math.PI / 2 : 0 });
    }
  }
  return result;
}
