import { describe, expect, it } from "vitest";
import {
  AWAKENING,
  AWAKENING_LANDMARK,
  AWAKENING_TOTAL,
  SWELL_CRESTS,
  SWELL_LAG,
  awakeningFrame,
  awakeningTotal,
  captionTarget,
  CAPTION_LEAD,
  skipTarget,
  timingOf,
  type AwakeningKind,
} from "./awakening";
import { WAVE_EXTENT, lifeAt } from "./vitality-field";

/** First time at which a point `distance` from the shrine is at least `threshold` alive. */
function litAt(distance: number, kind: AwakeningKind = "shrine", threshold = 0.95): number {
  for (let t = 0; t < awakeningTotal(kind); t += 0.01) {
    if (lifeAt(awakeningFrame(t, kind).progress, distance) >= threshold) return t;
  }
  return awakeningTotal(kind);
}

const KINDS: readonly AwakeningKind[] = ["shrine", "landmark"];

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
    for (const kind of KINDS) expect(timingOf(kind).wave).toBeGreaterThanOrEqual(6);
    expect(AWAKENING.hold).toBeGreaterThanOrEqual(1);
  });

  it("keeps the long pause for landmarks only", () => {
    expect(AWAKENING_LANDMARK.hold).toBeGreaterThanOrEqual(3);
    expect(AWAKENING.hold).toBeLessThan(AWAKENING_LANDMARK.hold);
    expect(awakeningTotal("landmark")).toBeGreaterThan(AWAKENING_TOTAL);
  });

  it("times a landmark's own timeline: its frames, its skip target, its end", () => {
    const t = timingOf("landmark");
    expect(awakeningFrame(t.zoomOut + t.wave + t.hold / 2, "landmark")).toMatchObject({ progress: 1, zoom: 1 });
    expect(awakeningFrame(awakeningTotal("landmark"), "landmark").done).toBe(true);
    expect(awakeningFrame(awakeningTotal("shrine") + 0.1, "landmark").done).toBe(false);
    expect(skipTarget(2, "landmark")).toBe(t.zoomOut + t.wave + t.hold);
  });

  it("finishes the energy just before the swell crests", () => {
    // A typical far edge (47 tiles out) is lit shortly before the perceived crest; the last
    // stragglers out at the timed extent finish within a moment after it.
    for (const kind of KINDS) {
      const crest = SWELL_CRESTS[kind] + SWELL_LAG;
      expect(litAt(47, kind)).toBeLessThanOrEqual(crest);
      expect(litAt(47, kind)).toBeGreaterThan(crest - 0.6);
      expect(litAt(WAVE_EXTENT, kind)).toBeLessThanOrEqual(crest + 0.8);
    }
  });

  it("has the wave's own progress finish soon after the crest and keeps the pause after it", () => {
    for (const kind of KINDS) {
      const t = timingOf(kind);
      expect(t.zoomOut + t.wave).toBeLessThanOrEqual(SWELL_CRESTS[kind] + SWELL_LAG + 1.2);
      expect(t.zoomOut + t.wave + t.hold).toBeGreaterThan(SWELL_CRESTS[kind] + 1.5);
    }
  });

  it("starts a landmark's name as the wave finishes and keeps it through the pause", () => {
    const t = timingOf("landmark");
    const holdStart = t.zoomOut + t.wave;
    expect(captionTarget(holdStart - CAPTION_LEAD - 0.01, "landmark")).toBe(0);
    expect(captionTarget(holdStart - CAPTION_LEAD, "landmark")).toBe(1);
    expect(captionTarget(holdStart + t.hold - 0.01, "landmark")).toBe(1);
    expect(captionTarget(holdStart + t.hold, "landmark")).toBe(0); // the camera is returning
    expect(captionTarget(0, "landmark")).toBe(0);
    for (let time = 0; time < awakeningTotal("shrine"); time += 0.1) expect(captionTarget(time, "shrine")).toBe(0);
  });

  it("leaves the player time to read the name before the camera returns", () => {
    expect(AWAKENING_LANDMARK.zoomOut + AWAKENING_LANDMARK.wave - CAPTION_LEAD).toBeCloseTo(10.3);
    expect(awakeningTotal("landmark")).toBeCloseTo(17.1);
    expect(AWAKENING_LANDMARK.hold + CAPTION_LEAD).toBeGreaterThanOrEqual(4);
  });
});
