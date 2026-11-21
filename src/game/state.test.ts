import { describe, expect, it } from "vitest";
import { CAPABILITIES, createWorld } from "../world";
import {
  canEnter,
  collectMonument,
  isCollected,
  capabilitiesOf,
  deserialize,
  discoverNear,
  isExplored,
  isRestored,
  newGame,
  resetGame,
  resetShrines,
  restoreShrine,
  serialize,
  vitality,
  DISCOVER_RADIUS,
} from "./state";

const world = createWorld("game-tests");

describe("game state", () => {
  it("starts with nothing restored and no capabilities", () => {
    const s = newGame(world.seed);
    expect(capabilitiesOf(s, world).size).toBe(0);
    expect(canEnter(s, world, "meadow")).toBe(true);
    expect(canEnter(s, world, "water")).toBe(false);
  });

  it("restoring a keystone shrine grants its capability and revives the region", () => {
    const start = world.spine[0]!;
    const s = restoreShrine(newGame(world.seed), start);
    expect(isRestored(s, start)).toBe(true);
    expect(vitality(s, start)).toBe(1);
    expect(capabilitiesOf(s, world).has(CAPABILITIES[0])).toBe(true);
    expect(canEnter(s, world, "water")).toBe(true);
    expect(canEnter(s, world, "snow")).toBe(false);
  });

  it("is immutable and idempotent", () => {
    const base = newGame(world.seed);
    const once = restoreShrine(base, world.spine[0]!);
    expect(base.restored.size).toBe(0);
    expect(restoreShrine(once, world.spine[0]!)).toBe(once);
  });

  it("round-trips through a save", () => {
    let s = newGame(world.seed);
    for (const r of world.spine.slice(0, 3)) s = restoreShrine(s, r);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s))));
    expect(loaded.seed).toBe(s.seed);
    expect([...loaded.restored].sort()).toEqual([...s.restored].sort());
  });

  it("rejects unknown save versions", () => {
    expect(() => deserialize({ v: 4 } as never)).toThrow();
  });

  it("loads version 1 saves with nothing explored", () => {
    const loaded = deserialize({ v: 1, seed: world.seed, restored: [world.spine[0]!.id] });
    expect(loaded.restored.size).toBe(1);
    expect(loaded.explored.size).toBe(0);
  });

  it("round-trips exploration", () => {
    const s = discoverNear(newGame(world.seed), world, world.spine[0]!.site);
    expect(deserialize(JSON.parse(JSON.stringify(serialize(s)))).explored).toEqual(s.explored);
  });
});

describe("exploration", () => {
  it("always explores the region the player stands in", () => {
    const here = world.regionAt(100, -40);
    const s = discoverNear(newGame(world.seed), world, { x: 100, z: -40 });
    expect(isExplored(s, here)).toBe(true);
  });

  it("explores nearby shrines but not distant ones", () => {
    const start = world.region(0, 0);
    const s = discoverNear(newGame(world.seed), world, start.site);
    for (const r of [world.region(1, 0), world.region(-1, 0), world.region(0, 1), world.region(0, -1)]) {
      const near = Math.hypot(r.site.x - start.site.x, r.site.z - start.site.z) <= DISCOVER_RADIUS;
      expect(isExplored(s, r)).toBe(near);
    }
    expect(isExplored(s, world.region(5, 5))).toBe(false);
  });

  it("returns the same state when nothing is new", () => {
    const s = discoverNear(newGame(world.seed), world, { x: 10, z: 10 });
    expect(discoverNear(s, world, { x: 10, z: 10 })).toBe(s);
  });
});

describe("resets", () => {
  const start = world.spine[0]!;

  it("resetShrines clears restorations but keeps exploration", () => {
    const s = restoreShrine(discoverNear(newGame(world.seed), world, start.site), start);
    const reset = resetShrines(s);
    expect(reset.restored.size).toBe(0);
    expect(reset.explored).toBe(s.explored);
    expect(capabilitiesOf(reset, world).size).toBe(0);
  });

  it("resetGame returns a fresh game on the same seed", () => {
    const s = restoreShrine(discoverNear(newGame(world.seed), world, start.site), start);
    const fresh = resetGame(s);
    expect(fresh.seed).toBe(s.seed);
    expect(fresh.restored.size + fresh.explored.size).toBe(0);
  });
});

describe("collecting monuments", () => {
  it("records each text once, in order, and survives a save", () => {
    let s = newGame("c");
    s = collectMonument(s, "b");
    s = collectMonument(s, "a");
    expect(collectMonument(s, "b")).toBe(s);
    expect(s.collected).toEqual(["b", "a"]);
    expect(isCollected(s, "a")).toBe(true);
    expect(deserialize(serialize(s)).collected).toEqual(["b", "a"]);
  });

  it("loads version 2 saves with nothing collected", () => {
    expect(deserialize({ v: 2, seed: "s", restored: [], explored: [] }).collected).toEqual([]);
  });
});
