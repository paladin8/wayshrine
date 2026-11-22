import { describe, expect, it } from "vitest";
import { createWorld } from "./world";
import { PLATEAU_RADIUS, CHUNK_SIZE, createTerrain } from "./terrain-grid";
import { propsInChunk, type PropKind } from "./props";
import type { Biome } from "./terrain";

const ALLOWED: Record<Biome, readonly PropKind[]> = {
  meadow: ["tree", "bush", "flower", "lantern"],
  snow: ["pine", "rock", "lantern"],
  mountain: ["rock", "crag", "lantern"],
  water: ["lantern"],
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
          expect(Math.hypot(p.x - r.site.x, p.z - r.site.z)).toBeGreaterThan(PLATEAU_RADIUS);
        }
      }
    }
  });

  it("places four lanterns around every shrine, and none at a landmark", () => {
    const world = terrain.world;
    for (let rx = -2; rx <= 2; rx++) {
      for (let rz = -2; rz <= 2; rz++) {
        const { site, id, landmark } = world.region(rx, rz);
        let count = 0;
        for (let cx = Math.floor(site.x / CHUNK_SIZE) - 1; cx <= Math.floor(site.x / CHUNK_SIZE) + 1; cx++) {
          for (let cz = Math.floor(site.z / CHUNK_SIZE) - 1; cz <= Math.floor(site.z / CHUNK_SIZE) + 1; cz++) {
            count += propsInChunk(terrain, cx, cz).filter((p) => p.kind === "lantern" && p.regionId === id).length;
          }
        }
        expect(count).toBe(landmark ? 0 : 4);
      }
    }
  });

  it("uses every scenery kind somewhere in a wide area", () => {
    const seen = new Set<PropKind>();
    const big = createTerrain(createWorld("variety"));
    for (let cx = -8; cx <= 8; cx++) {
      for (let cz = -8; cz <= 8; cz++) propsInChunk(big, cx, cz).forEach((p) => seen.add(p.kind));
    }
    expect([...seen].sort()).toEqual(["bush", "crag", "flower", "lantern", "pine", "rock", "tree"]);
  });
});
