import { describe, expect, it } from "vitest";
import { CAPABILITIES, canTraverse, createTerrain, createWorld } from "../world";
import { nextShrine } from "./guidance";
import { blockerAt, safePosition, startPosition } from "./player";
import { capabilitiesOf, newGame, restoreShrine } from "./state";

describe("nextShrine", () => {
  it("points at the nearest unrestored shrine or landmark", () => {
    const world = createWorld("guide");
    const pos = startPosition(createTerrain(world));
    const g = nextShrine(world, newGame(world.seed), pos)!;
    expect(g.distance).toBeCloseTo(Math.hypot(g.dx, g.dz));
    // Nothing reachable is closer: it picks a landmark only when one is the nearest place.
    const nearer = world.landmarks.filter((l) => Math.hypot(l.site.x - pos.x, l.site.z - pos.z) < g.distance - 1);
    for (const l of nearer) expect(canTraverse(l.biome, new Set())).toBe(false);
  });

  it("never suggests a shrine that can't be reached yet", () => {
    for (let i = 0; i < 40; i++) {
      const world = createWorld(`reach-${i}`);
      let state = newGame(world.seed);
      let pos = world.region(0, 0).site;
      for (let step = 0; step < 12; step++) {
        const g = nextShrine(world, state, pos);
        if (!g) break;
        expect(canTraverse(g.region.biome, capabilitiesOf(state, world))).toBe(true);
        expect(state.restored.has(g.region.id)).toBe(false);
        state = restoreShrine(state, g.region);
        pos = g.region.site;
      }
    }
  });

  it("is enough on its own: following it collects every capability, on every seed", () => {
    for (let i = 0; i < 12; i++) {
      const world = createWorld(`follow-${i}`);
      let state = newGame(world.seed);
      let pos = world.region(0, 0).site;
      for (let step = 0; step < 1500; step++) {
        const g = nextShrine(world, state, pos);
        if (!g) break;
        state = restoreShrine(state, g.region);
        pos = g.region.site;
        if (capabilitiesOf(state, world).size === CAPABILITIES.length) break;
      }
      expect(capabilitiesOf(state, world).size, `seed follow-${i}`).toBe(CAPABILITIES.length);
    }
  }, 120_000);

  it("returns null when every reachable shrine is restored", () => {
    const world = createWorld("exhaust");
    let state = newGame(world.seed);
    for (let i = 0; i < 1500; i++) {
      const g = nextShrine(world, state, { x: 0, z: 0 });
      if (!g) return;
      state = restoreShrine(state, g.region);
    }
    throw new Error("guidance never ran out");
  });
});

describe("safePosition", () => {
  const terrain = createTerrain(createWorld("safe"));
  const none = new Set<never>();

  it("keeps a free position unchanged", () => {
    const p = startPosition(terrain);
    expect(safePosition(terrain, none, p)).toBe(p);
  });

  it("moves a stranded player to nearby free ground", () => {
    const water = terrain.world.landmarks.find((r) => r.biome === "water")!;
    const stranded = { x: water.site.x + 20, z: water.site.z + 20 };
    const out = safePosition(terrain, none, stranded);
    expect(blockerAt(terrain, none, out.x, out.z)).toBeNull();
    expect(Math.hypot(out.x - stranded.x, out.z - stranded.z)).toBeLessThan(70);
  });
});
