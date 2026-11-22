import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_THRESHOLDS, createWorld } from "../world";
import {
  landmarksRestored,
  canEnter,
  collectMonument,
  isCollected,
  capabilitiesOf,
  deserialize,
  discoverNear,
  isExplored,
  isLandmarkRevealed,
  isRestored,
  newGame,
  resetGame,
  resetShrines,
  restoreShrine,
  revealLandmarks,
  unrestoreShrine,
  serialize,
  vitality,
  DISCOVER_RADIUS,
} from "./state";

const world = createWorld("game-tests");
const landmark = (n: number) => world.landmarks[n]!;
/** A state with the first `n` landmarks restored. */
const withLandmarks = (n: number) => world.landmarks.slice(0, n).reduce(restoreShrine, newGame(world.seed));

describe("game state", () => {
  it("starts with nothing restored and no capabilities", () => {
    const s = newGame(world.seed);
    expect(capabilitiesOf(s, world).size).toBe(0);
    expect(canEnter(s, world, "meadow")).toBe(true);
    expect(canEnter(s, world, "water")).toBe(false);
  });

  it("restoring an ordinary shrine revives the region but grants nothing", () => {
    const start = world.region(0, 0);
    const s = restoreShrine(newGame(world.seed), start);
    expect(isRestored(s, start)).toBe(true);
    expect(vitality(s, start)).toBe(1);
    expect(capabilitiesOf(s, world).size).toBe(0);
  });

  it("unlocks each ability at its landmark count, not before", () => {
    for (const cap of CAPABILITIES) {
      const need = CAPABILITY_THRESHOLDS[cap];
      expect(capabilitiesOf(withLandmarks(need - 1), world).has(cap)).toBe(false);
      expect(capabilitiesOf(withLandmarks(need), world).has(cap)).toBe(true);
    }
    expect(canEnter(withLandmarks(3), world, "water")).toBe(true);
    expect(canEnter(withLandmarks(3), world, "snow")).toBe(false);
  });

  it("counts landmarks, not shrines", () => {
    let s = withLandmarks(2);
    for (let rx = -2; rx <= 2; rx++) for (let rz = -2; rz <= 2; rz++) s = restoreShrine(s, world.region(rx, rz));
    expect(landmarksRestored(s, world)).toBe(2 + world.landmarks.slice(2).filter((r) => Math.max(Math.abs(r.coord.rx), Math.abs(r.coord.rz)) <= 2).length);
    expect(capabilitiesOf(s, world).has("boat")).toBe(landmarksRestored(s, world) >= 3);
  });

  it("is immutable and idempotent", () => {
    const base = newGame(world.seed);
    const once = restoreShrine(base, landmark(0));
    expect(base.restored.size).toBe(0);
    expect(restoreShrine(once, landmark(0))).toBe(once);
  });

  it("round-trips through a save", () => {
    const s = withLandmarks(3);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s))));
    expect(loaded.seed).toBe(s.seed);
    expect([...loaded.restored].sort()).toEqual([...s.restored].sort());
  });

  it("rejects unknown save versions", () => {
    expect(() => deserialize({ v: 99 } as never)).toThrow();
  });

  it("loads version 1 saves with nothing explored", () => {
    const loaded = deserialize({ v: 1, seed: world.seed, restored: [createWorld(world.seed, "spread").landmarks[0]!.id] });
    expect(loaded.restored.size).toBe(1);
    expect(loaded.explored.size).toBe(0);
  });

  it("migrates the old landmark layout and keeps shrine credit for replaced shrines", () => {
    const world = createWorld("wayshrine");
    const previous = createWorld(world.seed, "spread");
    const replaced = world.landmarks.find((region) => region.landmark!.act > 1 && !previous.regionById(region.id).landmark)!;
    const oldLandmarks = previous.landmarks.slice(0, 3);
    const ordinary = ["0,0", ...Array.from({ length: 18 }, (_, i) => `40,${i}`)];
    const loaded = deserialize({
      v: 3,
      seed: world.seed,
      restored: [...oldLandmarks.map((region) => region.id), ...ordinary, replaced.id],
      explored: ["0,0"],
      collected: ["example"],
    }, world);
    expect(oldLandmarks.map((r) => r.id)).not.toEqual(world.landmarks.slice(0, 3).map((r) => r.id));
    expect(loaded.restored).toEqual(new Set([...world.landmarks.slice(0, 3).map((r) => r.id), ...ordinary]));
    expect(loaded.shrineCredits).toBe(1);
    expect(loaded.collected).toEqual(["example"]);
    expect(loaded.explored).toEqual(new Set(["0,0"]));
    expect(capabilitiesOf(loaded, world).has("boat")).toBe(true);
    expect(isRestored(loaded, replaced)).toBe(false);
    expect(loaded.revealedLandmarks).toEqual(new Set([world.landmarks[3]!.landmark!.id]));
    expect(deserialize(serialize(loaded))).toEqual(loaded);
  });

  it("round-trips exploration", () => {
    const s = discoverNear(newGame(world.seed), world, landmark(0).site);
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
      const near = Math.hypot(r.shrine.x - start.site.x, r.shrine.z - start.site.z) <= DISCOVER_RADIUS;
      expect(isExplored(s, r)).toBe(near);
    }
    expect(isExplored(s, world.region(5, 5))).toBe(false);
  });

  it("returns the same state when nothing is new", () => {
    const s = discoverNear(newGame(world.seed), world, { x: 10, z: 10 });
    expect(discoverNear(s, world, { x: 10, z: 10 })).toBe(s);
  });
});

