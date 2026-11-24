import { TRACKS, type TrackId, type TrackInfo } from "./tracks";

/** The slice of HTMLAudioElement the manager uses, so tests can substitute a fake. */
export interface AudioPlayer {
  volume: number;
  currentTime: number;
  loop?: boolean;
  onended: ((event: Event) => unknown) | null;
  play(): Promise<void> | void;
  pause(): void;
}
export type PlayerFactory = (url: string) => AudioPlayer;

export interface MusicOptions {
  readonly tracks?: Readonly<Record<string, TrackInfo>>;
  readonly createPlayer?: PlayerFactory;
  /** Seconds to fade a track in or out when the track changes. */
  readonly fadeSeconds?: number;
  /**
   * Fixed attenuation under the player's volume setting. The tracks are mastered hot
   * (about -15 LUFS), so the slider's full range maps to a comfortable level.
   */
  readonly gain?: number;
  /** Seconds the music takes to move between ducked and normal level. */
  readonly duckSeconds?: number;
  /** Seconds the music takes to come back up after a duck (default: the same as `duckSeconds`). */
  readonly duckReleaseSeconds?: number;
}

export interface MusicStatus {
  readonly track: TrackId | null;
  /** True once a user gesture has allowed playback. */
  readonly unlocked: boolean;
  readonly muted: boolean;
  readonly volume: number;
  /** Current ducking multiplier in [0, 1] (1 = not ducked). */
  readonly duck: number;
  /** Tracks currently audible or fading, newest last. */
  readonly voices: ReadonlyArray<{ readonly id: string; readonly level: number }>;
}

export interface Music {
  /** Call from a user gesture (key, click): browsers block audio before one. */
  unlock(): void;
  /** Switches tracks, with an optional cut for outgoing voices that are already ducked. */
  setTrack(id: TrackId, fadeSeconds?: number, outgoing?: "crossfade" | "cut"): void;
  /** Master volume in [0, 1]. */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Wants the music at this fraction of its level (e.g. under a stinger); 1 releases. Eased in `update`. */
  setDuck(level: number): void;
  /** Advances fades and ducking; call once per frame. */
  update(dtSeconds: number): void;
  status(): MusicStatus;
}

interface Voice {
  readonly id: TrackId;
  readonly player: AudioPlayer;
  /** The track's own level relative to the others. */
  readonly trackGain: number;
  /** Fade level in [0, 1]. */
  level: number;
  target: 0 | 1;
}

/** Music plays at half the nominal level: the tracks are mastered loud. */
export const DEFAULT_GAIN = 0.5;

const defaultFactory: PlayerFactory = (url) => {
  const audio = new Audio(url);
  audio.preload = "auto";
  return audio;
};

/**
 * Background music loops in the player and crossfades when the track changes.
 * Nothing plays until `unlock()`.
 */
export function createMusic(options: MusicOptions = {}): Music {
  const tracks = options.tracks ?? TRACKS;
  const createPlayer = options.createPlayer ?? defaultFactory;
  const defaultFade = options.fadeSeconds ?? 3;
  let fadeSeconds = defaultFade;
  const gain = options.gain ?? DEFAULT_GAIN;
  const duckSeconds = options.duckSeconds ?? 0.8;
  const duckReleaseSeconds = options.duckReleaseSeconds ?? duckSeconds;

  let voices: Voice[] = [];
  let desired: TrackId | null = null;
  let unlocked = false;
  let muted = false;
  let volume = 0.5;
  let duck = 1;
  let duckTarget = 1;

  const apply = (v: Voice): void => {
    v.player.volume = muted ? 0 : volume * gain * v.trackGain * duck * v.level;
  };

  const start = (id: TrackId): void => {
    const info = tracks[id];
    if (!info) throw new Error(`unknown track: ${id}`);
    const player = createPlayer(info.url);
    player.loop = true;
    const voice: Voice = { id, player, trackGain: info.gain ?? 1, level: 0, target: 1 };
    apply(voice);
    voices.push(voice);
    // Autoplay can still be refused (e.g. the gesture was too old); retry on the next unlock().
    Promise.resolve(voice.player.play()).catch(() => {
      if (!voices.includes(voice)) return;
      voices = voices.filter((x) => x !== voice);
      unlocked = false;
    });
  };

  const begin = (): void => {
    if (!unlocked || desired === null) return;
    for (const v of voices) v.target = 0;
    start(desired);
  };

  return {
    unlock() {
      if (unlocked) return;
      unlocked = true;
      if (!voices.some((v) => v.id === desired && v.target === 1)) begin();
    },
    setTrack(id, seconds, outgoing = "crossfade") {
      if (id === desired) return;
      if (outgoing === "cut") {
        for (const voice of voices) voice.player.pause();
        voices = [];
      }
      fadeSeconds = Math.max(0.1, seconds ?? defaultFade);
      desired = id;
      begin();
    },
    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      voices.forEach(apply);
    },
    setMuted(m) {
      muted = m;
      voices.forEach(apply);
    },
    setDuck(level) {
      duckTarget = Math.min(1, Math.max(0, level));
    },
    update(dt) {
      const delta = duckTarget - duck;
      const maxMove = dt / (delta > 0 ? duckReleaseSeconds : duckSeconds);
      duck = Math.abs(delta) <= maxMove ? duckTarget : duck + Math.sign(delta) * maxMove;
      const step = dt / fadeSeconds;
      for (const v of voices) {
        v.level = v.target === 1 ? Math.min(1, v.level + step) : Math.max(0, v.level - step);
        apply(v);
      }
      for (const v of voices) {
        if (v.target === 0 && v.level === 0) {
          v.player.pause();
        }
      }
      voices = voices.filter((v) => !(v.target === 0 && v.level === 0));
    },
    status: () => ({
      track: desired,
      unlocked,
      muted,
      volume,
      duck,
      voices: voices.map((v) => ({ id: v.id, level: v.level })),
    }),
  };
}
