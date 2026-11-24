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

/** Walks from `start` along `direction` in small steps, as far as `distance` and the normal movement rules allow. */
function drift(
  terrain: Terrain,
  caps: ReadonlySet<Capability>,
  obstacles: Obstacles,
  start: Point,
  direction: Point,
  distance: number,
): Point {
  const length = Math.hypot(direction.x, direction.z);
  if (length === 0) return start;
  let afloat = start;
  const stride = distance / 10;
  // Check the drift in small steps so a narrow inlet cannot carry the hull through a bank.
  for (let i = 0; i < 10; i++) {
    const step = movePlayer(afloat, direction, stride / PLAYER_SPEED, terrain, caps, obstacles).pos;
    const expected = { x: afloat.x + direction.x / length * stride, z: afloat.z + direction.z / length * stride };
    if (!onWater(terrain, step) || Math.hypot(expected.x - step.x, expected.z - step.z) > 1e-4) break;
    afloat = step;
  }
  return afloat;
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
  return { from, entry, afloat: drift(terrain, caps, obstacles, entry, direction, DRIFT_DISTANCE), facing };
}

/** What a launch looks like at one moment: where the hull and the rider are, and how the rider is posed. */
export interface VoyageFrame {
  readonly vessel: "boat" | "ship";
  readonly hull: Point;
  /** Heading of the hull. The ship lies along the bank while boarding, then swings bow-out as it sails. */
  readonly yaw: number;
  readonly rider: Point;
  /** Boat: how high the rider hops in world units. Ship: how far up the gangway, 0 on the quay to 1 on deck. */
  readonly lift: number;
  /** 0 standing, 1 sitting (always 0 aboard the ship). */
  readonly seated: number;
  readonly wake: number;
  /** Whether the rider is walking this frame. */
  readonly walking: boolean;
  /** How much of the ship's gangway is out, 1 while boarding and 0 once it is drawn in (always 0 for the boat). */
  readonly gangway: number;
  readonly done: boolean;
}

/** The hull waits at the waterline while the traveler steps aboard, then pushes off. */
export function boatLaunchFrame(path: BoatLaunch, seconds: number): VoyageFrame {
  const boarding = clamp(seconds / BOAT_PUSH_OFF_SECONDS);
  const drift = clamp((seconds - BOAT_PUSH_OFF_SECONDS) / DRIFT_SECONDS);
  const pushOff = ease(drift);
  const hull = between(path.entry, path.afloat, pushOff);
  return {
    vessel: "boat",
    hull,
    yaw: path.facing,
    rider: boarding < 1 ? between(path.from, path.entry, ease(boarding)) : hull,
    lift: Math.sin(boarding * Math.PI) * 0.36,
    seated: ease(clamp((boarding - 0.59) / 0.41)),
    wake: Math.sin(drift * Math.PI),
    walking: false,
    gangway: 0,
    done: seconds >= BOAT_LAUNCH_SECONDS,
  };
}

/** The ship glides in along the bank while the traveller waits. */
export const SHIP_ARRIVE_SECONDS = 1.3;
/** Boarding the ship takes longer than the boat: a gangway, then the walk across the deck. */
export const SHIP_BOARD_SECONDS = 2.2;
/** The moment the ship casts off, when its theme begins. */
export const SHIP_PUSH_OFF_SECONDS = SHIP_ARRIVE_SECONDS + SHIP_BOARD_SECONDS;
const SHIP_DRIFT_SECONDS = 2.8;
export const SHIP_LAUNCH_SECONDS = SHIP_PUSH_OFF_SECONDS + SHIP_DRIFT_SECONDS;
/** How far along the bank the ship comes from. */
const SHIP_GLIDE_DISTANCE = 4.4;
/** The ship lies along the bank, its near side this close to the shoreline, so the gangway can reach the deck. */
const SHIP_BERTH_DISTANCE = 0.95;
const SHIP_DRIFT_DISTANCE = 3.8;
/** The part of boarding spent on the gangway, before crossing the deck to the helm. */
const GANGWAY_SHARE = 0.5;
/** How far up to deck height the traveller is when stepping off the gangway onto the rail. */
const GANGWAY_RISE = 0.45;
/** The deck is fully reached this far across it. */
const DECK_LEVEL_AT = 0.6;
const GANGWAY_DRAW_IN_SECONDS = 0.45;

export interface ShipLaunch extends BoatLaunch {
  /** Where the ship's centre lies while the traveller boards. */
  readonly berth: Point;
  /** Where the ship comes in from along the bank (the berth itself if the water there is too narrow to glide in). */
  readonly approach: Point;
}

/** Berths the ship along the bank, then lets it slide away as far as the sea allows. */
export function planShipLaunch(
  terrain: Terrain,
  caps: ReadonlySet<Capability>,
  obstacles: Obstacles,
  from: Point,
  entry: Point,
): ShipLaunch {
  const direction = { x: entry.x - from.x, z: entry.z - from.z };
  const facing = Math.atan2(direction.x, direction.z);
  const berth = drift(terrain, caps, obstacles, entry, direction, SHIP_BERTH_DISTANCE);
  // Sailing off, the ship turns bow-out and goes at least far enough that its stern clears the bank.
  const afloat = drift(terrain, caps, obstacles, berth, direction, SHIP_DRIFT_DISTANCE);
  // The ship holds its bow along the bank, so it comes in from astern. It only does that over open water.
  const astern = { x: -Math.cos(facing), z: Math.sin(facing) };
  let approach = berth;
  const along = (d: number): Point => ({ x: berth.x + astern.x * d, z: berth.z + astern.z * d });
  if ([1, 2, 3, 4].every((i) => onWater(terrain, along(SHIP_GLIDE_DISTANCE * i / 4)))) approach = along(SHIP_GLIDE_DISTANCE);
  return { from, entry, berth, approach, afloat, facing };
}

/** The traveller walks the gangway to the deck and crosses to the helm; then the ship slips its mooring and sails off. */
export function shipLaunchFrame(path: ShipLaunch, seconds: number): VoyageFrame {
  const arrive = clamp(seconds / SHIP_ARRIVE_SECONDS);
  const boarding = clamp((seconds - SHIP_ARRIVE_SECONDS) / SHIP_BOARD_SECONDS);
  const sail = clamp((seconds - SHIP_PUSH_OFF_SECONDS) / SHIP_DRIFT_SECONDS);
  const hull = arrive < 1 ? between(path.approach, path.berth, ease(arrive)) : between(path.berth, path.afloat, ease(sail));
  const gangway = clamp(boarding / GANGWAY_SHARE);
  const deck = clamp((boarding - GANGWAY_SHARE) / (1 - GANGWAY_SHARE));
  return {
    vessel: "ship",
    hull,
    yaw: path.facing + Math.PI / 2 * (1 - ease(sail)),
    rider: boarding < 1
      ? (boarding < GANGWAY_SHARE ? between(path.from, path.entry, ease(gangway)) : between(path.entry, path.berth, ease(deck)))
      : hull,
    lift: boarding < GANGWAY_SHARE ? GANGWAY_RISE * ease(gangway) : GANGWAY_RISE + (1 - GANGWAY_RISE) * ease(clamp(deck / DECK_LEVEL_AT)),
    seated: 0,
    wake: Math.sin(sail * Math.PI),
    walking: arrive >= 1 && boarding < 1,
    gangway: arrive < 1 ? 0 : 1 - clamp((seconds - SHIP_PUSH_OFF_SECONDS) / GANGWAY_DRAW_IN_SECONDS),
    done: seconds >= SHIP_LAUNCH_SECONDS,
  };
}
