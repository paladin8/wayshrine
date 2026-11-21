import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

const take = (n: number, next: () => number) => Array.from({ length: n }, next);

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("world");
    const b = createRng("world");
    expect(take(20, a.next)).toEqual(take(20, b.next));
  });

  it("differs between seeds", () => {
    expect(take(8, createRng("a").next)).not.toEqual(take(8, createRng("b").next));
  });

  it("keeps values and helpers in range", () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const v = r.range(-3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
      const n = r.int(2, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThan(6);
    }
  });

  it("fork depends on the label, not on how much the parent has been used", () => {
    const fresh = createRng("w").fork("chunk:3,4");
    const used = createRng("w");
    take(50, used.next);
    expect(take(10, used.fork("chunk:3,4").next)).toEqual(take(10, fresh.next));
    expect(take(10, createRng("w").fork("chunk:3,5").next)).not.toEqual(
      take(10, createRng("w").fork("chunk:3,4").next),
    );
  });
});
