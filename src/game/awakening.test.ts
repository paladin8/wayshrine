import { describe, expect, it } from "vitest";
import { AWAKENING, AWAKENING_TOTAL, SWELL_CREST, SWELL_LAG, awakeningFrame, skipTarget } from "./awakening";
import { WAVE_EXTENT, lifeAt } from "./vitality-field";

/** First time at which a point `distance` from the shrine is at least `threshold` alive. */
function litAt(distance: number, threshold = 0.95): number {
  for (let t = 0; t < AWAKENING_TOTAL; t += 0.01) {
    if (lifeAt(awakeningFrame(t).progress, distance) >= threshold) return t;
  }
  return AWAKENING_TOTAL;
}

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

  it("finishes the energy just before the swell crests", () => {
    // A typical far edge (47 tiles out) is lit shortly before the perceived crest; the last
    // stragglers out at the timed extent finish within a moment after it.
    const crest = SWELL_CREST + SWELL_LAG;
    expect(litAt(47)).toBeLessThanOrEqual(crest);
    expect(litAt(47)).toBeGreaterThan(crest - 0.5);
    expect(litAt(WAVE_EXTENT)).toBeLessThanOrEqual(crest + 0.8);
  });

  it("has the wave's own progress finish soon after the crest and keeps the pause after it", () => {
    expect(AWAKENING.zoomOut + AWAKENING.wave).toBeLessThanOrEqual(SWELL_CREST + SWELL_LAG + 1.2);
    expect(AWAKENING.zoomOut + AWAKENING.wave + AWAKENING.hold).toBeGreaterThan(SWELL_CREST + 2);
  });
});
