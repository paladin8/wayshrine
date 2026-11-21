import { neighborsOf, regionId } from "./coords";
import { canTraverse, type Capability } from "./terrain";
import type { Region, World } from "./world";

/**
 * Regions reachable from the origin region on foot-by-region, given a set of
 * capabilities, within a square window of the region grid.
 *
 * This is the region-level model of travel: a region can be entered if its biome
 * is traversable. It is exact for the guarantees in ADR 0003 because each region
 * has a single traversal class and neighbouring regions share a boundary.
 */
export function reachableRegions(
  world: World,
  capabilities: ReadonlySet<Capability>,
  radius: number,
): Region[] {
  const start = world.region(0, 0);
  if (!canTraverse(start.biome, capabilities)) return [];
  const seen = new Set([start.id]);
  const queue: Region[] = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const n of neighborsOf(queue[i]!.coord)) {
      if (Math.abs(n.rx) > radius || Math.abs(n.rz) > radius) continue;
      const id = regionId(n.rx, n.rz);
      if (seen.has(id)) continue;
      const next = world.region(n.rx, n.rz);
      if (!canTraverse(next.biome, capabilities)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return queue;
}

/**
 * Simulates a player who restores every reachable shrine until nothing new
 * opens up. Used to check that progress is never blocked.
 */
export function greedyProgress(
  world: World,
  radius: number,
): { capabilities: Set<Capability>; restored: Set<string> } {
  const capabilities = new Set<Capability>();
  const restored = new Set<string>();
  for (;;) {
    let changed = false;
    for (const region of reachableRegions(world, capabilities, radius)) {
      if (restored.has(region.id)) continue;
      restored.add(region.id);
      changed = true;
      if (region.shrine.grants) capabilities.add(region.shrine.grants);
    }
    if (!changed) return { capabilities, restored };
  }
}
