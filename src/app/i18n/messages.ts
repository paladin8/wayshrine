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
  /** Pilgrim’s Wake restores dormant ordinary shrine regions as the traveller enters them. */
  readonly pilgrimsWake: string;
  readonly gearRequirement: (stars: number, status: "locked" | "unlocked") => string;
  /** Terrain as it is named when it blocks the way ("to cross ..."). */
  readonly terrain: Readonly<Record<Biome, string>>;
  /** Hint shown when the player walks into terrain they cannot yet cross. */
  readonly blocked: (capability: string, terrain: string) => string;
  /** Display names of the landmarks, by id. */
  readonly landmarkNames: Readonly<Record<string, string>>;
  readonly landmarksRestored: (count: number) => string;
  /** The music button's tooltip: which unlocked track is playing, and that a click moves to the next. */
  readonly musicTrack: (number: number, total: number) => string;
  /** The travel notebook that lists restored landmarks. */
  readonly notebook: {
    readonly title: string;
    readonly entryNumber: (number: number) => string;
    readonly empty: string;
    readonly travel: string;
    /** Debug only: marks a landmark the player has not restored yet. */
    readonly locked: string;
    readonly prev: string;
    readonly next: string;
    readonly close: string;
  };
  /** The backpack that shows the gear collected so far, and the star count of the next piece, unnamed. */
  readonly backpack: {
    readonly title: string;
    /** The name shown for the next piece of gear, which stays a mystery. */
    readonly mystery: string;
    /** Shown once every piece of gear has been found. */
    readonly complete: string;
    readonly close: string;
  };
  /** The celebration after restoring every landmark. */
  readonly completion: {
    readonly title: string;
    readonly summary: (count: number) => string;
    readonly resume: string;
  };
  readonly gearReveal: Readonly<Record<"boat" | "snowshoes" | "climbing" | "geta" | "lantern" | "ashSandals" | "ship" | "pilgrimsWake", { readonly title: string; readonly hint: string }>>;
  readonly promptRestore: string;
  readonly promptRestoreLandmark: string;
  readonly promptSkip: string;
  readonly railway: {
    readonly board: string;
    readonly dormant: string;
    readonly preparing: string;
    readonly unavailable: string;
    readonly skip: string;
  };
  readonly map: { readonly expand: string; readonly close: string; readonly travel: string; readonly zoom: string };
  /** The map legend's note beside a biome the player cannot cross yet, e.g. "needs Geta". */
  readonly mapNeeds: (gear: string) => string;
  readonly monuments: {
    readonly promptRead: string;
    /** Shown beside a monument in a region that has not been restored: the inscription cannot be read. */
    readonly promptWorn: string;
    readonly kind: Readonly<Record<TextKind, string>>;
    readonly inscription: string;
    readonly box: string;
    readonly boxOpen: string;
    readonly progress: (found: number, total: number) => string;
    readonly empty: string;
    readonly newer: string;
    readonly older: string;
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
    readonly language: string;
    readonly character: string;
    readonly female: string;
    readonly male: string;
    readonly instructions: string;
    /** A few short paragraphs. */
    readonly instructionsText: readonly string[];
    readonly returnToTitle: string;
  };
  readonly title: {
    readonly continue: string;
    /** The line under Continue: which journey it resumes. */
    readonly continueDetail: (seed: string, landmarks: number) => string;
    readonly newGame: string;
    readonly loadGame: string;
    readonly options: string;
    readonly credits: string;
    /** One entry per line; the first is the author. */
    readonly creditsLines: readonly string[];
    readonly back: string;
    readonly seedPlaceholder: string;
    readonly begin: string;
    readonly loading: string;
    readonly noSaves: string;
    readonly play: string;
    readonly delete: string;
    /** The question before a save is deleted for good. */
    readonly confirmDelete: (seed: string) => string;
    readonly deleteIt: string;
    readonly cancel: string;
    readonly saveSummary: (seed: string, landmarks: number) => string;
    readonly logoNote: string;
    /** Shown instead of the title when the 3D backdrop cannot be drawn. */
    readonly webglRequired: string;
  };
}

/** Each language's own name for itself: shown the same whatever the current language is. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: "English", ja: "日本語" };
