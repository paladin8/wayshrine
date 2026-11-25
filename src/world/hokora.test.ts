import { describe, expect, it } from "vitest";
import { HOKORA_SETBACK, hokoraOf, waveOriginOf } from "./hokora";
import { createWorld } from "./world";

const world = createWorld("hokora-tests");

describe("restoration wave origin", () => {
  it("starts at the hokora behind the gate for an ordinary shrine", () => {
    const ordinary = [world.region(0, 0), world.region(1, 0), world.region(0, 1), world.region(-1, 0)].find((r) => !r.landmark)!;
    const origin = waveOriginOf(ordinary);
    expect(origin).toEqual(hokoraOf(ordinary));
    expect(Math.hypot(origin.x - ordinary.shrine.x, origin.z - ordinary.shrine.z)).toBeCloseTo(HOKORA_SETBACK);
  });

  it("starts at the shrine itself for a landmark", () => {
    const region = world.landmarks[0]!;
    expect(waveOriginOf(region)).toEqual(region.shrine);
  });
});
