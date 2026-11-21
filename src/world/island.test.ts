import { describe, expect, it } from "vitest";
import { createRng } from "../core";
import { defaultIsland, islandOutline } from "./island";

describe("islandOutline", () => {
  it("is deterministic per seed", () => {
    expect(islandOutline(createRng("s"))).toEqual(islandOutline(createRng("s")));
    expect(islandOutline(createRng("s"))).not.toEqual(islandOutline(createRng("t")));
  });

  it("has the requested number of points within the jittered bounds", () => {
    const pts = islandOutline(createRng(1));
    expect(pts).toHaveLength(defaultIsland.segments);
    const jx = defaultIsland.halfX * (1 + defaultIsland.jitter) + 1e-9;
    const jz = defaultIsland.halfZ * (1 + defaultIsland.jitter) + 1e-9;
    for (const [x, z] of pts) {
      expect(Math.abs(x)).toBeLessThanOrEqual(jx);
      expect(Math.abs(z)).toBeLessThanOrEqual(jz);
    }
  });
});
