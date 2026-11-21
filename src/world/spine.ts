import { createRng } from "../core";
import { neighborsOf, regionId, type RegionCoord } from "./coords";
import { CAPABILITIES, biomeRequiring, type Biome, type Capability } from "./terrain";

export interface SpineCell {
  readonly coord: RegionCoord;
  readonly biome: Biome;
  /** Capability granted by restoring this cell's shrine. */
  readonly grants: Capability | null;
}

/**
 * The progression spine: a lock-and-key chain of edge-adjacent regions, starting
 * at the origin region and derived only from the seed.
 *
 *   keystone(boat) -> barrier(water) -> keystone(snowshoes) -> barrier(snow) -> ...
 *
 * A keystone is a meadow whose shrine grants the next capability. The barrier
 * after it needs exactly that capability, and the next keystone lies beyond.
 * So every capability is obtainable using only the capabilities before it, and
 * the player can never be stranded with nothing to do (see ADR 0003).
 */
export function generateSpine(seed: string): SpineCell[] {
  const rng = createRng(seed).fork("spine");
  const cells: SpineCell[] = [];
  const visited = new Set<string>();
  let at: RegionCoord = { rx: 0, rz: 0 };

  const place = (biome: Biome, grants: Capability | null): void => {
    cells.push({ coord: at, biome, grants });
    visited.add(regionId(at.rx, at.rz));
  };
  const step = (): void => {
    const open = neighborsOf(at).filter((n) => !visited.has(regionId(n.rx, n.rz)));
    if (open.length === 0) throw new Error("spine walk is boxed in");
    at = rng.pick(open);
  };

  place("meadow", CAPABILITIES[0]);
  CAPABILITIES.forEach((capability, i) => {
    step();
    place(biomeRequiring(capability), null);
    step();
    place("meadow", CAPABILITIES[i + 1] ?? null);
  });
  return cells;
}
