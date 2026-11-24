import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_THRESHOLDS, FAR_SIGHT_STARS, createWorld } from "../world";
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
  recordAshSandalsUse,
  recordClimbUse,
  recordGetaUse,
  recordLanternUse,
  recordSnowshoeUse,
  resetGame,
  resetShrines,
  restoreShrine,
  revealLandmarks,
  unrestoreShrine,
  serialize,
  vitality,
  DISCOVER_RADIUS,
  REVEAL_DISTANCE,
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

  it("records the first climb once, survives reload, and defaults old saves to unused", () => {
    const original = withLandmarks(CAPABILITY_THRESHOLDS.climbing);
    expect(original.climbingUsed).toBe(false);
    const used = recordClimbUse(original);
    expect(recordClimbUse(used)).toBe(used);
    const { climbingUsed: _absent, ...old } = serialize(used);
    expect(deserialize(old, world).climbingUsed).toBe(false);
    expect(deserialize(serialize(used), world).climbingUsed).toBe(true);
    expect(resetShrines(used).climbingUsed).toBe(false);
    expect(resetGame(used).climbingUsed).toBe(false);
  });

  it("records the first geta step once, survives reload, and defaults old saves to unused", () => {
    const original = withLandmarks(CAPABILITY_THRESHOLDS.geta);
    expect(original.getaUsed).toBe(false);
    const used = recordGetaUse(original);
    expect(recordGetaUse(used)).toBe(used);
    const { getaUsed: _absent, ...old } = serialize(used);
    expect(deserialize(old, world).getaUsed).toBe(false);
    expect(deserialize(serialize(used), world).getaUsed).toBe(true);
    expect(resetShrines(used).getaUsed).toBe(false);
    expect(resetGame(used).getaUsed).toBe(false);
  });

  it("records the first lantern lighting once, survives reload, and defaults old saves to unused", () => {
    const original = withLandmarks(CAPABILITY_THRESHOLDS.lantern);
    expect(original.lanternUsed).toBe(false);
    const used = recordLanternUse(original);
    expect(recordLanternUse(used)).toBe(used);
    const { lanternUsed: _absent, ...old } = serialize(used);
    expect(deserialize(old, world).lanternUsed).toBe(false);
    expect(deserialize(serialize(used), world).lanternUsed).toBe(true);
    expect(resetShrines(used).lanternUsed).toBe(false);
    expect(resetGame(used).lanternUsed).toBe(false);
  });

  it("records the first ash sandal step once, survives reload, and defaults old saves to unused", () => {
    const original = withLandmarks(CAPABILITY_THRESHOLDS.ashSandals);
    expect(original.ashSandalsUsed).toBe(false);
    const used = recordAshSandalsUse(original);
    expect(recordAshSandalsUse(used)).toBe(used);
    const { ashSandalsUsed: _absent, ...old } = serialize(used);
    expect(deserialize(old, world).ashSandalsUsed).toBe(false);
    expect(deserialize(serialize(used), world).ashSandalsUsed).toBe(true);
    expect(resetShrines(used).ashSandalsUsed).toBe(false);
    expect(resetGame(used).ashSandalsUsed).toBe(false);
  });

  it("records snowshoe first use once, survives reload, and defaults old saves to unused", () => {
    const original = withLandmarks(CAPABILITY_THRESHOLDS.snowshoes);
    expect(original.snowshoesUsed).toBe(false);
    const used = recordSnowshoeUse(original);
    expect(recordSnowshoeUse(used)).toBe(used);
    const { snowshoesUsed: _absent, ...old } = serialize(used);
    expect(deserialize(old, world).snowshoesUsed).toBe(false);
    expect(deserialize(serialize(used), world).snowshoesUsed).toBe(true);
    expect(resetShrines(used).snowshoesUsed).toBe(false);
    expect(resetGame(used).snowshoesUsed).toBe(false);
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
    expect(loaded.revealedLandmarks.size).toBe(0);
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
      if (Math.hypot(r.shrine.x - start.site.x, r.shrine.z - start.site.z) <= DISCOVER_RADIUS) expect(isExplored(s, r)).toBe(true);
    }
    expect(isExplored(s, world.region(5, 5))).toBe(false);
  });

  it("reveals a neighbour as the player nears its edge, and not from farther back", () => {
    const a = world.region(0, 0);
    const b = world.region(1, 0);
    const along = (t: number) => ({ x: a.site.x + (b.site.x - a.site.x) * t, z: a.site.z + (b.site.z - a.site.z) * t });
    // Walk from a's site toward b's to the first point that lies in b: the boundary.
    let t = 0;
    while (world.regionAt(along(t).x, along(t).z).id === a.id) t += 0.002;
    const unit = Math.hypot(b.site.x - a.site.x, b.site.z - a.site.z);
    const back = (distance: number) => along(t - distance / unit);
    expect(isExplored(discoverNear(newGame(world.seed), world, back(REVEAL_DISTANCE - 4)), b)).toBe(true);
    // From well inside a, with b's shrine out of sight, b stays hidden.
    const far = back(REVEAL_DISTANCE + 20);
    if (world.regionAt(far.x, far.z).id === a.id && Math.hypot(b.shrine.x - far.x, b.shrine.z - far.z) > DISCOVER_RADIUS) {
      expect(isExplored(discoverNear(newGame(world.seed), world, far), b)).toBe(false);
    }
  });

  it("returns the same state when nothing is new", () => {
    const s = discoverNear(newGame(world.seed), world, { x: 10, z: 10 });
    expect(discoverNear(s, world, { x: 10, z: 10 })).toBe(s);
  });
});

