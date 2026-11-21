import { describe, expect, it } from "vitest";
import { REGION_REACH } from "../world";
import { FRONT_WIDTH, frontGlow, frontRadius, lifeAt } from "./vitality-field";

describe("vitality field", () => {
  it("is dead everywhere at 0 and alive everywhere at 1", () => {
    for (const d of [0, 10, REGION_REACH]) {
      expect(lifeAt(0, d)).toBe(0);
      expect(lifeAt(1, d)).toBe(1);
    }
  });

  it("radiates outward: nearer points come alive first", () => {
    for (let p = 0.05; p < 1; p += 0.05) {
      let last = 2;
      for (let d = 0; d <= REGION_REACH; d += 4) {
        const life = lifeAt(p, d);
        expect(life).toBeLessThanOrEqual(last);
        last = life;
      }
    }
  });

  it("never loses life as progress increases", () => {
    for (const d of [0, 20, 50, REGION_REACH]) {
      let last = -1;
      for (let p = 0; p <= 1; p += 0.02) {
        const life = lifeAt(p, d);
        expect(life).toBeGreaterThanOrEqual(last);
        last = life;
      }
    }
  });

  it("brings the farthest point fully alive just before the end", () => {
    expect(lifeAt(0.999, REGION_REACH)).toBeGreaterThan(0.95);
  });

  it("lights the shrine itself almost immediately", () => {
    expect(lifeAt(0.15, 0)).toBeGreaterThan(0.95);
  });

  it("glows only on the front", () => {
    expect(frontGlow(0, 5)).toBe(0);
    expect(frontGlow(1, 5)).toBe(0);
    const r = frontRadius(0.5)!;
    expect(frontGlow(0.5, r)).toBeCloseTo(1);
    expect(frontGlow(0.5, r - FRONT_WIDTH)).toBeCloseTo(0);
    expect(frontGlow(0.5, r + FRONT_WIDTH)).toBeCloseTo(0);
    expect(lifeAt(0.5, r)).toBeCloseTo(0.5);
  });

  it("has no front when dead or alive", () => {
    expect(frontRadius(0)).toBeNull();
    expect(frontRadius(1)).toBeNull();
    expect(frontRadius(0.5)).toBeGreaterThan(0);
  });
});
