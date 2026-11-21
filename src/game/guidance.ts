import { reachableRegions, type Point, type Region, type World } from "../world";
import { capabilitiesOf, type GameState } from "./state";

/** How far (in regions from the start) the compass looks for shrines. */
const SEARCH_RADIUS = 8;

export interface Guidance {
  readonly region: Region;
  /** Distance to the shrine, in world units. */
  readonly distance: number;
  /** Ground-space offset from the player to the shrine. */
  readonly dx: number;
  readonly dz: number;
}

const candidateCache = new WeakMap<ReadonlySet<string>, Region[]>();

/** Unrestored shrines the player could walk to right now. Recomputed only when shrines change. */
function reachableUnrestored(world: World, state: GameState): Region[] {
  let hit = candidateCache.get(state.restored);
  if (!hit) {
    hit = reachableRegions(world, capabilitiesOf(state, world), SEARCH_RADIUS).filter(
      (r) => !state.restored.has(r.id),
    );
    candidateCache.set(state.restored, hit);
  }
  return hit;
}

/**
 * The nearest unrestored shrine the player can currently reach, or null.
 * Shrines behind terrain the player can't yet cross are never suggested, so
 * following the guidance can't lead into a dead end.
 */
export function nextShrine(world: World, state: GameState, pos: Point): Guidance | null {
  let best: Guidance | null = null;
  for (const region of reachableUnrestored(world, state)) {
    const dx = region.site.x - pos.x;
    const dz = region.site.z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (!best || distance < best.distance) best = { region, distance, dx, dz };
  }
  return best;
}
