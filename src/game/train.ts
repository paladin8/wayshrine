import type { FujiRailway, Point } from "../world";
import type { GameState } from "./state";

export type StationIndex = 0 | 1;
export const TRAIN_BOARD_SECONDS = 1.15;
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
  for (const index of [0, 1] as const) {
    const { stand } = line.stations[index];
    if (Math.hypot(stand.x - pos.x, stand.z - pos.z) <= 3.4) return index;
  }
  return null;
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
