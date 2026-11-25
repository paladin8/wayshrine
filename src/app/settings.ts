import { TRACK_IDS, type TrackId } from "../audio";
import { detectLocale, isLocale, type Locale } from "./i18n";

/** Player preferences that persist across sessions (separate from per-world saves). */
export interface Settings {
  readonly musicVolume: number;
  /** A manually selected background theme. Null follows progression. */
  readonly musicTrack: TrackId | null;
  readonly sfxVolume: number;
  /** Silences all sound, music and effects alike. */
  readonly muted: boolean;
  readonly showMinimap: boolean;
  readonly language: Locale;
  /** Which traveller body the player has. */
  readonly character: CharacterChoice;
}

export const CHARACTER_CHOICES = ["female", "male"] as const;
export type CharacterChoice = (typeof CHARACTER_CHOICES)[number];
const isCharacter = (v: unknown): v is CharacterChoice => CHARACTER_CHOICES.includes(v as CharacterChoice);

const KEY = "wayshrine:settings";

export function defaultSettings(preferredLanguages: readonly string[] = []): Settings {
  return {
    musicVolume: 0.5,
    musicTrack: null,
    sfxVolume: 0.7,
    muted: false,
    showMinimap: true,
    language: detectLocale(preferredLanguages),
    character: "female",
  };
}

const volume = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const flag = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

/**
 * Reads saved settings from whatever was stored, tolerating missing, damaged or older data:
 * any field that is absent or the wrong type falls back to its default. Saves from before
 * sound effects had their own slider stored `musicMuted`, which now means "muted".
 */
export function parseSettings(raw: unknown, preferredLanguages: readonly string[] = []): Settings {
  const d = defaultSettings(preferredLanguages);
  if (typeof raw !== "object" || raw === null) return d;
  const p = raw as Record<string, unknown>;
  const musicTrack = TRACK_IDS.find((id) => id === p.musicTrack) ?? d.musicTrack;
  return {
    musicVolume: volume(p.musicVolume, d.musicVolume),
    musicTrack,
    sfxVolume: volume(p.sfxVolume, d.sfxVolume),
    muted: flag(p.muted, flag(p.musicMuted, d.muted)),
    showMinimap: flag(p.showMinimap, d.showMinimap),
    language: isLocale(p.language) ? p.language : d.language,
    character: isCharacter(p.character) ? p.character : d.character,
  };
}

export interface SettingsStore {
  get(): Settings;
  /** Merges a change, saves it, and tells every subscriber. */
  update(patch: Partial<Settings>): Settings;
  /** Calls `listener` after every change; returns a function that stops it. */
  subscribe(listener: (settings: Settings) => void): () => void;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function createSettingsStore(
  storage: Storage | null = safeStorage(),
  preferredLanguages: readonly string[] = [],
): SettingsStore {
  let current = defaultSettings(preferredLanguages);
  try {
    const raw = storage?.getItem(KEY);
    if (raw) current = parseSettings(JSON.parse(raw), preferredLanguages);
  } catch {
    // Unreadable or unavailable storage: use defaults.
  }
  const listeners = new Set<(settings: Settings) => void>();

  return {
    get: () => current,
    update(patch) {
      current = parseSettings({ ...current, ...patch }, preferredLanguages);
      try {
        storage?.setItem(KEY, JSON.stringify(current));
      } catch {
        // Saving is best-effort.
      }
      listeners.forEach((l) => l(current));
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
