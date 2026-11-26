import { PLATFORM_END, PLATFORM_FAR, PLATFORM_NEAR, railCoordinates, railPoint, type FujiRailway, type Obstacle, type Point } from "../world";
import type { GameState } from "./state";

export type StationIndex = 0 | 1;
export const TRAIN_BOARD_SECONDS = 1.15;
export const TRAIN_CAR_LENGTH = 8.08;
export const TRAIN_CAR_OFFSET = 4.2;
export const TRAIN_CAR_WIDTH = 1.76;
const TRAIN_HALF_LENGTH = TRAIN_CAR_OFFSET + TRAIN_CAR_LENGTH / 2 + 0.15;
const TRAIN_HALF_WIDTH = TRAIN_CAR_WIDTH / 2 + 0.05;
export const TRAIN_RUN_SECONDS = 42;
export const TRAIN_TOTAL_SECONDS = TRAIN_BOARD_SECONDS + TRAIN_RUN_SECONDS + 1;

export function otherStation(index: StationIndex): StationIndex {
  return index === 0 ? 1 : 0;
}

export function railwayPowered(line: FujiRailway, state: GameState): boolean {
  return line.requiredRegions.every((id) => state.restored.has(id));
}

export function stationInReach(line: FujiRailway | null, pos: Point): StationIndex | null {
  if (!line) return null;
  const { along, across } = railCoordinates(line, pos);
  if (across < PLATFORM_NEAR - 0.02 || across > PLATFORM_FAR + 1.5) return null;
  for (const index of [0, 1] as const) {
    if (Math.abs(along - line.stations[index].distance) <= PLATFORM_END + 1.5) return index;
  }
  return null;
}

/** Use the nearest cross-section of the parked train's capsule as a solid disc. */
export function parkedTrainObstacle(line: FujiRailway, station: StationIndex, pos: Point, reach: number): Obstacle | null {
  const { along, across } = railCoordinates(line, pos);
  const distance = line.stations[station].distance;
  const halfAxis = TRAIN_HALF_LENGTH - TRAIN_HALF_WIDTH;
  const nearest = Math.max(distance - halfAxis, Math.min(distance + halfAxis, along));
  if (Math.hypot(along - nearest, across) > TRAIN_HALF_WIDTH + reach) return null;
  // An old save or teleport exactly on the centreline should step out toward the platform.
  const centre = railPoint(line, nearest, Math.abs(across) < 1e-5 ? -0.0001 : 0);
  return { ...centre, r: TRAIN_HALF_WIDTH };
}

const clamp = (x: number): number => Math.max(0, Math.min(1, x));

/** Integrate a linear acceleration and braking ramp with a steady cruise in between. */
function distanceProgress(time: number): number {
  const ramp = 0.18;
  if (time < ramp) return time * time / (2 * ramp * (1 - ramp));
  if (time > 1 - ramp) return 1 - distanceProgress(1 - time);
  return (time - ramp / 2) / (1 - ramp);
}

export function trainFrame(line: FujiRailway, from: StationIndex, seconds: number) {
  const progress = distanceProgress(clamp((seconds - TRAIN_BOARD_SECONDS) / TRAIN_RUN_SECONDS));
  const start = line.stations[from].distance;
  const end = line.stations[otherStation(from)].distance;
  const distance = start + (end - start) * progress;
  return {
    distance,
    routeProgress: from === 0 ? progress : 1 - progress,
    direction: from === 0 ? 1 : -1,
    windowView: seconds >= 0.6 && seconds < TRAIN_TOTAL_SECONDS - 0.38,
    fade: Math.max(clamp(1 - Math.abs(seconds - 0.6) / 0.34), clamp(1 - Math.abs(seconds - (TRAIN_TOTAL_SECONDS - 0.38)) / 0.34)),
    boarding: clamp(seconds / 0.62),
    done: seconds >= TRAIN_TOTAL_SECONDS,
  };
}

export type TrainFrame = ReturnType<typeof trainFrame>;
