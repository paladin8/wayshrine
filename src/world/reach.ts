import { neighborsOf, regionId, type RegionCoord } from "./coords";
import { canTraverse, type Biome, type Capability } from "./terrain";

/**
 * Region coordinates reachable from the origin by walking region to region,
 * given a biome function and capabilities, within a Chebyshev window.
 *
 * This is the region-level model of travel: a region can be entered if its biome
 * is traversable. It is exact for the guarantees in ADR 0006 because each region
 * has a single traversal class and neighbouring regions share a boundary.
 */
export function reachableCoords(
  biomeOf: (rx: number, rz: number) => Biome,
  capabilities: ReadonlySet<Capability>,
  radius: number,
): RegionCoord[] {
  if (!canTraverse(biomeOf(0, 0), capabilities)) return [];
  const seen = new Set([regionId(0, 0)]);
  const queue: RegionCoord[] = [{ rx: 0, rz: 0 }];
  for (let i = 0; i < queue.length; i++) {
    for (const n of neighborsOf(queue[i]!)) {
      if (Math.abs(n.rx) > radius || Math.abs(n.rz) > radius) continue;
      const id = regionId(n.rx, n.rz);
      if (seen.has(id)) continue;
      if (!canTraverse(biomeOf(n.rx, n.rz), capabilities)) continue;
      seen.add(id);
      queue.push(n);
    }
  }
  return queue;
}
