import { expect, it } from "vitest";
import { railPoint, railwayClearance } from "./fuji-railway";
import { fujiValley, fujiVergeAt } from "./fuji-valley";
import { propsInChunk } from "./props";
import { CHUNK_SIZE, createTerrain } from "./terrain-grid";
import { createWorld } from "./world";

it.each(["wayshrine", "spring"])("fits restored scenery into the existing railway corridor in %s", (seed) => {
  const world = createWorld(seed);
  const terrain = createTerrain(world);
  const valley = fujiValley(world)!;
  const { line } = valley;
  const across = ({ x, z }: { x: number; z: number }) =>
    (x - line.origin.x) * line.across.x + (z - line.origin.z) * line.across.z;
  const fuji = world.regionById(line.landmarkId).site;
  expect(across(fuji)).toBeLessThan(0);

  expect(valley.plots.length).toBeGreaterThan(0);
  for (const plot of valley.plots) {
    expect(plot.across + plot.halfWidth).toBeLessThan(0);
    const { x, z } = railPoint(valley.line, plot.distance, plot.across);
    const tile = terrain.tileAtPoint(x, z);
    expect(tile.fujiField).toMatch(/paddy|rice/);
    expect(tile.biome).toBe(world.regionById(tile.regionId).biome);
    expect(valley.line.requiredRegions).toContain(tile.regionId);
    expect(railwayClearance(valley.line, x, z)).toBeGreaterThan(1.4);
  }
  expect(new Set(valley.props.map((p) => p.kind))).toEqual(new Set(["cherry", "farmhouse"]));
  for (const prop of valley.props) {
    expect(across(prop)).toBeLessThan(0);
    const chunk = propsInChunk(terrain, Math.floor(prop.x / CHUNK_SIZE), Math.floor(prop.z / CHUNK_SIZE));
    expect(chunk).toContainEqual(expect.objectContaining({ x: prop.x, z: prop.z, kind: prop.kind }));
  }
  const mountainSide = railPoint(line, 0, -12);
  const platformSide = railPoint(line, 0, 12);
  expect(fujiVergeAt(line, mountainSide.x, mountainSide.z)).toBeGreaterThan(0);
  expect(fujiVergeAt(line, platformSide.x, platformSide.z)).toBe(0);
});
