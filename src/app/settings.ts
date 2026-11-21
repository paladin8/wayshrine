/** Player preferences that persist across sessions (separate from per-world saves). */
export interface Settings {
  readonly musicVolume: number;
  readonly musicMuted: boolean;
}

const KEY = "wayshrine:settings";
const DEFAULTS: Settings = { musicVolume: 0.5, musicMuted: false };

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        musicVolume: typeof p.musicVolume === "number" ? Math.min(1, Math.max(0, p.musicVolume)) : DEFAULTS.musicVolume,
        musicMuted: typeof p.musicMuted === "boolean" ? p.musicMuted : DEFAULTS.musicMuted,
      };
    }
  } catch {
    // Unreadable or unavailable storage: use defaults.
  }
  return DEFAULTS;
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Saving is best-effort.
  }
}
