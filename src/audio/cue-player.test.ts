import { describe, expect, it } from "vitest";
import { createCuePlayer } from "./cue-player";
import type { AudioPlayer } from "./music";

class FakePlayer implements AudioPlayer {
  volume = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  playing = false;
  reject = false;
  play() {
    if (this.reject) return Promise.reject(new Error("blocked"));
    this.playing = true;
    return Promise.resolve();
  }
  pause() {
    this.playing = false;
  }
}

function setup() {
  const made: FakePlayer[] = [];
  const cues = createCuePlayer({
    cues: { x: { url: "x.mp3" } },
    createPlayer: () => {
      const p = new FakePlayer();
      made.push(p);
      return p;
    },
  });
  cues.setVolume(0.8);
  return { cues, p: made[0]! };
}

describe("cue player", () => {
  it("creates players up front and plays from the start at the master volume", () => {
    const { cues, p } = setup();
    p.currentTime = 5;
    cues.play("x" as never);
    expect(p.playing).toBe(true);
    expect(p.currentTime).toBe(0);
    expect(p.volume).toBeCloseTo(0.8);
    expect(cues.playing()).toEqual(["x"]);
  });

  it("is silent while muted", () => {
    const { cues, p } = setup();
    cues.setMuted(true);
    cues.play("x" as never);
    expect(p.volume).toBe(0);
    cues.setMuted(false);
    expect(p.volume).toBeCloseTo(0.8);
  });

  it("fades out and stops", () => {
    const { cues, p } = setup();
    cues.play("x" as never);
    cues.stop("x" as never, 1);
    cues.update(0.5);
    expect(p.volume).toBeCloseTo(0.4);
    expect(p.playing).toBe(true);
    cues.update(0.6);
    expect(p.playing).toBe(false);
    expect(cues.playing()).toEqual([]);
  });

  it("stops at once with no fade, and is idle when it ends by itself", () => {
    const { cues, p } = setup();
    cues.play("x" as never);
    cues.stop("x" as never);
    expect(p.playing).toBe(false);
    cues.play("x" as never);
    p.onended?.();
    expect(cues.playing()).toEqual([]);
  });

  it("gives up cleanly when the browser refuses to play", async () => {
    const { cues, p } = setup();
    p.reject = true;
    cues.play("x" as never);
    await new Promise((r) => setTimeout(r, 0));
    expect(cues.playing()).toEqual([]);
  });

  it("throws for an unknown cue", () => {
    const { cues } = setup();
    expect(() => cues.play("nope" as never)).toThrow();
  });
});
