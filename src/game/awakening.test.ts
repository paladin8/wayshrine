import { describe, expect, it } from "vitest";
import { AWAKENING, AWAKENING_TOTAL, awakeningFrame, skipTarget } from "./awakening";

describe("awakening timeline", () => {
  it("starts with the camera still and nothing energised", () => {
    expect(awakeningFrame(0)).toEqual({ progress: 0, zoom: 0, done: false });
  });

  it("pulls back before any energy moves", () => {
    const mid = awakeningFrame(AWAKENING.zoomOut / 2);
    expect(mid.zoom).toBeGreaterThan(0);
    expect(mid.zoom).toBeLessThan(1);
    expect(mid.progress).toBe(0);
    expect(awakeningFrame(AWAKENING.zoomOut)).toMatchObject({ progress: 0, zoom: 1 });
  });

  it("holds the wide view while the wave spreads, then pauses on the finished region", () => {
    const during = awakeningFrame(AWAKENING.zoomOut + AWAKENING.wave / 2);
    expect(during.zoom).toBe(1);
    expect(during.progress).toBeCloseTo(0.5);
    const hold = awakeningFrame(AWAKENING.zoomOut + AWAKENING.wave + AWAKENING.hold / 2);
    expect(hold).toMatchObject({ progress: 1, zoom: 1, done: false });
  });

  it("returns the camera and finishes", () => {
    const back = awakeningFrame(AWAKENING_TOTAL - AWAKENING.zoomIn / 2);
    expect(back.progress).toBe(1);
    expect(back.zoom).toBeGreaterThan(0);
    expect(back.zoom).toBeLessThan(1);
    expect(awakeningFrame(AWAKENING_TOTAL)).toEqual({ progress: 1, zoom: 0, done: true });
  });

  it("never moves progress backwards", () => {
    let last = -1;
    for (let t = 0; t <= AWAKENING_TOTAL; t += 0.05) {
      const f = awakeningFrame(t);
      expect(f.progress).toBeGreaterThanOrEqual(last);
      last = f.progress;
    }
  });

  it("lets the player skip to the camera's return, but never backwards", () => {
    const skipped = skipTarget(2);
    expect(awakeningFrame(skipped).progress).toBe(1);
    expect(skipTarget(AWAKENING_TOTAL - 0.1)).toBe(AWAKENING_TOTAL - 0.1);
  });

  it("is slow enough to appreciate: the wave takes several seconds and the pause is real", () => {
    expect(AWAKENING.wave).toBeGreaterThanOrEqual(6);
    expect(AWAKENING.hold).toBeGreaterThanOrEqual(2);
  });
});
