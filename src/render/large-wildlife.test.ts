import { describe, expect, it } from "vitest";
import { movePlayer } from "../game";
import { createTerrain, createWorld, plateauDistance, type Obstacle } from "../world";
import { createLargeWildlife, createSightings } from "./large-wildlife";

describe("rare wildlife", () => {
  it("chooses sustainable, repeatable habitats in about a quarter of regions", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    const plan = createSightings(terrain);
    const replay = createSightings(terrain);
    const species = new Set<string>();
    let count = 0;
    let total = 0;
    for (let rz = -23; rz <= 23; rz += 2) {
      for (let rx = -23; rx <= 23; rx += 2) {
        const region = terrain.world.region(rx, rz);
        total++;
        const sight = plan(region);
        expect(sight).toEqual(replay(region));
        if (!sight) continue;
        count++;
        species.add(sight.species);
        const tile = terrain.tileAtPoint(sight.x, sight.z);
        expect(tile.biome).toBe(region.biome);
        expect(tile.regionId).toBe(region.id);
        expect(plateauDistance(region, sight.x, sight.z)).toBeGreaterThan(sight.radius);
      }
    }
    expect(count / total).toBeGreaterThan(0.19);
    expect(count / total).toBeLessThan(0.30);
    expect(species.size).toBeGreaterThanOrEqual(7);
  });

  it("blocks walking into a deer and moves the obstacle with the rendered pose", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    const plan = createSightings(terrain);
    const nearby = Array.from({ length: 81 }, (_, i) =>
      plan(terrain.world.region(Math.floor(i / 9) - 4, i % 9 - 4)),
    );
    const sight = nearby.find((candidate) => candidate?.species === "deer" && candidate.biome === "meadow");
    if (!sight) throw new Error("No deer sighting on nearby meadow");
    let restored = true;
    const wildlife = createLargeWildlife(terrain, () => Number(restored));
    const obstacles = {
      near(x: number, z: number, reach: number): Obstacle[] {
        const out: Obstacle[] = [];
        wildlife.appendObstaclesNear(x, z, reach, out);
        return out;
      },
    };
    wildlife.update(0.8, sight, 0);
    const deer = wildlife.root.children[0]!.getObjectByName("deer")!;
    const start = deer.position.clone();
    const yaw = deer.rotation.y;
    const side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const approach = { x: start.x + side.x * 1.4, z: start.z + side.z * 1.4 };
    const motion = movePlayer(approach, { x: -side.x, z: -side.z }, 0.44, terrain, new Set(), obstacles);
    const separation = (motion.pos.x - start.x) * side.x + (motion.pos.z - start.z) * side.z;
    expect(separation).toBeGreaterThan(0.4);

    const oldFootprint = obstacles.near(start.x, start.z, 1);
    wildlife.update(3.4, sight, 0);
    expect(deer.position.distanceTo(start)).toBeGreaterThan(0.3);
    const currentFootprint = obstacles.near(deer.position.x, deer.position.z, 1);
    expect(currentFootprint.length).toBeGreaterThanOrEqual(3);
    expect(currentFootprint).not.toEqual(oldFootprint);
    restored = false;
    wildlife.update(0.4, sight, 0);
    expect(obstacles.near(sight.x, sight.z, 10)).toEqual([]);
    wildlife.dispose();
  });
});
