import { describe, expect, it } from "vitest";
import {
  capabilitiesForCount, createTerrain, createWorld, footprintHalf, fujiRailway, isWater,
  landmarksBeforeAct, LANDMARK_WINDOW, reachableRegions, railPoint, railwayClearance, PLATFORM_TOP, RAIL_HALF_LENGTH,
} from "../world";
import { blockerAt } from "./player";
import { newGame, restoreShrine } from "./state";
import { railwayPowered, stationInReach, trainFrame, TRAIN_BOARD_SECONDS, TRAIN_RUN_SECONDS, TRAIN_TOTAL_SECONDS } from "./train";

const world = createWorld("wayshrine");
const terrain = createTerrain(world);
const line = fujiRailway(world)!;

describe("Mount Fuji railway", () => {
  it("keeps its track and both station approaches on the chosen seed", () => {
    expect(world.regionById(line.landmarkId).landmark?.id).toBe("mount-fuji");
    const caps = capabilitiesForCount(landmarksBeforeAct(world.regionById(line.landmarkId).landmark!.act));
    const accessible = new Set(reachableRegions(world, caps, 28).map((region) => region.id));
    for (const [index, station] of line.stations.entries()) {
      const region = world.regionById(station.shrineId);
      expect(region.landmark).toBeNull();
      const dx = region.shrine.x - line.origin.x;
      const dz = region.shrine.z - line.origin.z;
      const along = Math.max(-RAIL_HALF_LENGTH, Math.min(RAIL_HALF_LENGTH, dx * line.along.x + dz * line.along.z));
      const nearestRail = railPoint(line, along);
      expect(Math.hypot(nearestRail.x - region.shrine.x, nearestRail.z - region.shrine.z)).toBeGreaterThan(5.3);
      expect(stationInReach(line, station.stand)).toBe(index);
      expect(isWater(terrain.tileAtPoint(station.stand.x, station.stand.z).biome)).toBe(false);
      expect(blockerAt(terrain, caps, station.stand.x, station.stand.z)).toBeNull();
      expect(terrain.groundAt(station.stand.x, station.stand.z)).toBeCloseTo(line.height + PLATFORM_TOP, 2);
      expect(accessible.has(station.shrineId)).toBe(true);
      expect(accessible.has(world.regionAt(station.stand.x, station.stand.z).id)).toBe(true);
    }
    for (let along = -RAIL_HALF_LENGTH; along <= RAIL_HALF_LENGTH; along += 0.5) {
      for (const across of [-0.85, 0, 0.85]) {
        const p = railPoint(line, along, across);
        expect(terrain.groundAt(p.x, p.z)).toBeLessThan(line.height);
        expect(line.crossedRegions).toContain(terrain.tileAtPoint(p.x, p.z).regionId);
      }
    }
  });

  it("requires every crossed region, both stations, and the defining landmark", () => {
    const sites = line.requiredRegions;
    expect(new Set(sites)).toEqual(new Set([
      ...line.crossedRegions, ...line.stations.map((station) => station.shrineId), line.landmarkId,
    ]));
    expect(line.crossedRegions.length).toBeGreaterThan(2);
    const caps = capabilitiesForCount(landmarksBeforeAct(world.regionById(line.landmarkId).landmark!.act));
    const reachable = new Set(reachableRegions(world, caps, 28).map((region) => region.id));
    expect(sites.every((id) => reachable.has(id))).toBe(true);
    for (const last of sites) {
      const initial = newGame(world.seed);
      const beforeLast = sites.filter((id) => id !== last)
        .reduce((state, id) => restoreShrine(state, world.regionById(id)), initial);
      expect(railwayPowered(line, initial)).toBe(false);
      expect(railwayPowered(line, beforeLast)).toBe(false);
      expect(railwayPowered(line, restoreShrine(beforeLast, world.regionById(last)))).toBe(true);
    }
  });

  it("stops at the platforms and provides the mountain-side seat in both directions", () => {
    for (const from of [0, 1] as const) {
      const to = from === 0 ? 1 : 0;
      const board = trainFrame(line, from, 0);
      const midway = trainFrame(line, from, TRAIN_BOARD_SECONDS + TRAIN_RUN_SECONDS / 2);
      const arrival = trainFrame(line, from, TRAIN_TOTAL_SECONDS);
      expect(board.distance).toBe(line.stations[from].distance);
      expect(board.routeProgress).toBe(from);
      expect(board.windowView).toBe(false);
      expect(midway.windowView).toBe(true);
      expect(midway.routeProgress).toBeCloseTo(0.5);
      expect(midway.distance).toBeCloseTo((line.stations[0].distance + line.stations[1].distance) / 2);
      expect(midway.direction).toBe(from === 0 ? 1 : -1);
      expect(arrival.windowView).toBe(false);
      expect(arrival.routeProgress).toBe(to);
      expect(arrival.distance).toBe(line.stations[to].distance);
      expect(arrival.done).toBe(true);
    }
  });
});

