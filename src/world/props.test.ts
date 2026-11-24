import { describe, expect, it } from "vitest";
import { ordinaryRegionNearLandmark } from "../test-fixtures";
import { createWorld } from "./world";
import { PLATEAU_RADIUS, CHUNK_SIZE, createTerrain } from "./terrain-grid";
import { propsInChunk, type PropKind } from "./props";
import { isWater, type Biome } from "./terrain";

const ALLOWED: Record<Biome, readonly PropKind[]> = {
  meadow: ["tree", "bush", "flower", "lantern", "cherry", "farmhouse"],
  snow: ["pine", "rock", "bush", "flower", "lantern"],
  mountain: ["rock", "crag", "bush", "flower", "lantern", "cherry", "farmhouse"],
  water: ["lantern"],
  marsh: ["bush", "tree", "flower", "rock", "lantern"],
  forest: ["tree", "bush", "flower", "lantern"],
  volcanic: ["rock", "crag", "lantern"],
  sea: ["lantern"],
  dunes: ["rock", "bush", "lantern"],
};

describe("propsInChunk", () => {
  const terrain = createTerrain(createWorld("props"));

  it("is deterministic and independent of generation order", () => {
    const first = propsInChunk(terrain, 1, 2);
    propsInChunk(terrain, 5, -3);
    expect(propsInChunk(terrain, 1, 2)).toEqual(first);
    expect(propsInChunk(createTerrain(createWorld("props")), 1, 2)).toEqual(first);
  });

  it("keeps every prop inside its chunk, on the ground, and suited to its biome", () => {
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        for (const p of propsInChunk(terrain, cx, cz)) {
          expect(Math.floor(p.x / CHUNK_SIZE)).toBe(cx);
          expect(Math.floor(p.z / CHUNK_SIZE)).toBe(cz);
          const tile = terrain.tileAtPoint(p.x, p.z);
          expect(p.y).toBeCloseTo(terrain.groundAt(p.x, p.z), 6);
          expect(Math.abs(p.y - tile.height)).toBeLessThan(0.5); // a slope tile is smooth, not stepped
          expect(ALLOWED[tile.biome]).toContain(p.kind);
        }
      }
    }
  });

  it("scatters nothing on shrine plateaus except lanterns", () => {
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        for (const p of propsInChunk(terrain, cx, cz)) {
          if (p.kind === "lantern") continue;
          const r = terrain.world.regionAt(p.x, p.z);
          expect(Math.hypot(p.x - r.shrine.x, p.z - r.shrine.z)).toBeGreaterThan(PLATEAU_RADIUS);
        }
      }
    }
  });

  it("places freestanding lanterns around ordinary land shrines only", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    const world = terrain.world;
    const regions = [
      ...Array.from({ length: 25 }, (_, i) => world.region(Math.floor(i / 5) - 2, i % 5 - 2)),
      ordinaryRegionNearLandmark(world, "water"),
      ordinaryRegionNearLandmark(world, "sea"),
    ];
    for (const { shrine, id, landmark, biome } of regions) {
      let count = 0;
      for (let cx = Math.floor(shrine.x / CHUNK_SIZE) - 1; cx <= Math.floor(shrine.x / CHUNK_SIZE) + 1; cx++) {
        for (let cz = Math.floor(shrine.z / CHUNK_SIZE) - 1; cz <= Math.floor(shrine.z / CHUNK_SIZE) + 1; cz++) {
          count += propsInChunk(terrain, cx, cz).filter((p) => p.kind === "lantern" && p.regionId === id).length;
        }
      }
      expect(count).toBe(landmark || isWater(biome) ? 0 : 4);
    }
  });

  it("uses every ambient scenery kind across meadow, snow and mountain regions", () => {
    const seen = new Set<PropKind>();
    const big = createTerrain(createWorld("variety"));
    for (const biome of ["meadow", "snow", "mountain"] as const) {
      const { shrine } = ordinaryRegionNearLandmark(big.world, biome);
      const x = Math.floor(shrine.x / CHUNK_SIZE);
      const z = Math.floor(shrine.z / CHUNK_SIZE);
      for (let cz = z - 1; cz <= z + 1; cz++) {
        for (let cx = x - 1; cx <= x + 1; cx++) {
          for (const { kind } of propsInChunk(big, cx, cz)) {
            if (kind !== "cherry" && kind !== "farmhouse") seen.add(kind);
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(["bush", "crag", "flower", "lantern", "pine", "rock", "tree"]);
  });
});
