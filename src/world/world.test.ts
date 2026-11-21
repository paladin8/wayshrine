import { describe, expect, it } from "vitest";
import { neighborsOf, regionId } from "./coords";
import { greedyProgress, reachableRegions } from "./progression";
import { BIOME_REQUIRES, CAPABILITIES } from "./terrain";
import { createWorld } from "./world";

const SEEDS = Array.from({ length: 300 }, (_, i) => `seed-${i}`);

describe("createWorld", () => {
  it("is deterministic per seed", () => {
    const a = createWorld("x");
    const b = createWorld("x");
    for (let rx = -3; rx <= 3; rx++) {
      for (let rz = -3; rz <= 3; rz++) expect(a.region(rx, rz)).toEqual(b.region(rx, rz));
    }
    expect(createWorld("y").region(2, 2).site).not.toEqual(a.region(2, 2).site);
  });

  it("maps a region's site back to that region", () => {
    const w = createWorld("sites");
    for (let rx = -4; rx <= 4; rx++) {
      for (let rz = -4; rz <= 4; rz++) {
        const r = w.region(rx, rz);
        expect(w.regionAt(r.site.x, r.site.z).id).toBe(r.id);
      }
    }
  });

  it("looks regions up by id", () => {
    const w = createWorld("ids");
    expect(w.regionById("-2,5")).toBe(w.region(-2, 5));
    expect(() => w.regionById("nope")).toThrow();
  });

  it("starts in a meadow whose shrine grants the first capability", () => {
    for (const seed of SEEDS) {
      const start = createWorld(seed).region(0, 0);
      expect(start.biome).toBe("meadow");
      expect(start.shrine.grants).toBe(CAPABILITIES[0]);
    }
  });
});

describe("progression spine", () => {
  it("is a self-avoiding path of edge-adjacent regions", () => {
    for (const seed of SEEDS) {
      const { spine } = createWorld(seed);
      expect(spine).toHaveLength(1 + 2 * CAPABILITIES.length);
      expect(new Set(spine.map((r) => r.id)).size).toBe(spine.length);
      for (let i = 1; i < spine.length; i++) {
        const prev = spine[i - 1]!;
        const near = neighborsOf(prev.coord).map((n) => regionId(n.rx, n.rz));
        expect(near).toContain(spine[i]!.id);
      }
    }
  });

  it("alternates keystones and barriers in capability order", () => {
    for (const seed of SEEDS) {
      const { spine } = createWorld(seed);
      spine.forEach((r, i) => {
        expect(r.spineIndex).toBe(i);
        if (i % 2 === 0) {
          // keystone: meadow whose shrine grants the next capability (or nothing at the end)
          expect(r.biome).toBe("meadow");
          expect(r.shrine.grants).toBe(CAPABILITIES[i / 2] ?? null);
        } else {
          // barrier: needs exactly the capability granted by the keystone before it
          expect(BIOME_REQUIRES[r.biome]).toBe(CAPABILITIES[(i - 1) / 2]);
          expect(r.shrine.grants).toBeNull();
        }
      });
    }
  });

  it("keeps each step's straight line inside the two regions it joins", () => {
    // Adjacent grid cells must really share a boundary, so travel between them
    // never has to pass through a third region.
    for (const seed of SEEDS) {
      const w = createWorld(seed);
      for (let i = 1; i < w.spine.length; i++) {
        const a = w.spine[i - 1]!;
        const b = w.spine[i]!;
        for (let t = 0; t <= 24; t++) {
          const f = t / 24;
          const at = w.regionAt(a.site.x + (b.site.x - a.site.x) * f, a.site.z + (b.site.z - a.site.z) * f);
          expect([a.id, b.id]).toContain(at.id);
        }
      }
    }
  });
});

describe("progress guarantees (ADR 0003)", () => {
  it("a greedy player collects every capability, for every seed", () => {
    for (const seed of SEEDS) {
      const { capabilities } = greedyProgress(createWorld(seed), 8);
      expect([...capabilities].sort()).toEqual([...CAPABILITIES].sort());
    }
  });

  it("each capability is obtainable using only the capabilities before it", () => {
    for (const seed of SEEDS) {
      const w = createWorld(seed);
      CAPABILITIES.forEach((_, i) => {
        const have = new Set(CAPABILITIES.slice(0, i));
        const keystone = w.spine[2 * i]!;
        const reachable = reachableRegions(w, have, 8).map((r) => r.id);
        expect(reachable).toContain(keystone.id);
      });
    }
  });

  it("an unrestored shrine is always reachable until every capability is held", () => {
    for (const seed of SEEDS) {
      const w = createWorld(seed);
      const have = new Set<(typeof CAPABILITIES)[number]>();
      for (const cap of CAPABILITIES) {
        const open = reachableRegions(w, have, 8).filter((r) => r.shrine.grants === cap);
        expect(open.length).toBeGreaterThan(0);
        have.add(cap);
      }
    }
  });
});
