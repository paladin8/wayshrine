const base = import.meta.env.BASE_URL;
const MOVEMENT_GAIN = 0.32;
/** Footsteps sit a quarter below the other movement sounds. */
const FOOTSTEP_GAIN = MOVEMENT_GAIN * 0.75;

/** Sound effects, separate from background music. */
export const CUE_IDS = ["dawn-reverence", "radiant-arrival", "winter-light-restored", "basalt-restoration", "awakening-burst", "haiku-bell", "haiku-cicadas", "monument-read", "book-open", "page-flip", "box-open", "box-flip", "walk-meadow", "walk-snow", "walk-water", "walk-mountain", "walk-marsh", "row-water", "rail-roll", "shrine-travel"] as const;
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
  "basalt-restoration": { url: `${base}audio/cues/basalt-restoration.mp3` },
  "awakening-burst": { url: `${base}audio/cues/awakening-burst.mp3` },
  "haiku-bell": { url: `${base}audio/cues/haiku-bell.wav`, gain: 0.65 },
  "haiku-cicadas": { url: `${base}audio/cues/haiku-cicadas.wav`, loop: true, gain: 0.36 },
  "shrine-travel": { url: `${base}audio/cues/shrine-travel.mp3` },
  "monument-read": { url: `${base}audio/cues/monument-read.mp3` },
  "book-open": { url: `${base}audio/cues/book-open.mp3` },
  "page-flip": { url: `${base}audio/cues/page-flip.mp3` },
  "box-open": { url: `${base}audio/cues/box-open.mp3` },
  // Mastered about 1.2 dB hotter than the voyage cue; 0.5 (-6 dB) sits it well below that.
  "walk-meadow": { url: `${base}audio/cues/walk-meadow.wav`, loop: true, gain: FOOTSTEP_GAIN },
  "walk-snow": { url: `${base}audio/cues/walk-snow.wav`, loop: true, gain: FOOTSTEP_GAIN * 1.75 },
  "walk-water": { url: `${base}audio/cues/walk-water.mp3`, loop: true, gain: FOOTSTEP_GAIN * 3 },
  "walk-mountain": { url: `${base}audio/cues/walk-mountain.wav`, loop: true, gain: FOOTSTEP_GAIN },
  "walk-marsh": { url: `${base}audio/cues/walk-marsh.wav`, loop: true, gain: FOOTSTEP_GAIN },
  "rail-roll": { url: `${base}audio/cues/rail-roll.wav`, loop: true, gain: 0.4 },
  "row-water": { url: `${base}audio/cues/row-water.wav`, loop: true, gain: MOVEMENT_GAIN * 0.7 },
  "box-flip": { url: `${base}audio/cues/box-flip.mp3` },
};
