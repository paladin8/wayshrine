import type { Biome, Capability } from "../../world";

export const LOCALES = ["en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Every piece of player-facing text. Both catalogs must provide all of it (the compiler
 * and `i18n.test.ts` enforce that), so a string can never be missing in one language.
 */
export interface Messages {
  /** Names of the capabilities the player collects. */
  readonly capability: Readonly<Record<Capability, string>>;
  /** Terrain as it is named when it blocks the way ("to cross ..."). */
  readonly terrain: Readonly<Record<Biome, string>>;
  /** Hint shown when the player walks into terrain they cannot yet cross. */
  readonly blocked: (capability: string, terrain: string) => string;
  readonly shrinesRestored: (count: number) => string;
  readonly promptRestore: string;
  readonly promptSkip: string;
  readonly compassHere: string;
  readonly compassNearest: (distance: number) => string;
  readonly map: { readonly expand: string; readonly close: string };
  readonly settings: {
    readonly title: string;
    readonly open: string;
    readonly close: string;
    readonly audio: string;
    readonly music: string;
    readonly soundEffects: string;
    readonly muteAll: string;
    readonly display: string;
    readonly minimap: string;
    readonly compass: string;
    readonly language: string;
  };
}

/** Each language's own name for itself: shown the same whatever the current language is. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: "English", ja: "日本語" };
