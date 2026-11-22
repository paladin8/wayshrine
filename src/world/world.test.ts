import { describe, expect, it, vi } from "vitest";
import { REGION_REACH } from "./coords";
import {
  CAPABILITY_THRESHOLDS,
  HOME_RADIUS,
  LANDMARKS,
  LANDMARK_WINDOW,
  capabilitiesForCount,
  landmarksBeforeAct,
  ringRadius,
} from "./landmarks";
import { greedyProgress, reachableRegions } from "./progression";
import { CAPABILITIES, canTraverse } from "./terrain";
import { CLUSTER_SPACING, OUTER_SHARE, OUTER_START, ambientWeights, createWorld } from "./world";
import { BIOMES } from "./terrain";

vi.setConfig({ testTimeout: 60_000 });

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

  it("varies shrine placement within regions while leaving room for the plateau", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const world = createWorld(seed);
      let spread = 0;
      for (let rx = -5; rx <= 5; rx++) {
        for (let rz = -5; rz <= 5; rz++) {
          const region = world.region(rx, rz);
          const { shrine, site } = region;
          if (region.landmark || region.id === "0,0") expect(shrine).toEqual(site);
          else spread = Math.max(spread, Math.hypot(shrine.x - site.x, shrine.z - site.z));
          for (const [dx, dz] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
            expect(world.regionAt(shrine.x + dx, shrine.z + dz)).toBe(region);
          }
        }
      }
      expect(spread).toBeGreaterThan(12);
    }
  });

  it("looks regions up by id", () => {
    const w = createWorld("ids");
    expect(w.regionById("-2,5")).toBe(w.region(-2, 5));
    expect(() => w.regionById("nope")).toThrow();
  });

  it("starts in open meadow", () => {
    for (const seed of SEEDS) {
      const w = createWorld(seed);
      expect(w.region(0, 0).biome).toBe("meadow");
      for (let rx = -HOME_RADIUS; rx <= HOME_RADIUS; rx++) {
        for (let rz = -HOME_RADIUS; rz <= HOME_RADIUS; rz++) {
          if (Math.hypot(rx, rz) <= HOME_RADIUS) expect(w.region(rx, rz).biome).toBe("meadow");
        }
      }
    }
  });
});

describe("region reach", () => {
  it("never extends farther from its Voronoi site than REGION_REACH", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const w = createWorld(seed);
      for (let x = -150; x < 150; x += 3) {
        for (let z = -150; z < 150; z += 3) {
          const r = w.regionAt(x, z);
          expect(Math.hypot(x - r.site.x, z - r.site.z)).toBeLessThanOrEqual(REGION_REACH);
        }
      }
    }
  });
});

