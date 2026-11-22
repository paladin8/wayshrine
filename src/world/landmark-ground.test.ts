import { describe, expect, it } from "vitest";
import { LANDMARK_SPECS } from "./landmarks";
import { groundHeight, groundOf } from "./landmark-ground";

const modelled = LANDMARK_SPECS.filter((l) => groundOf(l.id));

describe("landmark model sidecars", () => {
  it("covers the crafted landmarks", () => {
    expect(modelled.length).toBeGreaterThanOrEqual(7);
  });

  for (const spec of modelled) {
    const g = groundOf(spec.id)!;
    describe(spec.id, () => {
      it("is a square grid matching its footprint", () => {
        const n = Math.round((2 * g.half) / g.step) + 1;
        expect(g.ground).toHaveLength(n);
        for (const row of g.ground) expect(row).toHaveLength(n);
      });

      it("sits at the base height all round its edge, so the terrain blends from one level", () => {
        for (const grid of [g.ground, g.terrain ?? g.ground]) {
          const n = grid.length;
          for (let i = 0; i < n; i++) {
            for (const v of [grid[0]![i]!, grid[n - 1]![i]!, grid[i]![0]!, grid[i]![n - 1]!]) {
              expect(Math.abs(v)).toBeLessThan(0.001);
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

      it("keeps every solid inside the footprint", () => {
        for (const [x, z] of g.solids) {
          expect(Math.abs(x)).toBeLessThanOrEqual(g.half + 0.5);
          expect(Math.abs(z)).toBeLessThanOrEqual(g.half + 0.5);
        }
      });
    });
  }
});
