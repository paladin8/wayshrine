import type { AudioPlayer, PlayerFactory } from "./music";
import { CUES, type CueId, type CueInfo } from "./cues";

export interface CuePlayerOptions {
  readonly cues?: Readonly<Record<string, CueInfo>>;
  readonly createPlayer?: PlayerFactory;
}

export interface CuePlayer {
  /** Starts a cue, optionally fading in. A fading loop can resume at its current playhead. */
  play(id: CueId, fadeInSeconds?: number): void;
  /** Fades a cue out over `seconds` (immediately if 0) and stops it. */
  stop(id: CueId, seconds?: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Advances fades; call once per frame. */
  update(dtSeconds: number): void;
  /** Ids of cues currently audible. */
  playing(): readonly string[];
  /** Audio time in seconds, or null when the cue is idle. */
  elapsed(id: CueId): number | null;
}

interface Voice {
  readonly player: AudioPlayer;
  readonly gain: number;
  level: number;
  fade: { from: number; to: number; left: number; total: number } | null;
  active: boolean;
}

const defaultFactory: PlayerFactory = (url) => {
  const audio = new Audio(url);
  audio.preload = "auto";
  return audio;
};

/**
 * Plays sound effects. Players are created up front so the first play has no load delay,
 * and reused. Pure logic over an injected player so it is tested without a browser.
 */
export function createCuePlayer(options: CuePlayerOptions = {}): CuePlayer {
  const cues = options.cues ?? CUES;
  const createPlayer = options.createPlayer ?? defaultFactory;
  const voices = new Map<string, Voice>();
  for (const [id, info] of Object.entries(cues)) {
    const player = createPlayer(info.url);
    player.loop = info.loop ?? false;
    voices.set(id, { player, gain: info.gain ?? 1, level: 1, fade: null, active: false });
  }
  let volume = 0.5;
  let muted = false;

  const apply = (v: Voice): void => {
    v.player.volume = muted ? 0 : volume * v.gain * v.level;
  };
  const halt = (v: Voice): void => {
    v.player.pause();
    v.player.onended = null;
    v.active = false;
    v.fade = null;
  };
  const voiceOf = (id: string): Voice => {
    const v = voices.get(id);
    if (!v) throw new Error(`unknown cue: ${id}`);
    return v;
  };

  return {
    play(id, fadeInSeconds = 0) {
      const v = voiceOf(id);
      const resume = v.player.loop && v.active && fadeInSeconds > 0;
      if (!resume) v.level = fadeInSeconds > 0 ? 0 : 1;
      v.fade = fadeInSeconds > 0 ? { from: v.level, to: 1, left: fadeInSeconds, total: fadeInSeconds } : null;
      if (resume) return;
      v.active = true;
      v.player.currentTime = 0;
      const onended = () => halt(v);
      v.player.onended = onended;
      apply(v);
      Promise.resolve(v.player.play()).catch(() => {
        if (v.player.onended === onended) halt(v);
      });
    },
    stop(id, seconds = 0) {
      const v = voiceOf(id);
      if (!v.active) return;
      if (seconds <= 0) halt(v);
      else v.fade = { from: v.level, to: 0, left: seconds, total: seconds };
    },
    setVolume(next) {
      volume = Math.min(1, Math.max(0, next));
      voices.forEach(apply);
    },
    setMuted(next) {
      muted = next;
      voices.forEach(apply);
    },
    update(dt) {
      for (const v of voices.values()) {
        if (!v.active || !v.fade) continue;
        const fade = v.fade;
        fade.left = Math.max(0, fade.left - dt);
        v.level = fade.to + (fade.from - fade.to) * (fade.left / fade.total);
        apply(v);
        if (fade.left === 0) {
          if (fade.to === 0) halt(v);
          else v.fade = null;
        }
      }
    },
    playing: () => [...voices].filter(([, v]) => v.active).map(([id]) => id),
    elapsed(id) {
      const voice = voiceOf(id);
      return voice.active ? voice.player.currentTime : null;
    },
  };
}
