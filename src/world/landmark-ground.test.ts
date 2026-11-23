import { describe, expect, it } from "vitest";
import { LANDMARK_SPECS, MAX_FOOTPRINT_HALF } from "./landmarks";
import { groundHeight, groundOf } from "./landmark-ground";
import { landmarkWaterLevel } from "./terrain-grid";

const modelled = LANDMARK_SPECS.filter((l) => groundOf(l.id));

describe("landmark model sidecars", () => {
  it("covers the crafted landmarks", () => {
    expect(modelled.length).toBeGreaterThanOrEqual(7);
  });

  for (const spec of modelled) {
    const g = groundOf(spec.id)!;
    describe(spec.id, () => {
      it("fits its region: footprint no wider than MAX_FOOTPRINT_HALF", () => {
        expect(g.half).toBeLessThanOrEqual(MAX_FOOTPRINT_HALF + 1e-9);
      });

      it("is a square grid matching its footprint", () => {
        const n = Math.round((2 * g.half) / g.step) + 1;
        expect(g.ground).toHaveLength(n);
        for (const row of g.ground) expect(row).toHaveLength(n);
      });

      it("sits at one level all round its edge: the base height, or open water in a water region", () => {
        const water = landmarkWaterLevel(spec.biome);
        for (const grid of [g.ground, g.terrain ?? g.ground]) {
          const n = grid.length;
          const edge = grid[0]![0]!;
          const level = water !== undefined && Math.abs(edge - water) < 0.001 ? water : 0;
          for (let i = 0; i < n; i++) {
            for (const v of [grid[0]![i]!, grid[n - 1]![i]!, grid[i]![0]!, grid[i]![n - 1]!]) {
              expect(Math.abs(v - level)).toBeLessThan(0.001);
            }
          }
        }
      });

      it("never lets the terrain rise above the walkable ground", () => {
        if (!g.terrain) return;
        expect(g.terrain).toHaveLength(g.ground.length);
        g.ground.forEach((row, z) => row.forEach((v, x) => expect(g.terrain![z]![x]!).toBeLessThanOrEqual(v + 0.001)));
      });

      it("stands the player on open ground, within reach of the interaction point", () => {
        const [sx, sz] = g.stand;
        for (const [x, z, r] of g.solids) expect(Math.hypot(sx - x, sz - z)).toBeGreaterThan(r + 0.2);
        expect(Number.isFinite(groundHeight(g, sx, sz))).toBe(true);
        const [ix, iz] = g.interact;
        expect(Math.hypot(ix, iz)).toBeLessThan(g.half);
        expect(g.reach).toBeGreaterThan(0);
      });

      it("lets the player walk from the arrival spot out of the footprint", () => {
        // Flood-fill a fine grid of spots a player (radius 0.3, as in game/player) can occupy, from the arrival
        // spot; some must lie beyond the footprint edge. Catches arrival spots boxed in by solids.
        // Islands in a water region are left by boat, so they're exempt.
        if (landmarkWaterLevel(spec.biome) !== undefined) return;
        const R = 0.3;
        const step = 0.2;
        const lim = g.half + 1.0;
        const n = Math.ceil((2 * lim) / step);
        const buckets = new Map<string, (readonly [number, number, number])[]>();
        for (const s of g.solids) {
          const key = `${Math.floor(s[0])},${Math.floor(s[1])}`;
          (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(s);
        }
        const free = (x: number, z: number): boolean => {
          for (let bx = Math.floor(x) - 1; bx <= Math.floor(x) + 1; bx++)
            for (let bz = Math.floor(z) - 1; bz <= Math.floor(z) + 1; bz++)
              for (const [sx, sz, r] of buckets.get(`${bx},${bz}`) ?? []) if (Math.hypot(x - sx, z - sz) < r + R) return false;
          return true;
        };
        const at = (i: number) => -lim + i * step;
        const start = [Math.round((g.stand[0] + lim) / step), Math.round((g.stand[1] + lim) / step)] as const;
        const seen = new Set<number>([start[0] * n + start[1]]);
        const queue: (readonly [number, number])[] = [start];
        let out = false;
        while (queue.length && !out) {
          const [i, j] = queue.pop()!;
          if (Math.max(Math.abs(at(i)), Math.abs(at(j))) > g.half + 0.5) out = true;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a > n || b > n || seen.has(a * n + b) || !free(at(a), at(b))) continue;
            seen.add(a * n + b);
            queue.push([a, b]);
          }
        }
        expect(out).toBe(true);
      });

      it("keeps every solid inside the footprint", () => {
        for (const [x, z] of g.solids) {
          expect(Math.abs(x)).toBeLessThanOrEqual(g.half + 0.5);
          expect(Math.abs(z)).toBeLessThanOrEqual(g.half + 0.5);
        }
      });
    });
  }
});
