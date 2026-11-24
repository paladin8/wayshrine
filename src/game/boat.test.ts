import { describe, expect, it } from "vitest";
import { createWorld, type Capability, type Terrain } from "../world";
import { boatLaunchFrame, BOAT_LAUNCH_SECONDS, BOAT_PUSH_OFF_SECONDS, planBoatLaunch, planShipLaunch, SHIP_ARRIVE_SECONDS, SHIP_LAUNCH_SECONDS, SHIP_PUSH_OFF_SECONDS, shipLaunchFrame } from "./boat";
import { deserialize, newGame, recordBoatLaunch, recordShipLaunch, resetGame, resetShrines, serialize } from "./state";

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

describe("first ship departure", () => {
  const world = createWorld("test-ship");
  const sea = (x: number): boolean => x >= 0 && x < 12;
  const terrain: Terrain = {
    world,
    biomeAt: (x) => sea(x) ? "sea" : "meadow",
    tileAt: (x) => ({ biome: sea(x) ? "sea" : "meadow", height: 1, regionId: "0,0", skirt: false }),
    tileAtPoint: (x) => ({ biome: sea(x) ? "sea" : "meadow", height: 1, regionId: "0,0", skirt: false }),
    corners: () => [1, 1, 1, 1],
    groundAt: () => 1,
  };
  const caps = new Set<Capability>(["boat", "ship"]);
  const from = { x: -0.1, z: 0 };
  const entry = { x: 0.1, z: 0 };

  it("glides in along the bank, then sails as far as the open sea allows", () => {
    const launch = planShipLaunch(terrain, caps, { near: () => [] }, from, entry);
    expect(launch.berth.x).toBeGreaterThan(0.9);
    expect(launch.berth.x).toBeLessThan(1.2);
    expect(launch.approach.x).toBeCloseTo(launch.berth.x, 5);
    expect(Math.hypot(launch.approach.x - launch.berth.x, launch.approach.z - launch.berth.z)).toBeCloseTo(4.4, 5);
    expect(launch.afloat.x).toBeGreaterThan(launch.berth.x + 3);
    // The traveller waits on the bank while the ship comes in.
    expect(shipLaunchFrame(launch, 0)).toMatchObject({ vessel: "ship", rider: from, hull: launch.approach, lift: 0, seated: 0, walking: false, gangway: 0, done: false });
    expect(shipLaunchFrame(launch, SHIP_ARRIVE_SECONDS)).toMatchObject({ rider: from, hull: launch.berth, walking: true, gangway: 1 });
    expect(shipLaunchFrame(launch, SHIP_PUSH_OFF_SECONDS)).toMatchObject({ rider: launch.berth, hull: launch.berth, lift: 1, walking: false, gangway: 1 });
    expect(shipLaunchFrame(launch, SHIP_LAUNCH_SECONDS)).toMatchObject({ rider: launch.afloat, hull: launch.afloat, done: true });
  });

  it("only glides in over open water", () => {
    const shallow: Terrain = { ...terrain, tileAtPoint: (x, z) => ({ biome: sea(x) && Math.abs(z) < 1 ? "sea" : "meadow", height: 1, regionId: "0,0", skirt: false }) };
    const launch = planShipLaunch(shallow, caps, { near: () => [] }, from, entry);
    expect(launch.approach).toEqual(launch.berth);
  });

  it("keeps the rider level with the deck once up the gangway", () => {
    const launch = planShipLaunch(terrain, caps, { near: () => [] }, from, entry);
    for (const t of [1.8, 2.0, 2.2]) expect(shipLaunchFrame(launch, SHIP_ARRIVE_SECONDS + t).lift).toBe(1);
    const at = (t: number): number => shipLaunchFrame(launch, SHIP_ARRIVE_SECONDS + t).lift;
    expect(at(0.55)).toBeGreaterThan(0);
    expect(at(0.55)).toBeLessThan(0.45);
    expect(at(1.4)).toBeGreaterThan(0.45);
    expect(at(1.4)).toBeLessThan(1);
  });

  it("lies along the bank, then swings bow-out as it sails off", () => {
    const launch = planShipLaunch(terrain, caps, { near: () => [] }, from, entry);
    const start = shipLaunchFrame(launch, 0);
    const end = shipLaunchFrame(launch, SHIP_LAUNCH_SECONDS);
    expect(Math.abs(start.yaw - launch.facing)).toBeCloseTo(Math.PI / 2, 5);
    expect(end.yaw).toBeCloseTo(launch.facing, 5);
    expect(shipLaunchFrame(launch, SHIP_PUSH_OFF_SECONDS).gangway).toBe(1);
    expect(shipLaunchFrame(launch, SHIP_LAUNCH_SECONDS).gangway).toBe(0);
  });

  it("stays in a narrow bay", () => {
    const launch = planShipLaunch(terrain, caps, { near: () => [{ x: 3, z: 0, r: 0.3 }] }, from, entry);
    expect(launch.afloat.x).toBeLessThanOrEqual(2.8);
  });

  it("persists completion", () => {
    const state = newGame(world.seed);
    const finished = recordShipLaunch(state);
    expect(recordShipLaunch(finished)).toBe(finished);
    expect(deserialize(serialize(finished), world).shipLaunched).toBe(true);
    const { shipLaunched: _previouslyAbsent, ...legacy } = serialize(state);
    expect(deserialize(legacy, world).shipLaunched).toBe(false);
    expect(resetShrines(finished).shipLaunched).toBe(false);
    expect(resetGame(finished).shipLaunched).toBe(false);
  });
});