describe("landmark map reveals", () => {
  const names = (from: number, to: number) => new Set(world.landmarks.slice(from, to).map((region) => region.landmark!.id));
  const rubbings = (count: number) => Array.from({ length: count }, (_, i) => `rubbing-${i}`);

  it("reveals a landmark for every seven unique rubbings after accounting for restored landmarks", () => {
    let state = restoreShrine(newGame(world.seed), landmark(0));
    state = discoverNear(state, world, landmark(1).shrine);
    expect(isLandmarkRevealed(state, landmark(0))).toBe(false);
    expect(isLandmarkRevealed(state, landmark(1))).toBe(false);

    for (const [i, id] of rubbings(21).entries()) {
      state = revealLandmarks(collectMonument(state, id), world);
      expect(state.revealedLandmarks.size).toBe(Math.max(0, Math.floor((i + 1) / 7) - 1));
    }
    expect(state.revealedLandmarks).toEqual(names(1, 3));
    expect(revealLandmarks(collectMonument(state, "rubbing-0"), world)).toBe(state);

    state = revealLandmarks(restoreShrine(state, landmark(1)), world);
    expect(state.revealedLandmarks).toEqual(names(2, 3));
    // Finding a landmark out of order (one the rubbings have not covered yet) must not hide one already marked.
    state = revealLandmarks(restoreShrine(state, landmark(4)), world);
    expect(state.revealedLandmarks).toEqual(names(2, 3));
    state = revealLandmarks(unrestoreShrine(state, landmark(4)), world);
    expect(state.revealedLandmarks).toEqual(names(2, 3));
    // Restoring a marked one does take its star, and the next covered one is not pulled in early.
    state = revealLandmarks(restoreShrine(state, landmark(2)), world);
    expect(state.revealedLandmarks.size).toBe(0);
    state = revealLandmarks(unrestoreShrine(state, landmark(2)), world);
    expect(revealLandmarks(resetShrines(state), world).revealedLandmarks).toEqual(names(0, 3));
  });

  it("varies the first reveal with the seed even when landmark positions are identical", () => {
    const firstReveals = new Set<string>();
    const collected = rubbings(7);
    for (let i = 0; i < 20; i++) {
      const seed = `reveal-${i}`;
      const { revealedLandmarks } = revealLandmarks({ ...newGame(seed), collected }, { ...world, seed });
      for (const id of revealedLandmarks) firstReveals.add(id);
    }
    expect(firstReveals).toEqual(names(0, 3));
  });

  it("far sight marks every remaining landmark once enough are restored, and not before", () => {
    const before = revealLandmarks(withLandmarks(FAR_SIGHT_STARS - 1), world);
    expect(before.revealedLandmarks.size).toBe(0);
    const after = revealLandmarks(withLandmarks(FAR_SIGHT_STARS), world);
    expect(after.revealedLandmarks.size).toBe(world.landmarks.length - FAR_SIGHT_STARS);
    for (const r of world.landmarks.slice(FAR_SIGHT_STARS)) expect(isLandmarkRevealed(after, r)).toBe(true);
  });

  it("recalculates old markers from collected rubbings and the seed", () => {
    const saved = {
      ...serialize(newGame(world.seed)),
      restored: Array.from({ length: 20 }, (_, i) => world.region(40, i).id),
      shrineCredits: 10,
      revealedLandmarks: [world.landmarks.at(-1)!.landmark!.id],
    };
    expect(deserialize(saved, world).revealedLandmarks.size).toBe(0);
    const collected = rubbings(7);
    const expected = revealLandmarks({ ...newGame(world.seed), collected }, world).revealedLandmarks;
    const loaded = deserialize({ ...saved, collected }, world);
    expect(loaded.revealedLandmarks).toEqual(expected);
    expect(deserialize({ v: 3, seed: world.seed, restored: [], explored: [], collected }, world).revealedLandmarks)
      .toEqual(expected);
    const reversedWorld = { ...world, landmarks: [...world.landmarks].reverse() };
    expect(deserialize({ ...saved, collected }, reversedWorld).revealedLandmarks).toEqual(expected);
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
