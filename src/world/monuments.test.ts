import { describe, expect, it } from "vitest";
import { createWorld } from "./world";
import { createTerrain } from "./terrain-grid";
import { MONUMENT_EDGE_MARGIN, MONUMENT_SHRINE_CLEARANCE, planMonuments, type MonumentSpec } from "./monuments";
import { reachableRegions } from "./progression";
import type { Biome } from "./terrain";

const BIOME_CYCLE: Biome[] = ["water", "meadow", "mountain", "snow"];
const specs: MonumentSpec[] = Array.from({ length: 1000 }, (_, i) =>
  i < 50
    ? { id: `h${i}`, kind: "haiku", biome: BIOME_CYCLE[i % 4] as Biome }
    : { id: `p${i}`, kind: "proverb" },
);

describe("planMonuments", () => {
  const terrain = createTerrain(createWorld("monuments"));
  const plan = planMonuments(terrain, specs);

  it("places every text exactly once", () => {
    expect(plan.all).toHaveLength(1000);
    expect(new Set(plan.all.map((m) => m.id)).size).toBe(1000);
  });

  it("is deterministic", () => {
    const again = planMonuments(createTerrain(createWorld("monuments")), specs);
    expect(again.all).toEqual(plan.all);
  });

  it("puts at most two in a region, well apart", () => {
    for (const m of plan.all) {
      const here = plan.inRegion(m.regionId);
      expect(here.length).toBeLessThanOrEqual(2);
      if (here.length === 2) {
        const [a, b] = here as [typeof m, typeof m];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("keeps each clear of the shrine and boundary and on matching ground", () => {
    const world = terrain.world;
    for (const m of plan.all) {
      const region = world.regionAt(m.x, m.z);
      expect(region.id).toBe(m.regionId);
      expect(Math.hypot(m.x - region.shrine.x, m.z - region.shrine.z)).toBeGreaterThanOrEqual(MONUMENT_SHRINE_CLEARANCE);
      expect(terrain.tileAtPoint(m.x, m.z).biome).toBe(region.biome);
      // Margin to the nearest rival site, as the placement measures it.
      let margin = Infinity;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dz) continue;
          const o = world.region(region.coord.rx + dx, region.coord.rz + dz);
          margin = Math.min(
            margin,
            (Math.hypot(m.x - o.site.x, m.z - o.site.z) - Math.hypot(m.x - region.site.x, m.z - region.site.z)) / 2,
          );
        }
      }
      expect(margin).toBeGreaterThanOrEqual(MONUMENT_EDGE_MARGIN);
    }
  });

  it("places haiku in regions of their biome", () => {
    const world = terrain.world;
    const wanted = new Map(specs.map((s) => [s.id, s.biome]));
    for (const m of plan.all.filter((x) => x.kind === "haiku")) {
      expect(world.regionById(m.regionId).biome).toBe(wanted.get(m.id));
    }
  });

  it("spreads out: roughly one monument per region", () => {
    const regions = new Set(plan.all.map((m) => m.regionId));
    expect(regions.size).toBeGreaterThan(550);
    expect(regions.size).toBeLessThan(1000);
  });

  it("only uses regions that can be reached by progression", () => {
    const reachable = new Set(
      reachableRegions(terrain.world, new Set(["boat", "snowshoes", "climbing"]), 30).map((r) => r.id),
    );
    for (const m of plan.all) expect(reachable.has(m.regionId)).toBe(true);
  });
});
