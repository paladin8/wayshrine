import { describe, expect, it } from "vitest";
import { capabilitiesForCount, createTerrain, createWorld, FUJI_RAIL_SEED, fujiRailway, reachableRegions, railPoint, RAIL_HALF_LENGTH } from "../world";
import { blockerAt } from "./player";
import { newGame, restoreShrine } from "./state";
import { railwayPowered, stationInReach, trainFrame, TRAIN_BOARD_SECONDS, TRAIN_RUN_SECONDS, TRAIN_TOTAL_SECONDS } from "./train";

const world = createWorld(FUJI_RAIL_SEED);
const terrain = createTerrain(world);
const line = fujiRailway(terrain)!;

describe("Mount Fuji railway prototype", () => {
  it("keeps its track and both station approaches on the chosen seed", () => {
    expect(fujiRailway(createTerrain(createWorld("wayshrine")))).toBeNull();
    expect(world.regionById(line.landmarkId).landmark?.id).toBe("mount-fuji");
    const caps = capabilitiesForCount(13);
    const accessible = new Set(reachableRegions(world, caps, 28).map((region) => region.id));
    for (const [index, station] of line.stations.entries()) {
      expect(stationInReach(line, station.stand)).toBe(index);
      expect(terrain.tileAtPoint(station.stand.x, station.stand.z).biome).toBe("mountain");
      expect(blockerAt(terrain, caps, station.stand.x, station.stand.z)).toBeNull();
      expect(accessible.has(station.shrineId)).toBe(true);
      expect(accessible.has(world.regionAt(station.stand.x, station.stand.z).id)).toBe(true);
    }
    for (let along = -RAIL_HALF_LENGTH; along <= RAIL_HALF_LENGTH; along += 0.5) {
      for (const across of [-0.85, 0, 0.85]) {
        const p = railPoint(line, along, across);
        expect(terrain.groundAt(p.x, p.z)).toBeLessThan(line.height);
      }
    }
  });

  it("opens in either shrine order and follows restored state", () => {
    for (const order of [[0, 1], [1, 0]] as const) {
      const initial = newGame(world.seed);
      const first = restoreShrine(initial, world.regionById(line.stations[order[0]].shrineId));
      const both = restoreShrine(first, world.regionById(line.stations[order[1]].shrineId));
      expect(railwayPowered(line, initial)).toBe(false);
      expect(railwayPowered(line, first)).toBe(false);
      expect(railwayPowered(line, both)).toBe(true);
    }
  });

  it("stops at the platforms and provides the mountain-side seat in both directions", () => {
    for (const from of [0, 1] as const) {
      const to = from === 0 ? 1 : 0;
      const board = trainFrame(line, from, 0);
      const midway = trainFrame(line, from, TRAIN_BOARD_SECONDS + TRAIN_RUN_SECONDS / 2);
      const arrival = trainFrame(line, from, TRAIN_TOTAL_SECONDS);
      expect(board.distance).toBe(line.stations[from].distance);
      expect(board.windowView).toBe(false);
      expect(midway.windowView).toBe(true);
      expect(midway.distance).toBeCloseTo(0);
      expect(midway.direction).toBe(from === 0 ? 1 : -1);
      expect(arrival.windowView).toBe(false);
      expect(arrival.distance).toBe(line.stations[to].distance);
      expect(arrival.done).toBe(true);
    }
  });
});
