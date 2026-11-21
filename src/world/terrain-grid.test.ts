import { describe, expect, it } from "vitest";
import { createWorld } from "./world";
import { CHUNK_SIZE, PLATEAU_RADIUS, createTerrain } from "./terrain-grid";

describe("terrain", () => {
  it("is deterministic and independent of sampling order", () => {
    const a = createTerrain(createWorld("t"));
    const b = createTerrain(createWorld("t"));
    const first = a.tileAt(10, 20);
    for (let i = 0; i < 50; i++) a.tileAt(i * 7, -i * 3);
    expect(a.tileAt(10, 20)).toEqual(first);
    expect(b.tileAt(10, 20)).toEqual(first);
  });

  it("agrees with its region's biome, apart from shrine islets", () => {
    const terrain = createTerrain(createWorld("biomes"));
    for (let tx = -80; tx < 80; tx += 3) {
      for (let tz = -80; tz < 80; tz += 3) {
        const tile = terrain.tileAt(tx, tz);
        const region = terrain.world.regionById(tile.regionId);
        if (tile.biome !== region.biome) {
          expect(region.biome).toBe("water");
          expect(tile.biome).toBe("meadow");
        }
        expect(Number.isFinite(tile.height)).toBe(true);
      }
    }
  });

  it("puts every shrine on flat, dry-or-region-native ground", () => {
    const world = createWorld("plateaus");
    const terrain = createTerrain(world);
    for (let rx = -3; rx <= 3; rx++) {
      for (let rz = -3; rz <= 3; rz++) {
        const { site, biome } = world.region(rx, rz);
        const centre = terrain.tileAtPoint(site.x, site.z);
        expect(centre.biome).toBe(biome === "water" ? "meadow" : biome);
        const edge = terrain.tileAtPoint(site.x + PLATEAU_RADIUS - 0.6, site.z);
        expect(edge.height).toBe(centre.height);
      }
    }
  });

  it("tileAtPoint floors to the containing tile", () => {
    const terrain = createTerrain(createWorld("floor"));
    expect(terrain.tileAtPoint(-0.2, 3.9)).toEqual(terrain.tileAt(-1, 3));
    expect(CHUNK_SIZE).toBe(16);
  });
});