describe("landmarks", () => {
  it("places every landmark once, in order, with its own biome", () => {
    for (const seed of SEEDS) {
      const w = createWorld(seed);
      expect(w.landmarks).toHaveLength(LANDMARKS.length);
      expect(new Set(w.landmarks.map((r) => r.id)).size).toBe(LANDMARKS.length);
      w.landmarks.forEach((r, i) => {
        expect(r.landmark).toEqual(LANDMARKS[i]);
        expect(r.biome).toBe(LANDMARKS[i]!.biome);
        expect(r.id).not.toBe("0,0");
      });
    }
  });

  it("has landmarks only where the plan says", () => {
    const w = createWorld("only");
    const ids = new Set(w.landmarks.map((r) => r.id));
    for (let rx = -12; rx <= 12; rx++) {
      for (let rz = -12; rz <= 12; rz++) {
        const r = w.region(rx, rz);
        expect(r.landmark !== null).toBe(ids.has(r.id));
      }
    }
  });

  it("is deterministic and varies with the seed", () => {
    const a = createWorld("lm").landmarks.map((r) => r.id);
    expect(createWorld("lm").landmarks.map((r) => r.id)).toEqual(a);
    expect(createWorld("lm-other").landmarks.map((r) => r.id)).not.toEqual(a);
  });

  it("grows outward: each act sits farther from the start than the one before", () => {
    const mean = (xs: number[]) => xs.reduce((p, q) => p + q, 0) / xs.length;
    const acts = [...new Set(LANDMARKS.map((l) => l.act))];
    const overall = acts.map(() => [] as number[]);
    let pairs = 0;
    let inverted = 0;
    for (const seed of SEEDS.slice(0, 100)) {
      const w = createWorld(seed);
      const means = acts.map((act) =>
        mean(w.landmarks.filter((r) => r.landmark!.act === act).map((r) => Math.hypot(r.coord.rx, r.coord.rz))),
      );
      means.forEach((m, i) => overall[i]!.push(m));
      for (let i = 1; i < means.length; i++) {
        pairs++;
        if (means[i]! <= means[i - 1]!) inverted++; // where the right biome is scarce, a later act can land nearer
      }
    }
    const across = overall.map(mean);
    for (let i = 1; i < across.length; i++) expect(across[i]!).toBeGreaterThan(across[i - 1]!);
    expect(inverted / pairs).toBeLessThan(0.15);
  });

  it("keeps landmarks near the target density", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const w = createWorld(seed);
      const reach = ringRadius(LANDMARKS.length) + 5;
      for (const r of w.landmarks) expect(Math.hypot(r.coord.rx, r.coord.rz)).toBeLessThanOrEqual(reach);
    }
  });

  it("spreads acts around the start rather than in one direction", () => {
    // The bearing of the act centroids should not all fall in one half-plane.
    let spread = 0;
    for (const seed of SEEDS.slice(0, 100)) {
      const w = createWorld(seed);
      const bearings = [2, 3, 4].map((act) => {
        const rs = w.landmarks.filter((r) => r.landmark!.act === act);
        const x = rs.reduce((p, r) => p + r.coord.rx, 0);
        const z = rs.reduce((p, r) => p + r.coord.rz, 0);
        return Math.atan2(z, x);
      });
      const unit = bearings.map((b) => ({ x: Math.cos(b), z: Math.sin(b) }));
      const sum = Math.hypot(unit.reduce((p, u) => p + u.x, 0), unit.reduce((p, u) => p + u.z, 0));
      if (sum < 2.5) spread++;
    }
    expect(spread).toBeGreaterThan(50);
  });
});

describe("unlock thresholds", () => {
  it("are ordered like the abilities and reachable from the landmark list", () => {
    let last = 0;
    for (const cap of CAPABILITIES) {
      expect(CAPABILITY_THRESHOLDS[cap]).toBeGreaterThan(last);
      last = CAPABILITY_THRESHOLDS[cap];
    }
    expect(last).toBeLessThanOrEqual(LANDMARKS.length);
  });

  it("only ever need what the previous acts unlocked", () => {
    // Each ability is unlocked by landmarks that don't themselves need it.
    for (const l of LANDMARKS) expect(canTraverse(l.biome, capabilitiesForCount(landmarksBeforeAct(l.act)))).toBe(true);
  });
});

