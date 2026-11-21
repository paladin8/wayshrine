import { capabilitiesForCount, canTraverse, type Biome, type Capability, type Point, type Region, type World } from "../world";

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
  /** Ids of the texts whose monuments the player has read, in the order found. */
  readonly collected: readonly string[];
}

/** A region counts as seen when the player is within this distance of its shrine. */
export const DISCOVER_RADIUS = 40;

export function newGame(seed: string): GameState {
  return { seed, restored: new Set(), explored: new Set(), collected: [] };
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
      const seen = r.id === here.id || Math.hypot(r.site.x - pos.x, r.site.z - pos.z) <= DISCOVER_RADIUS;
      if (seen && !state.explored.has(r.id)) {
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

/** Un-restores every shrine, keeping what has been explored. For debugging. */
export function resetShrines(state: GameState): GameState {
  return state.restored.size === 0 ? state : { ...state, restored: new Set() };
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

export type SaveData = SaveV1 | SaveV2 | SaveV3;

export function serialize(state: GameState): SaveV3 {
  return {
    v: 3,
    seed: state.seed,
    restored: [...state.restored].sort(),
    explored: [...state.explored].sort(),
    collected: [...state.collected],
  };
}

export function deserialize(data: SaveData): GameState {
  const version = (data as { v: unknown }).v;
  if (version === 1) return { seed: data.seed, restored: new Set(data.restored), explored: new Set(), collected: [] };
  if (version === 2) {
    const d = data as SaveV2;
    return { seed: d.seed, restored: new Set(d.restored), explored: new Set(d.explored), collected: [] };
  }
  if (version === 3) {
    const d = data as SaveV3;
    return {
      seed: d.seed,
      restored: new Set(d.restored),
      explored: new Set(d.explored),
      collected: [...new Set(d.collected)],
    };
  }
  throw new Error(`unsupported save version: ${String(version)}`);
}
