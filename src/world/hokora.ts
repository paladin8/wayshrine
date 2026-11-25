import type { Point } from "./coords";
import type { Region } from "./world";

/**
 * A hokora (祠) is the small shrine a torii leads to. The gate stands at the region's site and the hokora
 * sits behind it, on the far side from where travellers arrive. The hokora is what the player restores;
 * travel still arrives in front of the gate. Every ordinary shrine has one, standing on land, piles or a
 * rock to suit its biome. A landmark is its own shrine and has none.
 */
export const HOKORA_SETBACK = 2.5;
/** The hokora's solid footprint. */
export const HOKORA_RADIUS = 0.6;
/** How close the player must be to the hokora to restore it. */
export const HOKORA_REACH = 2.6;

/** Where a region's hokora stands, or null if its shrine has none. */
export function hokoraOf(region: Region): Point | null {
  if (region.landmark) return null;
  return { x: region.shrine.x, z: region.shrine.z - HOKORA_SETBACK };
}

/** Where the restoration wave starts: the hokora that is restored, not the gate in front of it. A landmark is its own shrine. */
export function waveOriginOf(region: Region): Point {
  return hokoraOf(region) ?? region.shrine;
}
