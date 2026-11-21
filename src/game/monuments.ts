import type { Monument, MonumentPlan, Point } from "../world";
import type { GameState } from "./state";

/** How close the player must stand to a monument to read it. */
export const MONUMENT_REACH = 2.5;

/** The monument within reach of a point, if any (the nearest). */
export function monumentInReach(plan: MonumentPlan, pos: Point): Monument | null {
  return plan.near(pos.x, pos.z, MONUMENT_REACH)[0] ?? null;
}

/**
 * A monument's text can be read only once its region is restored: in a dead
 * region the inscription is worn smooth.
 */
export function isLegible(state: GameState, m: Monument): boolean {
  return state.restored.has(m.regionId);
}
