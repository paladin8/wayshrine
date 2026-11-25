import { createRng } from "../core";
import { PILGRIMS_WAKE_STARS, REGION_SIZE, capabilitiesForCount, canTraverse, createWorld, type Biome, type Capability, type Point, type Region, type World } from "../world";

/**
 * Everything the player has changed about the world. A save is the world seed
 * plus this, nothing else (ADR 0002). Immutable: every update returns a new state.
 */
export interface GameState {
  readonly seed: string;
  /** Ids of regions whose shrines have been restored. */
  readonly restored: ReadonlySet<string>;
  /** Ids of regions the player has seen; drives what the map reveals. */
  readonly explored: ReadonlySet<string>;
  /** Unrestored landmark IDs currently shown as gold stars. */
  readonly revealedLandmarks: ReadonlySet<string>;
  /** Legacy count of ordinary shrines replaced by landmarks during save migration. */
  readonly shrineCredits: number;
  /** Ids of the texts whose monuments the player has read, in the order found. */
  readonly collected: readonly string[];
  /** The first boat launch ceremony has been completed in this save. */
  readonly boatLaunched: boolean;
  readonly snowshoesUsed: boolean;
  /** The first time the walking sticks came out on a mountain. */
  readonly climbingUsed: boolean;
  readonly getaUsed: boolean;
  readonly lanternUsed: boolean;
  readonly ashSandalsUsed: boolean;
  /** The first ship departure ceremony has been completed in this save. */
  readonly shipLaunched: boolean;
}

/** A region counts as seen when the player is within this distance of its shrine. Small at first: about what the camera shows. */
export const DISCOVER_RADIUS = 26;
/** A region also counts as seen once any of its ground is this close, so a neighbour shows up as the player nears its edge. */
export const REVEAL_DISTANCE = 12;
/** The same two distances once Pilgrim’s Wake is held: the traveller senses the land far beyond the camera. */
export const WAKE_DISCOVER_RADIUS = 150;
export const WAKE_REVEAL_DISTANCE = 110;
const RUBBINGS_PER_REVEAL = 7;

export function newGame(seed: string): GameState {
  return { seed, restored: new Set(), explored: new Set(), revealedLandmarks: new Set(), shrineCredits: 0, collected: [], boatLaunched: false, snowshoesUsed: false, climbingUsed: false, getaUsed: false, lanternUsed: false, ashSandalsUsed: false, shipLaunched: false };
}

/** Restores a region's shrine. Restoring twice has no further effect. */
export function restoreShrine(state: GameState, region: Region): GameState {
  if (state.restored.has(region.id)) return state;
  return { ...state, restored: new Set(state.restored).add(region.id) };
}

export function isRestored(state: GameState, region: Region): boolean {
  return state.restored.has(region.id);
}

export function isExplored(state: GameState, region: Region): boolean {
  return state.explored.has(region.id);
}

/** Whether the map shows this unrestored landmark with a gold star. */
export function isLandmarkRevealed(state: GameState, region: Region): boolean {
  return region.landmark !== null && state.revealedLandmarks.has(region.landmark.id);
}

/**
 * Whether the map shows this landmark with a star: restored, revealed by rubbings (see `revealLandmarks`), or
 * simply discovered by exploring its region. The three are independent: exploring never changes
 * `revealedLandmarks`, so rubbings keep revealing stars exactly as before.
 */
export function isLandmarkMarked(state: GameState, region: Region): boolean {
  return region.landmark !== null && (isRestored(state, region) || isLandmarkRevealed(state, region) || isExplored(state, region));
}

/**
 * Landmarks are hinted in one fixed order (by act, then a seeded rank): every seven rubbings cover the next
 * landmark in that order, and the unrestored ones among the covered get a gold star. Restoring a landmark that
 * is not yet covered (found out of order) never uncovers one that is.
 */
export function revealLandmarks(state: GameState, world: World): GameState {
  const covered = Math.floor(state.collected.length / RUBBINGS_PER_REVEAL);
  const order = createRng(world.seed).fork("landmark-reveals");
  const revealedLandmarks = new Set(
    world.landmarks.map((region) => ({ landmark: region.landmark!, restored: isRestored(state, region), rank: order.fork(region.landmark!.id).next() }))
      .sort((a, b) => a.landmark.act - b.landmark.act || a.rank - b.rank || a.landmark.order - b.landmark.order)
      .slice(0, covered)
      .filter((entry) => !entry.restored)
      .map(({ landmark }) => landmark.id),
  );
  if (
    revealedLandmarks.size === state.revealedLandmarks.size &&
    [...revealedLandmarks].every((id) => state.revealedLandmarks.has(id))
  ) return state;
  return { ...state, revealedLandmarks };
}

/**
 * Marks the player's region and any shrine close enough to see as explored.
 * Returns the same object when nothing is new, so callers can cheaply detect change.
 */
