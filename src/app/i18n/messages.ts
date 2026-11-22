import type { TextKind } from "../../content";
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
  /** Display names of the landmarks, by id. */
  readonly landmarkNames: Readonly<Record<string, string>>;
  readonly landmarksRestored: (count: number) => string;
  readonly promptRestore: string;
  readonly promptSkip: string;
  readonly compassHere: string;
  readonly compassNearest: (distance: number) => string;
  readonly map: { readonly expand: string; readonly close: string; readonly travel: string };
  readonly monuments: {
    readonly promptRead: string;
    /** Shown beside a monument in a region that has not been restored: the inscription cannot be read. */
    readonly promptWorn: string;
    readonly kind: Readonly<Record<TextKind, string>>;
    readonly book: string;
    readonly bookOpen: string;
    readonly progress: (found: number, total: number) => string;
    readonly empty: string;
    readonly filterAll: string;
    readonly close: string;
    readonly loading: string;
  };
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
    readonly credits: string;
    readonly creditsText: string;
  };
}

/** Each language's own name for itself: shown the same whatever the current language is. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: "English", ja: "日本語" };
