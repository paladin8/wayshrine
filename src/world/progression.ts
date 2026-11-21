import { LANDMARKS, capabilitiesForCount } from "./landmarks";
import { reachableCoords } from "./reach";
import type { Capability } from "./terrain";
import type { Region, World } from "./world";

export function reachableRegions(
  world: World,
  capabilities: ReadonlySet<Capability>,
  radius: number,
): Region[] {
  return reachableCoords((rx, rz) => world.region(rx, rz).biome, capabilities, radius).map((c) =>
    world.region(c.rx, c.rz),
  );
}

/**
 * Simulates a player who restores every reachable landmark until nothing new
 * opens up. Used to check that progress is never blocked.
 */
export function greedyProgress(
  world: World,
  radius: number,
): { capabilities: ReadonlySet<Capability>; restored: Set<string> } {
  const restored = new Set<string>();
  for (;;) {
    const capabilities = capabilitiesForCount(restored.size);
    let changed = false;
    for (const region of reachableRegions(world, capabilities, radius)) {
      if (region.landmark && !restored.has(region.id)) {
        restored.add(region.id);
        changed = true;
      }
    }
    if (!changed) return { capabilities, restored };
  }
}

export const LANDMARK_TOTAL = LANDMARKS.length;
