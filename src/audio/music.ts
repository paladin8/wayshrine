import { TRACKS, type TrackId, type TrackInfo } from "./tracks";

/** The slice of HTMLAudioElement the manager uses, so tests can substitute a fake. */
export interface AudioPlayer {
  volume: number;
  currentTime: number;
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
  /** Silence between a track ending and starting over. */
  readonly gapSeconds?: number;
}

export interface MusicStatus {
  readonly track: TrackId | null;
  /** True once a user gesture has allowed playback. */
  readonly unlocked: boolean;
  readonly muted: boolean;
  readonly volume: number;
  /** Tracks currently audible or fading, newest last. */
  readonly voices: ReadonlyArray<{ readonly id: string; readonly level: number }>;
}

export interface Music {
  /** Call from a user gesture (key, click): browsers block audio before one. */
  unlock(): void;
  /** Crossfades to a track. Does nothing if it is already the current one. */
  setTrack(id: TrackId): void;
  /** Master volume in [0, 1]. */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Advances fades and loop gaps; call once per frame. */
  update(dtSeconds: number): void;
  status(): MusicStatus;
}

interface Voice {
  readonly id: TrackId;
  readonly player: AudioPlayer;
  /** Fade level in [0, 1]. */
  level: number;
  target: 0 | 1;
  /** Seconds left before a finished track starts over, or null while playing. */
  gap: number | null;
}

const defaultFactory: PlayerFactory = (url) => {
  const audio = new Audio(url);
  audio.preload = "auto";
  return audio;
};

/**
 * Background music: one track at a time, crossfaded on change. Tracks that
 * finish pause for a moment and then repeat. Nothing plays until `unlock()`.
 */
export function createMusic(options: MusicOptions = {}): Music {
  const tracks = options.tracks ?? TRACKS;
  const createPlayer = options.createPlayer ?? defaultFactory;
  const fadeSeconds = options.fadeSeconds ?? 3;
  const gapSeconds = options.gapSeconds ?? 4;

  let voices: Voice[] = [];
  let desired: TrackId | null = null;
  let unlocked = false;
  let muted = false;
  let volume = 0.5;

  const apply = (v: Voice): void => {
    v.player.volume = muted ? 0 : volume * v.level;
  };

  const start = (id: TrackId): void => {
    const info = tracks[id];
    if (!info) throw new Error(`unknown track: ${id}`);
    const voice: Voice = { id, player: createPlayer(info.url), level: 0, target: 1, gap: null };
    voice.player.onended = () => {
      voice.gap = gapSeconds;
    };
    apply(voice);
    voices.push(voice);
    // Autoplay can still be refused (e.g. the gesture was too old); retry on the next unlock().
    Promise.resolve(voice.player.play()).catch(() => {
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
    setTrack(id) {
      if (id === desired) return;
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
    update(dt) {
      const step = dt / fadeSeconds;
      for (const v of voices) {
        v.level = v.target === 1 ? Math.min(1, v.level + step) : Math.max(0, v.level - step);
        apply(v);
        if (v.gap !== null && v.target === 1) {
          v.gap -= dt;
          if (v.gap <= 0) {
            v.gap = null;
            v.player.currentTime = 0;
            Promise.resolve(v.player.play()).catch(() => undefined);
          }
        }
      }
      for (const v of voices) {
        if (v.target === 0 && v.level === 0) {
          v.player.onended = null;
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
      voices: voices.map((v) => ({ id: v.id, level: v.level })),
    }),
  };
}
