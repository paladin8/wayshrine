import { describe, expect, it } from "vitest";
import { LANDMARK_SOLID_RADIUS } from "./landmarks";
import { createWorld } from "./world";
import { createTerrain, CHUNK_SIZE } from "./terrain-grid";
import { planMonuments, type MonumentSpec } from "./monuments";
import { createObstacles } from "./obstacles";
import { propsInChunk } from "./props";

const specs: MonumentSpec[] = Array.from({ length: 300 }, (_, i) => ({ id: `t${i}`, kind: "proverb" }));
const PLAYER = 0.3;

describe("createObstacles", () => {
  const terrain = createTerrain(createWorld("obstacles"));
  const plan = planMonuments(terrain, specs);
  const obstacles = createObstacles(terrain, plan);

  it("is deterministic regardless of query order", () => {
    const a = obstacles.near(40, 40, 10);
    obstacles.near(-200, 90, 30);
    expect(createObstacles(terrain, plan).near(40, 40, 10)).toEqual(a);
  });

  it("makes a landmark solid at its footprint, with no gate pillars, and reachable from outside", () => {
    const { site } = terrain.world.landmarks[0]!;
    expect(obstacles.near(site.x, site.z, 0).length).toBeGreaterThan(0);
    expect(obstacles.near(site.x + 0.9, site.z, 0).every((o) => o.r === LANDMARK_SOLID_RADIUS)).toBe(true);
    // A player standing against the footprint is still within reach of the shrine.
    expect(LANDMARK_SOLID_RADIUS + PLAYER).toBeLessThanOrEqual(3.5); // SHRINE_REACH in game/player.ts
  });

  it("makes trees and shrine pillars solid but not flowers", () => {
    const tree = propsInChunk(terrain, 0, 0).find((p) => p.kind === "tree");
    if (tree) expect(obstacles.near(tree.x, tree.z, 0).length).toBeGreaterThan(0);
    const site = terrain.world.region(0, 0).site;
    expect(obstacles.near(site.x + 0.9, site.z, 0).length).toBeGreaterThan(0);
    // The gap between the pillars stays open to the player.
    expect(obstacles.near(site.x, site.z, PLAYER).length).toBe(0);
  });

  it("makes every monument solid", () => {
    for (const m of plan.all.slice(0, 50)) expect(obstacles.near(m.x, m.z, 0).length).toBeGreaterThan(0);
  });

  it("never walls the player in: free ground forms one connected expanse", () => {
    // Flood-fill a patch of the world at 0.25 resolution, treating each obstacle as inflated by the player's radius.
    const size = 4 * CHUNK_SIZE;
    const x0 = -2 * CHUNK_SIZE;
    const res = 0.25;
    const n = size / res;
    const free = new Uint8Array(n * n);
    let freeCount = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.5) * res;
        const z = x0 + (j + 0.5) * res;
        const blocked = obstacles.near(x, z, PLAYER).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + PLAYER);
        if (!blocked) {
          free[j * n + i] = 1;
          freeCount++;
        }
      }
    }
    const seen = new Uint8Array(n * n);
    let best = 0;
    for (let s = 0; s < n * n; s++) {
      if (!free[s] || seen[s]) continue;
      const stack = [s];
      seen[s] = 1;
      let count = 0;
      while (stack.length) {
        const c = stack.pop() as number;
        count++;
        const ci = c % n;
        const cj = (c - ci) / n;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
          const k = nj * n + ni;
          if (free[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
      best = Math.max(best, count);
    }
    expect(best / freeCount).toBeGreaterThan(0.97);
  });
});
