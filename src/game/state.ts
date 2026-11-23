import { FAR_SIGHT_STARS, capabilitiesForCount, canTraverse, createWorld, type Biome, type Capability, type Point, type Region, type World } from "../world";

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
}

/** A region counts as seen when the player is within this distance of its shrine. */
export const DISCOVER_RADIUS = 40;
/** A region also counts as seen once any of its ground is this close, so a neighbour shows up as the player nears its edge. */
export const REVEAL_DISTANCE = 28;
const RUBBINGS_PER_REVEAL = 7;

export function newGame(seed: string): GameState {
  return { seed, restored: new Set(), explored: new Set(), revealedLandmarks: new Set(), shrineCredits: 0, collected: [], boatLaunched: false, snowshoesUsed: false, climbingUsed: false };
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

/** Spend one slot per restored landmark, then mark the unrestored landmarks in story order (by act, nearest the start within an act), so a star never points past the gear the player has; far sight marks them all. */
export function revealLandmarks(state: GameState, world: World): GameState {
  const unrestored = world.landmarks.filter((region) => !isRestored(state, region));
  const restored = world.landmarks.length - unrestored.length;
  const goldStars =
    restored >= FAR_SIGHT_STARS ? unrestored.length : Math.max(0, Math.floor(state.collected.length / RUBBINGS_PER_REVEAL) - restored);
  const start = world.region(0, 0).site;
  const distance = (region: Region): number => Math.hypot(region.site.x - start.x, region.site.z - start.z);
  const revealedLandmarks = new Set(
    unrestored.sort((a, b) => a.landmark!.act - b.landmark!.act || distance(a) - distance(b))
      .slice(0, goldStars)
      .map((region) => region.landmark!.id),
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
  let next: Set<string> | null = null;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const r = world.region(here.coord.rx + dx, here.coord.rz + dz);
      const seen = r.id === here.id || Math.hypot(r.shrine.x - pos.x, r.shrine.z - pos.z) <= DISCOVER_RADIUS;
      if (seen && !state.explored.has(r.id)) {
        next ??= new Set(state.explored);
        next.add(r.id);
      }
    }
  }
  // Any region whose ground lies within REVEAL_DISTANCE: probe rings around the player.
  for (const radius of [REVEAL_DISTANCE / 2, REVEAL_DISTANCE]) {
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
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

/** Records the first step with snowshoes. */
export function recordSnowshoeUse(state: GameState): GameState {
  return state.snowshoesUsed ? state : { ...state, snowshoesUsed: true };
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
  if (state.restored.size === 0 && state.revealedLandmarks.size === 0 && state.shrineCredits === 0 && !state.boatLaunched && !state.snowshoesUsed && !state.climbingUsed) return state;
  return { ...state, restored: new Set(), revealedLandmarks: new Set(), shrineCredits: 0, boatLaunched: false, snowshoesUsed: false, climbingUsed: false };
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
  readonly v: 4;
  readonly revealedLandmarks: readonly string[];
  readonly shrineCredits: number;
}

export type SaveData = SaveV1 | SaveV2 | SaveV3 | SaveV4;

export function serialize(state: GameState): SaveV4 {
  return {
    v: 4,
    seed: state.seed,
    restored: [...state.restored].sort(),
    explored: [...state.explored].sort(),
    collected: [...state.collected],
    revealedLandmarks: [...state.revealedLandmarks],
    shrineCredits: state.shrineCredits,
    boatLaunched: state.boatLaunched,
    snowshoesUsed: state.snowshoesUsed,
    climbingUsed: state.climbingUsed,
  };
}

export function deserialize(data: SaveData, world?: World): GameState {
  const { v, seed } = data;
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4) throw new Error(`unsupported save version: ${String(v)}`);
  const state: GameState = {
    ...newGame(seed),
    restored: new Set(data.restored),
    explored: new Set(v === 1 ? [] : data.explored),
    collected: v === 1 || v === 2 ? [] : [...new Set(data.collected)],
  };
  const current = world?.seed === seed ? world : createWorld(seed);
  if (v === 4) {
    const shrineCredits = Number.isSafeInteger(data.shrineCredits) ? Math.max(0, data.shrineCredits) : 0;
    return revealLandmarks({
      ...state,
      shrineCredits,
      boatLaunched: data.boatLaunched === true,
      snowshoesUsed: data.snowshoesUsed === true,
      climbingUsed: data.climbingUsed === true,
    }, current);
  }
  if (state.restored.size === 0) return revealLandmarks(state, current);
  const previous = createWorld(seed, "spread");
  const currentLandmarks = new Map(current.landmarks.map((region) => [region.landmark!.id, region.id]));
  const previousLandmarks = new Map(previous.landmarks.map((region) => [region.id, region.landmark!.id]));
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
