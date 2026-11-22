import { describe, expect, it } from "vitest";
import { createWorld, type Capability, type Terrain } from "../world";
import { boatLaunchFrame, BOAT_LAUNCH_SECONDS, BOAT_PUSH_OFF_SECONDS, planBoatLaunch } from "./boat";
import { deserialize, newGame, recordBoatLaunch, resetShrines, serialize } from "./state";

describe("first voyage", () => {
  const world = createWorld("test-boat");
  const terrain: Terrain = {
    world,
    biomeAt: (x) => x >= 0 && x < 2 ? "water" : "meadow",
    tileAt: (x) => ({ biome: x >= 0 && x < 2 ? "water" : "meadow", height: 1, regionId: "0,0", skirt: false }),
    tileAtPoint: (x) => ({ biome: x >= 0 && x < 2 ? "water" : "meadow", height: 1, regionId: "0,0", skirt: false }),
    corners: () => [1, 1, 1, 1],
    groundAt: () => 1,
  };
  const caps = new Set<Capability>(["boat"]);
  const from = { x: -0.1, z: 0 };
  const entry = { x: 0.1, z: 0 };

  it("boards at the waterline and keeps the launch in the inlet", () => {
    const launch = planBoatLaunch(terrain, caps, { near: () => [] }, from, entry);
    expect(launch.afloat.x).toBeGreaterThan(1.5);
    expect(launch.afloat.x).toBeLessThan(2);
    expect(boatLaunchFrame(launch, 0)).toMatchObject({ rider: from, hull: entry, seated: 0, done: false });
    expect(boatLaunchFrame(launch, BOAT_PUSH_OFF_SECONDS)).toMatchObject({ rider: entry, hull: entry, seated: 1 });
    expect(boatLaunchFrame(launch, BOAT_LAUNCH_SECONDS)).toMatchObject({ rider: launch.afloat, hull: launch.afloat, done: true });
  });

  it("does not drift through a solid object", () => {
    const path = planBoatLaunch(terrain, caps, {
      near: () => [{ x: 1.4, z: 0, r: 0.3 }],
    }, from, entry);
    expect(path.afloat.x).toBeGreaterThan(entry.x);
    expect(path.afloat.x).toBeLessThanOrEqual(0.8);
  });

  it("persists completion and gives old saves a first voyage", () => {
    const state = newGame(world.seed);
    const finished = recordBoatLaunch(state);
    expect(recordBoatLaunch(finished)).toBe(finished);
    expect(deserialize(serialize(finished), world).boatLaunched).toBe(true);
    const { boatLaunched: _previouslyAbsent, ...legacy } = serialize(state);
    expect(deserialize(legacy, world).boatLaunched).toBe(false);
    expect(resetShrines(finished).boatLaunched).toBe(false);
  });
});