describe("progress guarantees (ADR 0006)", () => {
  it("a greedy player restores every landmark and gains every ability, for every seed", () => {
    for (const seed of SEEDS) {
      const { capabilities, restored } = greedyProgress(createWorld(seed), LANDMARK_WINDOW);
      expect([...capabilities].sort()).toEqual([...CAPABILITIES].sort());
      expect(restored.size).toBe(LANDMARKS.length);
    }
  });

  it("never runs out of landmarks to reach before all are restored", () => {
    for (const seed of SEEDS) {
      const w = createWorld(seed);
      const restored = new Set<string>();
      // What is reachable only changes when an ability is gained, so search once per ability set.
      const reachable = new Map<number, ReturnType<typeof reachableRegions>>();
      while (restored.size < LANDMARKS.length) {
        const held = capabilitiesForCount(restored.size);
        let all = reachable.get(held.size);
        if (!all) reachable.set(held.size, (all = reachableRegions(w, held, LANDMARK_WINDOW)));
        const open = all.filter((r) => r.landmark && !restored.has(r.id));
        expect(open.length, `${seed} at ${restored.size}`).toBeGreaterThan(0);
        restored.add(open[0]!.id);
      }
    }
  });

  it("some landmarks really are out of reach until an ability is gained", () => {
    // Otherwise the guarantee above would be vacuous.
    let gated = 0;
    for (const seed of SEEDS.slice(0, 50)) {
      const w = createWorld(seed);
      const open = new Set(reachableRegions(w, new Set(), LANDMARK_WINDOW).map((r) => r.id));
      gated += w.landmarks.filter((r) => !open.has(r.id)).length;
    }
    expect(gated).toBeGreaterThan(0);
  });
});

describe("biome distribution", () => {
  it("weights always sum to one", () => {
    for (const d of [0, 5, OUTER_START, OUTER_START + 1.5, 30]) {
      expect(ambientWeights(d).reduce((p, [, w]) => p + w, 0)).toBeCloseTo(1, 9);
    }
  });

  it("keeps the later biomes out of the inner world, so the early acts stay as they were", () => {
    // A cluster takes its biome from its site's distance, and reaches about a cluster's width either side.
    const inner = OUTER_START - CLUSTER_SPACING;
    const outer = new Set(["marsh", "forest", "volcanic", "sea"]);
    for (const seed of SEEDS.slice(0, 20)) {
      const w = createWorld(seed);
      for (let rx = -inner; rx <= inner; rx++) {
        for (let rz = -inner; rz <= inner; rz++) {
          if (Math.hypot(rx, rz) > inner) continue;
          const r = w.region(rx, rz);
          if (!r.landmark) expect(outer.has(r.biome), `${seed} ${r.id}`).toBe(false);
        }
      }
    }
  });

  it("forms patches: neighbouring regions share a biome far more often than chance", () => {
    // With independent regions and the core weights, about 28% of neighbouring pairs would match.
    let same = 0;
    let pairs = 0;
    for (const seed of SEEDS.slice(0, 20)) {
      const w = createWorld(seed);
      for (let rx = -12; rx <= 12; rx++) {
        for (let rz = -12; rz <= 12; rz++) {
          if (Math.hypot(rx, rz) < HOME_RADIUS + 2 || Math.hypot(rx + 1, rz) > 12) continue;
          const a = w.region(rx, rz);
          const b = w.region(rx + 1, rz);
          if (a.landmark || b.landmark) continue;
          pairs++;
          if (a.biome === b.biome) same++;
        }
      }
    }
    expect(same / pairs).toBeGreaterThan(0.5);
  });

  it("fades the later biomes in to their share, and every biome occurs", () => {
    const seen = new Map<string, number>();
    let far = 0;
    for (const seed of SEEDS.slice(0, 20)) {
      const w = createWorld(seed);
      for (let rx = -28; rx <= 28; rx++) {
        for (let rz = -28; rz <= 28; rz++) {
          const r = w.region(rx, rz);
          if (r.landmark || Math.hypot(rx, rz) < OUTER_START + 4) continue;
          far++;
          seen.set(r.biome, (seen.get(r.biome) ?? 0) + 1);
        }
      }
    }
    const later = ["marsh", "forest", "volcanic", "sea"].reduce((p, b) => p + (seen.get(b) ?? 0), 0);
    expect(later / far).toBeGreaterThan(OUTER_SHARE - 0.05);
    expect(later / far).toBeLessThan(OUTER_SHARE + 0.05);
    for (const b of BIOMES) if (b !== "dunes") expect(seen.get(b) ?? 0, b).toBeGreaterThan(0);
    // Dunes exist only as the landmark's own region.
    expect(seen.get("dunes") ?? 0).toBe(0);
  });
});
