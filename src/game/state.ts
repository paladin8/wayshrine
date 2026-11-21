import { canTraverse, type Biome, type Capability, type Region, type World } from "../world";

/**
 * Everything the player has changed about the world. A save is the world seed
 * plus this, nothing else (ADR 0002). Immutable: every update returns a new state.
 */
export interface GameState {
  readonly seed: string;
  /** Ids of regions whose shrines have been restored. */
  readonly restored: ReadonlySet<string>;
}

export function newGame(seed: string): GameState {
  return { seed, restored: new Set() };
}

/** Restores a region's shrine. Restoring twice has no further effect. */
export function restoreShrine(state: GameState, region: Region): GameState {
  if (state.restored.has(region.id)) return state;
  return { ...state, restored: new Set(state.restored).add(region.id) };
}

export function isRestored(state: GameState, region: Region): boolean {
  return state.restored.has(region.id);
}

/** Capabilities held, derived from the shrines restored so far. */
export function capabilitiesOf(state: GameState, world: World): ReadonlySet<Capability> {
  const held = new Set<Capability>();
  for (const id of state.restored) {
    const grants = world.regionById(id).shrine.grants;
    if (grants) held.add(grants);
  }
  return held;
}

export function canEnter(state: GameState, world: World, biome: Biome): boolean {
  return canTraverse(biome, capabilitiesOf(state, world));
}

/** How alive a region looks: 0 is dead and dark, 1 is fully restored. */
export function vitality(state: GameState, region: Region): number {
  return isRestored(state, region) ? 1 : 0;
}

export interface SaveData {
  readonly v: 1;
  readonly seed: string;
  readonly restored: readonly string[];
}

export function serialize(state: GameState): SaveData {
  return { v: 1, seed: state.seed, restored: [...state.restored].sort() };
}

export function deserialize(data: SaveData): GameState {
  if (data.v !== 1) throw new Error(`unsupported save version: ${String(data.v)}`);
  return { seed: data.seed, restored: new Set(data.restored) };
}
