import { describe, expect, it } from "vitest";
import { createZoomCut } from "./motion";

const ease = (t: number): number => t * t * (3 - 2 * t);

describe("createZoomCut", () => {
  it("holds while the zoom moves, then cuts to where it settles", () => {
    const cut = createZoomCut();
    const dt = 1 / 60;
    const shown: number[] = [];
    // A 1.2 s pull-back to 1, a 2 s hold, then a 1.6 s return.
    for (let t = 0; t < 6; t += dt) {
      const z = t < 1.2 ? ease(t / 1.2) : t < 3.2 ? 1 : t < 4.8 ? 1 - ease((t - 3.2) / 1.6) : 0;
      shown.push(cut(z, dt));
    }
    expect([...new Set(shown)]).toEqual([0, 1]);
    expect(shown.at(-1)).toBe(0);
  });

  it("follows a zoom that never moves", () => {
    const cut = createZoomCut();
    expect(cut(0.3, 0.016)).toBe(0.3);
    expect(cut(0.3, 0.016)).toBe(0.3);
  });
});
