import { describe, expect, it } from "vitest";
import { createNoise } from "./noise";

describe("createNoise", () => {
  it("is deterministic and independent of sampling order", () => {
    const a = createNoise("n");
    const b = createNoise("n");
    const first = a(3.3, 4.4);
    a(100, 100);
    expect(a(3.3, 4.4)).toBe(first);
    expect(b(3.3, 4.4)).toBe(first);
    expect(createNoise("m")(3.3, 4.4)).not.toBe(first);
  });

  it("stays in [0, 1) and varies smoothly", () => {
    const n = createNoise("range");
    let min = 1;
    let max = 0;
    for (let i = 0; i < 2000; i++) {
      const x = i * 0.37;
      const v = n(x, i * 0.11);
      min = Math.min(min, v);
      max = Math.max(max, v);
      expect(Math.abs(n(x + 0.01, 5) - n(x, 5))).toBeLessThan(0.05);
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    expect(max - min).toBeGreaterThan(0.5);
  });
});
