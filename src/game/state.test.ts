import { describe, expect, it } from "vitest";
import { CAPABILITIES, createWorld } from "../world";
import {
  canEnter,
  capabilitiesOf,
  deserialize,
  isRestored,
  newGame,
  restoreShrine,
  serialize,
  vitality,
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
    expect(() => deserialize({ v: 2 as 1, seed: "x", restored: [] })).toThrow();
  });
});
