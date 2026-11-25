import { expect, it } from "vitest";
import { ginzanStream, ginzanWarmth } from "./ginzan-stream";
import { createTerrain } from "./terrain-grid";
import { createWorld } from "./world";

it.each(["wayshrine", "spring"])("fits a downstream path and baths into the snow in %s", (seed) => {
  const world = createWorld(seed);
  const terrain = createTerrain(world);
  const plan = ginzanStream(world)!;
  expect(world.regionById(plan.sourceId).landmark?.id).toBe("ginzan-onsen");
  expect(plan.springs).toHaveLength(2);
  expect(new Set(plan.springs.map((s) => s.regionId)).size).toBe(2);
  expect(plan.bridges.length).toBeGreaterThan(0);
  expect(plan.cells.size).toBe(3);
  for (const { x, z, regionId } of plan.springs) {
    const tile = terrain.tileAtPoint(x, z);
    const region = world.regionById(regionId);
    expect(region.landmark).toBeNull();
    expect(tile.regionId).toBe(regionId);
    expect(tile.biome).toBe("snow");
    expect(tile.ginzanSurface).toBe("bath");
    expect(Math.hypot(x - region.shrine.x, z - region.shrine.z)).toBeGreaterThan(11.75);
    expect(ginzanWarmth(plan, regionId, (id) => Number(id === plan.sourceId))).toBe(0);
    expect(ginzanWarmth(plan, regionId, (id) => Number(id === regionId))).toBe(0);
    expect(ginzanWarmth(plan, regionId, (id) => id === regionId ? 0.6 : 1)).toBe(0.6);
  }
  expect(plan.springs).toEqual(ginzanStream(createWorld(seed))?.springs);
});
