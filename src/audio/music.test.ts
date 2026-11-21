import { describe, expect, it } from "vitest";
import { createMusic, type AudioPlayer } from "./music";

class FakePlayer implements AudioPlayer {
  volume = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  playing = false;
  plays = 0;
  reject = false;
  constructor(readonly url: string) {}
  play() {
    this.plays++;
    if (this.reject) return Promise.reject(new Error("blocked"));
    this.playing = true;
    return Promise.resolve();
  }
  pause() {
    this.playing = false;
  }
}

const tracks = { a: { url: "a.mp3" }, b: { url: "b.mp3" } } as never;

function setup(opts: { fade?: number; gap?: number; gain?: number } = {}) {
  const made: FakePlayer[] = [];
  const music = createMusic({
    tracks,
    fadeSeconds: opts.fade ?? 2,
    gapSeconds: opts.gap ?? 4,
    gain: opts.gain ?? 1,
    duckSeconds: 1,
    createPlayer: (url) => {
      const p = new FakePlayer(url);
      made.push(p);
      return p;
    },
  });
  return { music, made };
}

const run = (music: ReturnType<typeof setup>["music"], seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) music.update(0.1);
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("music", () => {
  it("plays nothing until unlocked", () => {
    const { music, made } = setup();
    music.setTrack("a" as never);
    run(music, 5);
    expect(made).toHaveLength(0);
  });

  it("starts the chosen track on unlock and fades it in to the master volume", () => {
    const { music, made } = setup();
    music.setVolume(0.6);
    music.setTrack("a" as never);
    music.unlock();
    expect(made).toHaveLength(1);
    expect(made[0]!.playing).toBe(true);
    expect(made[0]!.volume).toBe(0);
    run(music, 1);
    expect(made[0]!.volume).toBeGreaterThan(0.2);
    expect(made[0]!.volume).toBeLessThan(0.4);
    run(music, 2);
    expect(made[0]!.volume).toBeCloseTo(0.6);
  });

  it("starts immediately when a track is chosen after unlock", () => {
    const { music, made } = setup();
    music.unlock();
    expect(made).toHaveLength(0);
    music.setTrack("a" as never);
    expect(made).toHaveLength(1);
  });

  it("mutes without stopping playback, and restores", () => {
    const { music, made } = setup();
    music.setTrack("a" as never);
    music.unlock();
    run(music, 3);
    music.setMuted(true);
    expect(made[0]!.volume).toBe(0);
    expect(made[0]!.playing).toBe(true);
    music.setMuted(false);
    expect(made[0]!.volume).toBeGreaterThan(0);
  });

  it("clamps the volume", () => {
    const { music } = setup();
    music.setVolume(3);
    expect(music.status().volume).toBe(1);
    music.setVolume(-1);
    expect(music.status().volume).toBe(0);
  });

  it("crossfades to a new track and stops the old one", () => {
    const { music, made } = setup();
    music.setTrack("a" as never);
    music.unlock();
    run(music, 3);
    music.setTrack("b" as never);
    expect(made).toHaveLength(2);
    run(music, 1);
    expect(made[0]!.playing).toBe(true);
    expect(made[0]!.volume).toBeLessThan(0.5);
    expect(made[1]!.volume).toBeGreaterThan(0);
    run(music, 2);
    expect(made[0]!.playing).toBe(false);
    expect(made[1]!.volume).toBeCloseTo(0.5);
    expect(music.status().voices).toHaveLength(1);
  });

  it("ignores a request for the track already playing", () => {
    const { music, made } = setup();
    music.setTrack("a" as never);
    music.unlock();
    music.setTrack("a" as never);
    expect(made).toHaveLength(1);
  });

  it("repeats a finished track after the gap", () => {
    const { music, made } = setup({ gap: 4 });
    music.setTrack("a" as never);
    music.unlock();
    run(music, 3);
    made[0]!.currentTime = 99;
    made[0]!.onended!();
    run(music, 3);
    expect(made[0]!.plays).toBe(1);
    run(music, 2);
    expect(made[0]!.plays).toBe(2);
    expect(made[0]!.currentTime).toBe(0);
  });

  it("retries on the next gesture if the browser refuses autoplay", async () => {
    const { music, made } = setup();
    music.setTrack("a" as never);
    const origPlay = FakePlayer.prototype.play;
    FakePlayer.prototype.play = function () {
      (this as FakePlayer).reject = true;
      return origPlay.call(this);
    };
    music.unlock();
    await flush();
    FakePlayer.prototype.play = origPlay;
    expect(music.status().unlocked).toBe(false);
    music.unlock();
    await flush();
    expect(music.status().unlocked).toBe(true);
    expect(made).toHaveLength(2);
    expect(made[1]!.playing).toBe(true);
  });

  it("scales the volume by a fixed gain", () => {
    const { music, made } = setup({ gain: 0.5 });
    music.setVolume(0.8);
    music.setTrack("a" as never);
    music.unlock();
    run(music, 5);
    expect(made[0]!.volume).toBeCloseTo(0.4);
  });

  it("defaults to half level", () => {
    const made: FakePlayer[] = [];
    const music = createMusic({ tracks, fadeSeconds: 1, createPlayer: (u) => (made[made.length] = new FakePlayer(u)) });
    music.setVolume(1);
    music.setTrack("a" as never);
    music.unlock();
    run(music, 2);
    expect(made[0]!.volume).toBeCloseTo(0.5);
  });

  it("eases the music down and back up when ducked", () => {
    const { music, made } = setup();
    music.setVolume(1);
    music.setTrack("a" as never);
    music.unlock();
    run(music, 3);
    music.setDuck(0.2);
    run(music, 0.5);
    const mid = made[0]!.volume;
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0.2);
    run(music, 2);
    expect(made[0]!.volume).toBeCloseTo(0.2);
    music.setDuck(1);
    run(music, 2);
    expect(made[0]!.volume).toBeCloseTo(1);
  });
});
