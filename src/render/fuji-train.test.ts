import * as THREE from "three";
import { expect, it } from "vitest";
import { FRONT_WIDTH, lifeAt, WAVE_EXTENT } from "../game";
import { createTerrain, createWorld, fujiRailway } from "../world";
import { buildFujiTrain } from "./fuji-train";
import { vertexLife } from "./vitality-mesh";

it("restores rail and station surfaces with the terrain tile beneath them", () => {
  const world = createWorld("wayshrine");
  const line = fujiRailway(world)!;
  const terrain = createTerrain(world);
  const { scenery } = buildFujiTrain(line, terrain);
  const { shrineId, stand } = line.stations[0];
  const shrine = world.regionById(shrineId).shrine;
  const stationDistance = Math.hypot(stand.x - shrine.x, stand.z - shrine.z);
  const progress = (stationDistance + FRONT_WIDTH / 2) / (WAVE_EXTENT + FRONT_WIDTH);
  const restored = new Map([[line.landmarkId, 1], [shrineId, progress]]);
  scenery.applyVitality((id) => restored.get(id) ?? 0, new Set(restored.keys()));

  const observed = new Set<number>();
  let greatestError = 0;
  scenery.object.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const position = part.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 3) {
      const x = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
      const z = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
      const tile = terrain.tileAtPoint(x, z);
      const { shrine } = world.regionById(tile.regionId);
      for (let vertex = i; vertex < i + 3; vertex++) {
        const distance = Math.hypot(position.getX(vertex) - shrine.x, position.getZ(vertex) - shrine.z);
        const expected = lifeAt(restored.get(tile.regionId) ?? 0, distance);
        const actual = vertexLife(part, vertex);
        greatestError = Math.max(greatestError, Math.abs(actual - expected));
        observed.add(actual === 0 ? 0 : actual === 1 ? 1 : 0.5);
      }
    }
  });

  expect(observed).toEqual(new Set([0, 0.5, 1]));
  expect(greatestError).toBeLessThan(0.0001);
  scenery.dispose();
});
