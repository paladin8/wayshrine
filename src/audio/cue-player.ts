import type { AudioPlayer, PlayerFactory } from "./music";
import { CUES, type CueId, type CueInfo } from "./cues";

export interface CuePlayerOptions {
  readonly cues?: Readonly<Record<string, CueInfo>>;
  readonly createPlayer?: PlayerFactory;
}

export interface CuePlayer {
  /** Starts a cue from the beginning; restarts it if it is already playing. */
  play(id: CueId): void;
  /** Fades a cue out over `seconds` (immediately if 0) and stops it. */
  stop(id: CueId, seconds?: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Advances fade-outs; call once per frame. */
  update(dtSeconds: number): void;
  /** Ids of cues currently audible. */
  playing(): readonly string[];
}

interface Voice {
  readonly player: AudioPlayer;
  level: number;
  /** Seconds of fade-out left, or null while playing normally. */
  fade: { left: number; total: number } | null;
  active: boolean;
}

const defaultFactory: PlayerFactory = (url) => {
  const audio = new Audio(url);
  audio.preload = "auto";
  return audio;
};

/**
 * Plays one-shot cues. Players are created up front so the first play has no load delay,
 * and reused. Pure logic over an injected player so it is tested without a browser.
 */
export function createCuePlayer(options: CuePlayerOptions = {}): CuePlayer {
  const cues = options.cues ?? CUES;
  const createPlayer = options.createPlayer ?? defaultFactory;
  const voices = new Map<string, Voice>();
  for (const [id, info] of Object.entries(cues)) {
    voices.set(id, { player: createPlayer(info.url), level: 1, fade: null, active: false });
  }
  let volume = 0.5;
  let muted = false;

  const apply = (v: Voice): void => {
    v.player.volume = muted ? 0 : volume * v.level;
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
    play(id) {
      const v = voiceOf(id);
      v.level = 1;
      v.fade = null;
      v.active = true;
      v.player.currentTime = 0;
      v.player.onended = () => halt(v);
      apply(v);
      Promise.resolve(v.player.play()).catch(() => halt(v));
    },
    stop(id, seconds = 0) {
      const v = voiceOf(id);
      if (!v.active) return;
      if (seconds <= 0) halt(v);
      else v.fade = { left: seconds, total: seconds };
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
        v.fade.left -= dt;
        if (v.fade.left <= 0) halt(v);
        else {
          v.level = v.fade.left / v.fade.total;
          apply(v);
        }
      }
    },
    playing: () => [...voices].filter(([, v]) => v.active).map(([id]) => id),
  };
}
