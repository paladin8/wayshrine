import { describe, expect, it } from "vitest";
import { ordinaryRegionNearLandmark } from "../test-fixtures";
import { createWorld } from "./world";
import { LANDMARK_BLEND, footprintHalf } from "./landmarks";
import { groundHeight, groundOf, surfaceHeight } from "./landmark-ground";
import { CHUNK_SIZE, PLATEAU_RADIUS, createTerrain, landmarkWaterLevel, plateauBase, plateauDistance } from "./terrain-grid";

describe("terrain", () => {
  it("is deterministic and independent of sampling order", () => {
    const a = createTerrain(createWorld("t"));
    const b = createTerrain(createWorld("t"));
    const first = a.tileAt(10, 20);
    for (let i = 0; i < 50; i++) a.tileAt(i * 7, -i * 3);
    expect(a.tileAt(10, 20)).toEqual(first);
    expect(b.tileAt(10, 20)).toEqual(first);
  });

  it("agrees with its region's biome, apart from islands", () => {
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

  it("puts ordinary shrines on a level surface in their biome", () => {
    const world = createWorld("plateaus");
    const terrain = createTerrain(world);
    for (let rx = -3; rx <= 3; rx++) {
      for (let rz = -3; rz <= 3; rz++) {
        const region = world.region(rx, rz);
        if (region.landmark) continue;
        const { shrine, biome } = region;
        const centre = terrain.tileAtPoint(shrine.x, shrine.z);
        expect(centre.biome).toBe(biome);
        const edge = terrain.tileAtPoint(shrine.x + PLATEAU_RADIUS - 0.8, shrine.z);
        expect(edge.height).toBe(centre.height);
      }
    }
  });

  it("raises steep land shrines to the surrounding grade and eases into the approach", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    for (const [rx, rz] of [[-5, 5], [-4, -7], [-13, 10], [-14, 15]] as const) {
      const region = terrain.world.region(rx, rz);
      const { x, z } = region.shrine;
      const base = terrain.groundAt(x, z);
      expect(base, region.id).toBeGreaterThan(plateauBase(region) + 0.5);
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        let previous = base;
        for (let distance = 1; distance <= 6; distance++) {
          const px = x + Math.cos(angle) * distance;
          const pz = z + Math.sin(angle) * distance;
          if (terrain.world.regionAt(px, pz) !== region) continue;
          const height = terrain.groundAt(px, pz);
          expect(height, `${region.id} at distance ${distance}`).toBeLessThanOrEqual(base + 0.001);
          expect(Math.abs(height - previous), `${region.id} at distance ${distance}`).toBeLessThan(0.95);
          previous = height;
        }
      }
    }
  });

  it("keeps a clear water approach around ordinary lake and sea shrines", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    for (const [biome, height] of [["water", 0.4], ["sea", 0.25]] as const) {
      const region = ordinaryRegionNearLandmark(terrain.world, biome);
      for (let z = -5; z <= 5; z++) {
        for (let x = -5; x <= 5; x++) {
          if (Math.hypot(x, z) > 5) continue;
          expect(terrain.tileAtPoint(region.shrine.x + x, region.shrine.z + z)).toMatchObject({ biome, height });
        }
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
  it("follows the model's own ground inside its footprint, dry except for the model's own open water", () => {
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
        const tx = Math.floor(x);
        const tz = Math.floor(z);
        const level = landmarkWaterLevel(region.biome);
        const open = level !== undefined && surfaceHeight(model, tx + 0.5 - site.x, tz + 0.5 - site.z) <= level + 0.01;
        if (open) expect(terrain.biomeAt(tx, tz)).toBe(region.biome);
        else expect(terrain.biomeAt(tx, tz)).not.toBe("water");
      }
    }
  });
});

describe("landmark terrain surface", () => {
  it("draws the terrain along the model's surface, down into its channels and up its hills", () => {
    const terrain = createTerrain(createWorld("lm-surface"));
    let checked = 0;
    for (const region of terrain.world.landmarks) {
      const model = groundOf(region.landmark!.id);
      if (!model?.terrainSurface) continue;
      checked++;
      const { site } = region;
      const reach = Math.floor(model.half) - 1;
      for (let cz = Math.ceil(site.z - reach); cz <= site.z + reach; cz++) {
        for (let cx = Math.ceil(site.x - reach); cx <= site.x + reach; cx++) {
          if (terrain.world.regionAt(cx, cz) !== region) continue;
          const want = plateauBase(region) + surfaceHeight(model, cx - site.x, cz - site.z);
          // Every tile meeting at the corner shares its height, so the surface has no cracks.
          for (const [tx, tz, k] of [[cx, cz, 0], [cx - 1, cz, 1], [cx, cz - 1, 2], [cx - 1, cz - 1, 3]] as const) {
            expect(terrain.corners(tx, tz)[k], `${region.landmark!.id} corner ${cx - site.x},${cz - site.z}`).toBeCloseTo(want, 5);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("landmark open water", () => {
  it("joins a model that ends in open water to the region's sea, level and sailable", () => {
    const terrain = createTerrain(createWorld("lm-water"));
    let checked = 0;
    for (const region of terrain.world.landmarks) {
      const model = groundOf(region.landmark!.id);
      const level = landmarkWaterLevel(region.biome);
      if (!model || level === undefined || Math.abs(model.ground[0]![0]! - level) > 0.001) continue;
      checked++;
      const { site } = region;
      const sea = plateauBase(region) + level;
      for (let d = -model.half + 1; d <= model.half - 1; d += 2) {
        for (const [dx, dz] of [[d, -model.half - 2], [d, model.half + 2], [-model.half - 2, d], [model.half + 2, d], [d, -model.half + 0.6], [-model.half + 0.6, d]]) {
          const tile = terrain.tileAtPoint(site.x + dx!, site.z + dz!);
          if (terrain.world.regionById(tile.regionId) !== region) continue;
          expect(tile.biome).toBe(region.biome);
          expect(tile.height).toBeCloseTo(sea, 5);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("landmark slopes", () => {
  it("joins the Nara Buddha grounds to the nearby terrain at shared corners", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    const region = terrain.world.landmarks.find((r) => r.landmark?.id === "todai-ji-daibutsu")!;
    const model = groundOf(region.landmark!.id)!;
    const tx = Math.floor(region.site.x + model.half + 0.5);
    const tz = Math.floor(region.site.z);
    expect(terrain.tileAt(tx - 1, tz).skirt).toBe(true);
    expect(terrain.tileAt(tx, tz).skirt).toBe(true);
    const inside = terrain.corners(tx - 1, tz);
    const outside = terrain.corners(tx, tz);
    expect([inside[1], inside[3]]).toEqual([outside[0], outside[2]]);
    expect(Math.min(...inside, ...outside)).toBeGreaterThan(plateauBase(region) - 0.1);
  });

  it("ease down from the plateau in small steps, never a wall", () => {
    for (const seed of ["lm-slope-a", "lm-slope-b", "lm-slope-c"]) {
      const terrain = createTerrain(createWorld(seed));
      for (const region of terrain.world.landmarks) {
        const reach = footprintHalf(region.landmark!) + LANDMARK_BLEND + 2;
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

  it("floats the traveller on the region's water, not the model's seabed, over a landmark's open water", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    let open = 0;
    for (const region of terrain.world.landmarks) {
      const model = groundOf(region.landmark!.id);
      const level = landmarkWaterLevel(region.biome);
      if (!model || level === undefined || model.terrainSurface) continue;
      const half = model.half - 0.5;
      for (let dx = -half; dx <= half; dx += 0.7) {
        for (let dz = -half; dz <= half; dz += 0.7) {
          if (surfaceHeight(model, dx, dz) > level + 0.01) continue;
          open++;
          const y = terrain.groundAt(region.shrine.x + dx, region.shrine.z + dz);
          expect(y, `${region.landmark!.id} at ${dx.toFixed(1)},${dz.toFixed(1)}`).toBeGreaterThanOrEqual(plateauBase(region) + level - 1e-9);
        }
      }
    }
    expect(open).toBeGreaterThan(0);
  });
});
