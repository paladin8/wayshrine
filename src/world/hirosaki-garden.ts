import { createRng } from "../core";
import type { Point } from "./coords";
import type { World } from "./world";

const BRIDGE_X = -2.7;
const PATH_START = 10.2;
const PATH_WIDTH = 1.45;
const GROVE_WIDTH = 5.3;

interface Cherry extends Point {
  readonly scale: number;
  readonly rotation: number;
  readonly variant: number;
}

interface HirosakiGarden {
  readonly regionId: string;
  readonly origin: Point;
  readonly pathEnd: number;
  readonly bend: number;
  readonly trees: readonly Cherry[];
}

const gardens = new WeakMap<World, HirosakiGarden | null>();

function pathOffset(bend: number, distance: number): number {
  return BRIDGE_X + bend * Math.max(0, (distance - PATH_START) / 13) ** 2;
}

/** Continue the model's bridge approach into an avenue that fits inside its snow region. */
export function hirosakiGarden(world: World): HirosakiGarden | null {
  const cached = gardens.get(world);
  if (cached !== undefined) return cached;
  const region = world.landmarks.find(({ landmark }) => landmark?.id === "hirosaki-castle");
  if (!region) {
    gardens.set(world, null);
    return null;
  }

  const origin = region.shrine;
  const rng = createRng(world.seed).fork("hirosaki-garden");
  const bend = rng.range(2.3, 4.2) * (rng.chance(0.5) ? -1 : 1);
  const fits = (distance: number): boolean => {
    const x = origin.x + pathOffset(bend, distance);
    const z = origin.z + distance;
    return [-GROVE_WIDTH, 0, GROVE_WIDTH].every((dx) => world.regionAt(x + dx, z).id === region.id);
  };
  let pathEnd = PATH_START;
  for (let distance = PATH_START + 0.5; distance <= 24.2 && fits(distance + 0.8); distance += 0.5) {
    pathEnd = distance;
  }

  const trees: Cherry[] = [];
  for (let distance = 12.8; distance < pathEnd - 0.75; distance += 2.8) {
    for (const side of [-1, 1]) {
      const z = distance + rng.range(-0.38, 0.38);
      const x = origin.x + pathOffset(bend, z) + side * rng.range(2.8, 3.55);
      const scale = rng.range(0.95, 1.42);
      const rotation = rng.range(0, Math.PI * 2);
      const variant = rng.next();
      if (world.regionAt(x, origin.z + z).id === region.id) {
        trees.push({ x, z: origin.z + z, scale, rotation, variant });
      }
    }
  }
  const result = { regionId: region.id, origin, pathEnd, bend, trees };
  gardens.set(world, result);
  return result;
}

/** The centre line of the avenue, measured outwards from the castle. */
export function hirosakiPathPoint(garden: HirosakiGarden, distance: number): Point {
  return {
    x: garden.origin.x + pathOffset(garden.bend, distance),
    z: garden.origin.z + distance,
  };
}

/** Grade the middle of the avenue, tapering into snow on the sides and at the entrance. */
export function hirosakiPath(garden: HirosakiGarden, x: number, z: number): number {
  const distance = z - garden.origin.z;
  if (distance < PATH_START || distance >= garden.pathEnd) return 0;
  const across = Math.abs(x - hirosakiPathPoint(garden, distance).x);
  return Math.min(1, (garden.pathEnd - distance) / 3) * Math.max(0, Math.min(1, (PATH_WIDTH - across) / 0.55));
}

export function hirosakiClearing(garden: HirosakiGarden, x: number, z: number): boolean {
  const distance = z - garden.origin.z;
  return distance >= PATH_START && distance < garden.pathEnd
    && Math.abs(x - hirosakiPathPoint(garden, distance).x) < GROVE_WIDTH;
}
