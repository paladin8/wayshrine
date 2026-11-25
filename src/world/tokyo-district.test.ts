import { expect, it } from "vitest";
import { createObstacles } from "./obstacles";
import { planMonuments } from "./monuments";
import { createTerrain } from "./terrain-grid";
import { tokyoBuildings } from "./tokyo-district";
import { createWorld } from "./world";

it.each(["wayshrine", "spring"])("keeps the streets and tower approach open in %s", (seed) => {
  const world = createWorld(seed);
  const district = world.landmarks[45]!;
  const terrain = createTerrain(world);
  const obstacles = createObstacles(terrain, planMonuments(terrain, []));
  const { x, z } = district.site;
  const buildings = tokyoBuildings(world);

  expect(district.landmark?.id).toBe("tokyo-tower");
  expect(buildings.length).toBeGreaterThan(10);
  for (const building of buildings) {
    expect(terrain.tileAtPoint(building.x, building.z).regionId).toBe(district.id);
    expect(obstacles.near(building.x, building.z, 0.3).length).toBeGreaterThan(0);
  }

  for (let d = 11; d <= 20; d++) {
    const street = terrain.tileAtPoint(x, z + d);
    expect(street.tokyoSurface).toBe("street");
    expect(street.biome).toBe("meadow");
    expect(obstacles.near(x, z + d, 0.3)).toHaveLength(0);
  }
});