export function discoverNear(state: GameState, world: World, pos: Point): GameState {
  const here = world.regionAt(pos.x, pos.z);
  const woke = landmarksRestored(state, world) >= PILGRIMS_WAKE_STARS;
  const sight = woke ? WAKE_DISCOVER_RADIUS : DISCOVER_RADIUS;
  const reveal = woke ? WAKE_REVEAL_DISTANCE : REVEAL_DISTANCE;
  const reach = Math.max(1, Math.ceil(sight / REGION_SIZE));
  let next: Set<string> | null = null;
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const r = world.region(here.coord.rx + dx, here.coord.rz + dz);
      const seen = r.id === here.id || Math.hypot(r.shrine.x - pos.x, r.shrine.z - pos.z) <= sight;
      if (seen && !state.explored.has(r.id)) {
        next ??= new Set(state.explored);
        next.add(r.id);
      }
    }
  }
  // Any region whose ground lies within the reveal distance: probe rings around the player, spaced well inside a region.
  for (const radius of [reveal / 3, (reveal * 2) / 3, reveal]) {
    const probes = Math.max(12, Math.ceil((2 * Math.PI * radius) / 16));
    for (let k = 0; k < probes; k++) {
      const a = (k * 2 * Math.PI) / probes;
      const r = world.regionAt(pos.x + Math.cos(a) * radius, pos.z + Math.sin(a) * radius);
      if (!state.explored.has(r.id) && !next?.has(r.id)) {
        next ??= new Set(state.explored);
        next.add(r.id);
      }
    }
  }
  return next ? { ...state, explored: next } : state;
}

/** Records a monument's text as read. Reading twice has no further effect. */
export function collectMonument(state: GameState, id: string): GameState {
  if (state.collected.includes(id)) return state;
  return { ...state, collected: [...state.collected, id] };
}

export function isCollected(state: GameState, id: string): boolean {
  return state.collected.includes(id);
}

/** Records completion of the first voyage. */
export function recordBoatLaunch(state: GameState): GameState {
  return state.boatLaunched ? state : { ...state, boatLaunched: true };
}

/** Records completion of the first ship departure. */
export function recordShipLaunch(state: GameState): GameState {
  return state.shipLaunched ? state : { ...state, shipLaunched: true };
}

/** Records the first step with snowshoes. */
export function recordSnowshoeUse(state: GameState): GameState {
  return state.snowshoesUsed ? state : { ...state, snowshoesUsed: true };
}

/** Records the first step in geta on marsh. */
export function recordGetaUse(state: GameState): GameState {
  return state.getaUsed ? state : { ...state, getaUsed: true };
}

/** Records the first step in ash sandals on volcanic ground. */
export function recordAshSandalsUse(state: GameState): GameState {
  return state.ashSandalsUsed ? state : { ...state, ashSandalsUsed: true };
}

/** Records the first lighting of the lantern. */
export function recordLanternUse(state: GameState): GameState {
  return state.lanternUsed ? state : { ...state, lanternUsed: true };
}

/** Records the first time the walking sticks are drawn on a mountain. */
export function recordClimbUse(state: GameState): GameState {
  return state.climbingUsed ? state : { ...state, climbingUsed: true };
}

/** Un-restores one shrine or landmark. For debugging. */
export function unrestoreShrine(state: GameState, region: Region): GameState {
  if (!state.restored.has(region.id)) return state;
  const restored = new Set(state.restored);
  restored.delete(region.id);
  return { ...state, restored };
}

/** Un-restores every shrine, keeping what has been explored. For debugging. */
export function resetShrines(state: GameState): GameState {
  if (state.restored.size === 0 && state.revealedLandmarks.size === 0 && state.shrineCredits === 0 && !state.boatLaunched && !state.snowshoesUsed && !state.climbingUsed && !state.getaUsed && !state.lanternUsed && !state.ashSandalsUsed && !state.shipLaunched) return state;
  return { ...state, restored: new Set(), revealedLandmarks: new Set(), shrineCredits: 0, boatLaunched: false, snowshoesUsed: false, climbingUsed: false, getaUsed: false, lanternUsed: false, ashSandalsUsed: false, shipLaunched: false };
}

/** Back to a brand-new game on the same seed. For debugging. */
export function resetGame(state: GameState): GameState {
  return newGame(state.seed);
}

/** How many landmarks have been restored. */
export function landmarksRestored(state: GameState, world: World): number {
  let n = 0;
  for (const id of state.restored) if (world.regionById(id).landmark) n++;
  return n;
}

/** Capabilities held, derived from the landmarks restored so far (ADR 0006). */
export function capabilitiesOf(state: GameState, world: World): ReadonlySet<Capability> {
  return capabilitiesForCount(landmarksRestored(state, world));
}

export function canEnter(state: GameState, world: World, biome: Biome): boolean {
  return canTraverse(biome, capabilitiesOf(state, world));
}

