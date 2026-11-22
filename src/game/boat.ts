import { isWater, type Capability, type Obstacles, type Point, type Terrain } from "../world";
import { movePlayer, PLAYER_SPEED } from "./player";

export const BOAT_LAUNCH_SECONDS = 3.1;
export const BOAT_PUSH_OFF_SECONDS = 1.05;
const DRIFT_SECONDS = 1.7;
const DRIFT_DISTANCE = 2.3;

export interface BoatLaunch {
  readonly from: Point;
  readonly entry: Point;
  readonly afloat: Point;
  readonly facing: number;
}

const clamp = (n: number): number => Math.min(1, Math.max(0, n));
const ease = (n: number): number => n * n * (3 - 2 * n);
const between = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

export function onWater(terrain: Terrain, point: Point): boolean {
  return isWater(terrain.tileAtPoint(point.x, point.z).biome);
}

/** Opens at the actual shoreline step, then drifts only as far as the normal movement rules allow. */
export function planBoatLaunch(
  terrain: Terrain,
  caps: ReadonlySet<Capability>,
  obstacles: Obstacles,
  from: Point,
  entry: Point,
): BoatLaunch {
  const direction = { x: entry.x - from.x, z: entry.z - from.z };
  const facing = Math.atan2(direction.x, direction.z);
  let afloat = entry;
  const length = Math.hypot(direction.x, direction.z);
  if (length === 0) return { from, entry, afloat, facing };
  const stride = DRIFT_DISTANCE / 10;
  // Check the drift in small steps so a narrow inlet cannot carry the boat through a bank.
  for (let i = 0; i < 10; i++) {
    const step = movePlayer(afloat, direction, stride / PLAYER_SPEED, terrain, caps, obstacles).pos;
    const expected = { x: afloat.x + direction.x / length * stride, z: afloat.z + direction.z / length * stride };
    if (!onWater(terrain, step) || Math.hypot(expected.x - step.x, expected.z - step.z) > 1e-4) break;
    afloat = step;
  }
  return { from, entry, afloat, facing };
}

/** The hull waits at the waterline while the traveler steps aboard, then pushes off. */
export function boatLaunchFrame(path: BoatLaunch, seconds: number) {
  const boarding = clamp(seconds / BOAT_PUSH_OFF_SECONDS);
  const drift = clamp((seconds - BOAT_PUSH_OFF_SECONDS) / DRIFT_SECONDS);
  const pushOff = ease(drift);
  const hull = between(path.entry, path.afloat, pushOff);
  return {
    hull,
    rider: boarding < 1 ? between(path.from, path.entry, ease(boarding)) : hull,
    lift: Math.sin(boarding * Math.PI) * 0.36,
    seated: ease(clamp((boarding - 0.59) / 0.41)),
    wake: Math.sin(drift * Math.PI),
    done: seconds >= BOAT_LAUNCH_SECONDS,
  };
}