describe("landmark map reveals", () => {
  it("uses one slot per restored landmark before revealing unrestored landmarks", () => {
    let state = discoverNear(withLandmarks(1), world, landmark(1).shrine);
    expect(isLandmarkRevealed(state, landmark(0))).toBe(false);
    expect(isLandmarkRevealed(state, landmark(1))).toBe(false);

    for (let i = 1; i <= 15; i++) {
      state = revealLandmarks(restoreShrine(state, world.region(30 + i, 0)), world);
      expect(state.revealedLandmarks.size).toBe(Math.max(0, Math.floor(i / 5) - 1));
    }
    const name = (i: number) => landmark(i).landmark!.id;
    expect([...state.revealedLandmarks]).toEqual([name(1), name(2)]);

    const restoredRevealed = restoreShrine(state, landmark(1));
    state = revealLandmarks(restoredRevealed, world);
    expect([...state.revealedLandmarks]).toEqual([name(2)]);
    expect(deserialize(serialize(restoredRevealed), world)).toEqual(state);

    state = revealLandmarks(restoreShrine(state, landmark(4)), world);
    expect(state.revealedLandmarks.size).toBe(0);
    expect(landmarksRestored(state, world)).toBe(3);

    state = revealLandmarks(unrestoreShrine(state, landmark(4)), world);
    expect([...state.revealedLandmarks]).toEqual([name(2)]);
    expect(resetShrines(state).revealedLandmarks.size).toBe(0);
  });

  it("drops surplus reveals when a shrine is un-restored or an older save already has too many", () => {
    const shrines = Array.from({ length: 10 }, (_, i) => world.region(30 + i, 0));
    const revealed = revealLandmarks(shrines.reduce(restoreShrine, newGame(world.seed)), world);
    expect(revealed.revealedLandmarks.size).toBe(2);
    const undidShrine = unrestoreShrine(revealed, shrines[0]!);
    const expected = new Set([landmark(0).landmark!.id]);
    expect(revealLandmarks(undidShrine, world).revealedLandmarks).toEqual(expected);
    expect(deserialize(serialize(undidShrine), world).revealedLandmarks).toEqual(expected);
  });
});

describe("resets", () => {
  const start = world.region(0, 0);

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

  it("un-restores one shrine and leaves the rest, and is a no-op when it was not restored", () => {
    const [a, b] = world.landmarks;
    const both = restoreShrine(restoreShrine(newGame(world.seed), a!), b!);
    const one = unrestoreShrine(both, a!);
    expect(one.restored.has(a!.id)).toBe(false);
    expect(one.restored.has(b!.id)).toBe(true);
    expect(unrestoreShrine(one, a!)).toBe(one);
  });
});