/** How alive a region looks: 0 is dead and dark, 1 is fully restored. */
export function vitality(state: GameState, region: Region): number {
  return isRestored(state, region) ? 1 : 0;
}

/** Saves written before exploration was tracked. */
export interface SaveV1 {
  readonly v: 1;
  readonly seed: string;
  readonly restored: readonly string[];
}

export interface SaveV2 {
  readonly v: 2;
  readonly seed: string;
  readonly restored: readonly string[];
  readonly explored: readonly string[];
}

export interface SaveV3 {
  readonly v: 3;
  readonly seed: string;
  readonly restored: readonly string[];
  readonly explored: readonly string[];
  readonly collected: readonly string[];
}

export interface SaveV4 extends Omit<SaveV3, "v"> {
  readonly boatLaunched?: boolean;
  readonly snowshoesUsed?: boolean;
  readonly climbingUsed?: boolean;
  readonly getaUsed?: boolean;
  readonly lanternUsed?: boolean;
  readonly ashSandalsUsed?: boolean;
  readonly shipLaunched?: boolean;
  readonly v: 4;
  readonly revealedLandmarks: readonly string[];
  readonly shrineCredits: number;
}

export interface SaveV5 extends Omit<SaveV4, "v"> {
  readonly v: 5;
}

export type SaveData = SaveV1 | SaveV2 | SaveV3 | SaveV4 | SaveV5;

/** The meadow slots exchanged landmarks, so pre-v5 saves refer to the inverse labels. */
function landmarkBeforeTokyoMove(id: string): string {
  if (id === "tokyo-tower") return "kumamoto-castle";
  if (id === "kumamoto-castle") return "tokyo-tower";
  return id;
}

export function serialize(state: GameState): SaveV5 {
  return {
    v: 5,
    seed: state.seed,
    restored: [...state.restored].sort(),
    explored: [...state.explored].sort(),
    collected: [...state.collected],
    revealedLandmarks: [...state.revealedLandmarks],
    shrineCredits: state.shrineCredits,
    boatLaunched: state.boatLaunched,
    snowshoesUsed: state.snowshoesUsed,
    climbingUsed: state.climbingUsed,
    getaUsed: state.getaUsed,
    lanternUsed: state.lanternUsed,
    ashSandalsUsed: state.ashSandalsUsed,
    shipLaunched: state.shipLaunched,
  };
}

export function deserialize(data: SaveData, world?: World): GameState {
  const { v, seed } = data;
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5) throw new Error(`unsupported save version: ${String(v)}`);
  const state: GameState = {
    ...newGame(seed),
    restored: new Set(data.restored),
    explored: new Set(v === 1 ? [] : data.explored),
    collected: v === 1 || v === 2 ? [] : [...new Set(data.collected)],
  };
  const current = world?.seed === seed ? world : createWorld(seed);
  if (v === 4 || v === 5) {
    const restored = new Set(state.restored);
    if (v === 4 && restored.size > 0) {
      const tokyo = current.landmarks.find((r) => r.landmark?.id === "tokyo-tower");
      const kumamoto = current.landmarks.find((r) => r.landmark?.id === "kumamoto-castle");
      if (tokyo && kumamoto) {
        if (state.restored.has(tokyo.id)) restored.add(kumamoto.id);
        else restored.delete(kumamoto.id);
        if (state.restored.has(kumamoto.id)) restored.add(tokyo.id);
        else restored.delete(tokyo.id);
      }
    }
    const shrineCredits = Number.isSafeInteger(data.shrineCredits) ? Math.max(0, data.shrineCredits) : 0;
    return revealLandmarks({
      ...state,
      restored,
      shrineCredits,
      boatLaunched: data.boatLaunched === true,
      snowshoesUsed: data.snowshoesUsed === true,
      climbingUsed: data.climbingUsed === true,
      getaUsed: data.getaUsed === true,
      lanternUsed: data.lanternUsed === true,
      ashSandalsUsed: data.ashSandalsUsed === true,
      shipLaunched: data.shipLaunched === true,
    }, current);
  }
  if (state.restored.size === 0) return revealLandmarks(state, current);
  const previous = createWorld(seed, "spread");
  const currentLandmarks = new Map(current.landmarks.map((region) => [region.landmark!.id, region.id]));
  const previousLandmarks = new Map(previous.landmarks.map((region) => [region.id, landmarkBeforeTokyoMove(region.landmark!.id)]));
  const restored = new Set<string>();
  let shrineCredits = 0;
  for (const id of state.restored) {
    const landmark = previousLandmarks.get(id);
    if (landmark !== undefined) {
      const moved = currentLandmarks.get(landmark);
      if (moved !== undefined) restored.add(moved);
    } else if (current.regionById(id).landmark) {
      // Keep the legacy shrine count without restoring the landmark now at that site.
      shrineCredits++;
    } else {
      restored.add(id);
    }
  }
  return revealLandmarks({ ...state, restored, shrineCredits }, current);
}
