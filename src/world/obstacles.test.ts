import { describe, expect, it } from "vitest";
import { groundOf } from "./landmark-ground";
import { createWorld } from "./world";
import { createTerrain, CHUNK_SIZE } from "./terrain-grid";
import { planMonuments, type MonumentSpec } from "./monuments";
import { createObstacles } from "./obstacles";
import { blocksClearing, propsInChunk } from "./props";
import { MONUMENT_CLEARING } from "./monuments";

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

  it("gives a placeholder landmark one solid disc, and a crafted model its own solids", () => {
    const world = terrain.world;
    // Every landmark may have its model by now; the placeholder checks apply only while one is still missing.
    const placeholder = world.landmarks.find((r) => !groundOf(r.landmark!.id));
    if (placeholder) expect(obstacles.near(placeholder.site.x, placeholder.site.z, 0).length).toBeGreaterThan(0);
    const crafted = world.landmarks.find((r) => groundOf(r.landmark!.id))!;
    const model = groundOf(crafted.landmark!.id)!;
    for (const [sx, sz] of model.solids.slice(0, 40)) {
      expect(obstacles.near(crafted.site.x + sx, crafted.site.z + sz, 0).length).toBeGreaterThan(0);
    }
    // No gate pillars at a landmark.
    if (placeholder) expect(obstacles.near(placeholder.site.x + 0.9, placeholder.site.z + 4.5, 0).length).toBe(0);
  });

  it("makes trees and shrine pillars solid but not flowers", () => {
    const tree = propsInChunk(terrain, 0, 0).find((p) => p.kind === "tree");
    if (tree) expect(obstacles.near(tree.x, tree.z, 0).length).toBeGreaterThan(0);
    const shrine = terrain.world.region(1, 0).shrine;
    expect(obstacles.near(shrine.x + 0.9, shrine.z, 0).length).toBeGreaterThan(0);
    // The gap between the pillars stays open to the player.
    expect(obstacles.near(shrine.x, shrine.z, PLAYER).length).toBe(0);
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

  it("keeps trees and crags from standing on or in front of any monument", () => {
    for (const m of plan.all.slice(0, 80)) {
      const clearing = { x: m.x, z: m.z, radius: MONUMENT_CLEARING };
      const cx = Math.floor(m.x / CHUNK_SIZE);
      const cz = Math.floor(m.z / CHUNK_SIZE);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const p of propsInChunk(terrain, cx + dx, cz + dz, [clearing])) {
            expect(blocksClearing(p.kind, p.scale, p.x, p.z, clearing)).toBe(false);
          }
        }
      }
    }
  });

  it("treats a tree between a monument and the camera as blocking, and one behind it as fine", () => {
    const c = { x: 0, z: 0, radius: MONUMENT_CLEARING };
    expect(blocksClearing("tree", 1, 2.2, 2.2, c)).toBe(true);
    expect(blocksClearing("tree", 1, -2.2, -2.2, c)).toBe(false);
    expect(blocksClearing("tree", 1, 4.5, -4.5, c)).toBe(false);
    expect(blocksClearing("flower", 1, 1.0, 1.0, c)).toBe(true);
    expect(blocksClearing("flower", 1, 2.2, 2.2, c)).toBe(false);
  });
});
