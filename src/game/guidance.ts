import { LANDMARK_WINDOW, anchorOf, reachableRegions, type Capability, type Point, type Region, type World } from "../world";
import { capabilitiesOf, type GameState } from "./state";

/** How far (in regions from the start) the compass looks. Matches the landmark planner's window. */
const SEARCH_RADIUS = LANDMARK_WINDOW;

export interface Guidance {
  readonly region: Region;
  /** Distance to the shrine, in world units. */
  readonly distance: number;
  /** Ground-space offset from the player to the shrine. */
  readonly dx: number;
  readonly dz: number;
}

const candidateCache = new WeakMap<ReadonlySet<string>, Region[]>();
const reachCache = new WeakMap<World, Map<string, Region[]>>();

/** Regions the player could walk to with these abilities. They depend on the abilities only, so search once per set. */
function reachableWith(world: World, capabilities: ReadonlySet<Capability>): Region[] {
  let byCaps = reachCache.get(world);
  if (!byCaps) reachCache.set(world, (byCaps = new Map()));
  const key = [...capabilities].sort().join(",");
  let hit = byCaps.get(key);
  if (!hit) byCaps.set(key, (hit = reachableRegions(world, capabilities, SEARCH_RADIUS)));
  return hit;
}

/** Unrestored shrines the player could walk to right now. Recomputed only when shrines change. */
function reachableUnrestored(world: World, state: GameState): Region[] {
  let hit = candidateCache.get(state.restored);
  if (!hit) {
    hit = reachableWith(world, capabilitiesOf(state, world)).filter((r) => !state.restored.has(r.id));
    candidateCache.set(state.restored, hit);
  }
  return hit;
}

/**
 * The nearest unrestored shrine or landmark the player can currently reach, or
 * null. Places behind terrain the player can't yet cross are never suggested, so
 * following the guidance can't lead into a dead end.
 */
export function nextShrine(world: World, state: GameState, pos: Point): Guidance | null {
  const open = reachableUnrestored(world, state);
  let best: Guidance | null = null;
  for (const region of open) {
    const at = anchorOf(region);
    const dx = at.x - pos.x;
    const dz = at.z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (!best || distance < best.distance) best = { region, distance, dx, dz };
  }
  return best;
}
