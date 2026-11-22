import { describe, expect, it } from "vitest";
import { createWorld } from "./world";
import { LANDMARK_BLEND, LANDMARK_PLATEAU_RADIUS } from "./landmarks";
import { groundHeight, groundOf } from "./landmark-ground";
import { CHUNK_SIZE, PLATEAU_RADIUS, createTerrain, plateauBase, plateauDistance } from "./terrain-grid";

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
        const region = world.region(rx, rz);
        if (region.landmark) continue;
        const { shrine, biome } = region;
        const centre = terrain.tileAtPoint(shrine.x, shrine.z);
        expect(centre.biome).toBe(biome === "water" ? "meadow" : biome);
        const edge = terrain.tileAtPoint(shrine.x + PLATEAU_RADIUS - 0.8, shrine.z);
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

describe("landmark ground", () => {
  it("follows the model's own ground inside its footprint, and stays dry", () => {
    const terrain = createTerrain(createWorld("lm-plateau"));
    for (const region of terrain.world.landmarks) {
      const model = groundOf(region.landmark!.id);
      if (!model) continue;
      const { site } = region;
      for (const [dx, dz] of [[0, 0], [-6, -6], [6, -6], [-6, 6], [6, 6], [0, -8], [8, 0]]) {
        const x = site.x + dx;
        const z = site.z + dz;
        const want = plateauBase(region) + groundHeight(model, dx, dz);
        expect(Math.abs(terrain.groundAt(x, z) - want)).toBeLessThan(0.6);
        expect(terrain.biomeAt(x, z)).not.toBe("water");
      }
    }
  });
});

describe("landmark slopes", () => {
  it("ease down from the plateau in small steps, never a wall", () => {
    for (const seed of ["lm-slope-a", "lm-slope-b", "lm-slope-c"]) {
      const terrain = createTerrain(createWorld(seed));
      for (const region of terrain.world.landmarks) {
        const reach = LANDMARK_PLATEAU_RADIUS + LANDMARK_BLEND + 2;
        for (let dx = -reach; dx <= reach; dx++) {
          for (let dz = -reach; dz <= reach; dz++) {
            const x = Math.floor(region.site.x + dx);
            const z = Math.floor(region.site.z + dz);
            if (terrain.world.regionAt(x + 0.5, z + 0.5) !== region) continue;
            // The slope's first half: beyond it, ordinary terrain noise takes over.
            const away = plateauDistance(region, x + 1.5, z + 1.5);
            if (away > LANDMARK_BLEND / 2 || away < 2.5) continue; // inside the footprint the slope is the model's own
            const here = terrain.tileAt(x, z).height;
            for (const [ax, az] of [[1, 0], [0, 1]] as const) {
              if (terrain.world.regionAt(x + ax + 0.5, z + az + 0.5) !== region) continue;
              expect(Math.abs(terrain.tileAt(x + ax, z + az).height - here), `${seed} ${region.landmark!.id} away=${away.toFixed(1)} d=${(x-region.site.x)},${(z-region.site.z)} ${terrain.tileAt(x,z).biome}`).toBeLessThanOrEqual(1.3); // the model's own front-edge drop is ~1.2; the hill edge eases out over LANDMARK_BLEND; a cliff would be 2 or more
            }
          }
        }
      }
    }
  });
});
