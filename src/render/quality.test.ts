import { describe, expect, it } from "vitest";
import { createFrameGovernor, renderQuality, startingPixelRatio, type DeviceTraits } from "./quality";

const desktop: DeviceTraits = { devicePixelRatio: 2, coarsePointer: false, cores: 8, memoryGb: 8 };
const phone: DeviceTraits = { devicePixelRatio: 3, coarsePointer: true, cores: 8, memoryGb: 8 };
const lowPhone: DeviceTraits = { devicePixelRatio: 2.6, coarsePointer: true, cores: 4, memoryGb: 2 };

describe("renderQuality", () => {
  it("keeps the full budget on desktop", () => {
    const q = renderQuality(desktop);
    expect(startingPixelRatio(q, desktop)).toBe(2);
    expect(q.shadowMapSize).toBe(2048);
  });

  it("caps phones lower, and low-end phones lowest", () => {
    expect(startingPixelRatio(renderQuality(phone), phone)).toBe(1.5);
    expect(startingPixelRatio(renderQuality(lowPhone), lowPhone)).toBe(1);
    expect(renderQuality(phone).shadowMapSize).toBe(1024);
  });

  it("never raises a screen's own ratio", () => {
    const old = { ...desktop, devicePixelRatio: 1 };
    expect(startingPixelRatio(renderQuality(old), old)).toBe(1);
  });

  it("treats unknown cores and memory as capable", () => {
    const unknown = { ...phone, cores: 0, memoryGb: 0 };
    expect(renderQuality(unknown).maxPixelRatio).toBe(1.5);
  });
});

describe("createFrameGovernor", () => {
  const run = (fps: number, seconds: number, start = 2, floor = 1): number[] => {
    const applied: number[] = [];
    const g = createFrameGovernor(start, floor, (pr) => applied.push(pr));
    for (let t = 0; t <= seconds * 1000; t += 1000 / fps) g.frame(t + 1);
    return applied;
  };

  it("leaves a smooth game alone", () => {
    expect(run(60, 20)).toEqual([]);
  });

  it("steps down while the frame rate stays low, then stops at the floor", () => {
    expect(run(25, 40)).toEqual([1.75, 1.5, 1.25, 1]);
  });

  it("waits out start-up and a single slow stretch", () => {
    expect(run(25, 7)).toEqual([]);
    expect(run(25, 10)).toEqual([]);
  });

  it("ignores single long hitches", () => {
    const applied: number[] = [];
    const g = createFrameGovernor(2, 1, (pr) => applied.push(pr));
    let t = 1;
    for (let i = 0; i < 600; i++) {
      t += i % 120 === 0 ? 900 : 1000 / 60;
      g.frame(t);
    }
    expect(applied).toEqual([]);
  });
});
