import { describe, expect, it } from "vitest";
import { hirosakiGarden, hirosakiPath, hirosakiPathPoint } from "./hirosaki-garden";
import { propsInChunk } from "./props";
import { CHUNK_SIZE, createTerrain } from "./terrain-grid";
import { createWorld } from "./world";

describe("Hirosaki’s cherry avenue", () => {
  it.each(["wayshrine", "spring", "snow", "bridge", "petals"])("keeps the grove and walkable approach in the castle region for %s", (seed) => {
    const world = createWorld(seed);
    const garden = hirosakiGarden(world)!;
    const terrain = createTerrain(world);
    expect(hirosakiGarden(createWorld(seed))).toEqual(garden);
    expect(world.regionById(garden.regionId).landmark?.id).toBe("hirosaki-castle");
    expect(garden.trees.length).toBeGreaterThanOrEqual(4);

    for (const { x, z } of garden.trees) {
      const tile = terrain.tileAtPoint(x, z);
      expect(tile.regionId).toBe(garden.regionId);
      expect(tile.biome).toBe("snow");
      expect(hirosakiPath(garden, x, z)).toBe(0);
      const props = propsInChunk(terrain, Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      expect(props).toContainEqual(expect.objectContaining({ kind: "cherry", x, z, regionId: garden.regionId }));
    }

    for (let distance = 12; distance < garden.pathEnd - 1; distance += 1) {
      const { x, z } = hirosakiPathPoint(garden, distance);
      const tile = terrain.tileAtPoint(x, z);
      expect(tile.regionId).toBe(garden.regionId);
      expect(tile.biome).toBe("snow");
      expect(tile.skirt).toBe(true);
    }
  });
});
