const base = import.meta.env.BASE_URL;
const MOVEMENT_GAIN = 0.32;

/** Sound effects, separate from background music. */
export const CUE_IDS = ["dawn-reverence", "radiant-arrival", "winter-light-restored", "awakening-burst", "monument-read", "book-open", "page-flip", "box-open", "box-flip", "first-voyage", "first-snowshoe", "first-climb", "walk-meadow", "walk-snow", "row-water"] as const;
export type CueId = (typeof CUE_IDS)[number];

export interface CueInfo {
  readonly url: string;
  readonly loop?: boolean;
  /** Fixed multiplier on top of the sound-effects slider. */
  readonly gain?: number;
}

export const CUES: Readonly<Record<CueId, CueInfo>> = {
  "dawn-reverence": { url: `${base}audio/cues/dawn-reverence.mp3` },
  "radiant-arrival": { url: `${base}audio/cues/radiant-arrival.mp3` },
  "winter-light-restored": { url: `${base}audio/cues/winter-light-restored.mp3` },
  "awakening-burst": { url: `${base}audio/cues/awakening-burst.mp3` },
  "monument-read": { url: `${base}audio/cues/monument-read.mp3` },
  "book-open": { url: `${base}audio/cues/book-open.mp3` },
  "page-flip": { url: `${base}audio/cues/page-flip.mp3` },
  "box-open": { url: `${base}audio/cues/box-open.mp3` },
  "first-voyage": { url: `${base}audio/cues/crossing-at-dawn.mp3` },
  // Mastered about 1.2 dB hotter than the voyage cue; 0.5 (-6 dB) sits it well below that.
  "first-snowshoe": { url: `${base}audio/cues/trail-through-fresh-snow.mp3`, gain: 0.5 },
  // The music for this moment is supplied separately; until the file is added the cue is silent.
  "first-climb": { url: `${base}audio/cues/first-climb.mp3` },
  "walk-meadow": { url: `${base}audio/cues/walk-meadow.wav`, loop: true, gain: MOVEMENT_GAIN },
  "walk-snow": { url: `${base}audio/cues/walk-snow.wav`, loop: true, gain: MOVEMENT_GAIN * 1.75 },
  "row-water": { url: `${base}audio/cues/row-water.wav`, loop: true, gain: MOVEMENT_GAIN },
  "box-flip": { url: `${base}audio/cues/box-flip.mp3` },
};