describe("Mount Fuji railway in generated worlds", () => {
  it.each(["wayshrine", "spring", "default", "0", "fuji-corridor-37", "fuji-corridor-178"])("connects five restorable regions in %s", (seed) => {
    const world = createWorld(seed);
    const line = fujiRailway(world)!;
    const terrain = createTerrain(world);
    const fuji = world.regionById(line.landmarkId);
    expect(fuji.landmark?.id).toBe("mount-fuji");
    expect(line.crossedRegions).toHaveLength(5);
    expect(new Set(line.crossedRegions).size).toBe(5);
    expect(line.crossedRegions[2]).toBe(fuji.id);
    expect(line.requiredRegions).toEqual(line.crossedRegions);

    const caps = capabilitiesForCount(landmarksBeforeAct(fuji.landmark!.act));
    const reachable = new Set(reachableRegions(world, caps, LANDMARK_WINDOW).map(({ id }) => id));
    for (const id of line.crossedRegions) {
      const region = world.regionById(id);
      expect(reachable.has(id)).toBe(true);
      expect(railwayClearance(line, region.shrine.x, region.shrine.z))
        .toBeGreaterThanOrEqual(region.landmark ? footprintHalf(region.landmark) : 4);
    }
    for (const [index, station] of line.stations.entries()) {
      const { x, z } = station.stand;
      const tile = terrain.tileAtPoint(x, z);
      expect(tile.regionId).toBe(line.crossedRegions[index * 4]);
      expect(tile.regionId).toBe(station.shrineId);
      expect(world.regionById(station.shrineId).landmark).toBeNull();
      expect(isWater(tile.biome)).toBe(false);
      expect(blockerAt(terrain, caps, x, z)).toBeNull();
      expect(terrain.groundAt(x, z)).toBeCloseTo(line.height + PLATFORM_TOP, 2);
    }

    const through = new Set<string>();
    for (let distance = line.start; distance <= line.end; distance += 0.5) {
      const point = railPoint(line, distance);
      through.add(terrain.tileAtPoint(point.x, point.z).regionId);
    }
    expect([...through]).toEqual(line.crossedRegions);

    const almostReady = line.requiredRegions
      .filter((id) => id !== line.crossedRegions[1])
      .reduce((state, id) => restoreShrine(state, world.regionById(id)), newGame(seed));
    expect(railwayPowered(line, almostReady)).toBe(false);
    expect(railwayPowered(line, restoreShrine(almostReady, world.regionById(line.crossedRegions[1]!)))).toBe(true);
  });

  it("places the same line regardless of which terrain is sampled first", () => {
    const world = createWorld("wayshrine");
    for (const { site } of [...world.landmarks].reverse()) world.regionAt(site.x, site.z);
    expect(fujiRailway(world)).toEqual(fujiRailway(createWorld("wayshrine")));
  });
});
