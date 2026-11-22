const base = import.meta.env.BASE_URL;

/** One-shot sounds, as opposed to the looping background music. */
export const CUE_IDS = ["dawn-reverence", "radiant-arrival", "awakening-burst", "monument-read", "book-open", "page-flip"] as const;
export type CueId = (typeof CUE_IDS)[number];

export interface CueInfo {
  readonly url: string;
}

export const CUES: Readonly<Record<CueId, CueInfo>> = {
  "dawn-reverence": { url: `${base}audio/cues/dawn-reverence.mp3` },
  "radiant-arrival": { url: `${base}audio/cues/radiant-arrival.mp3` },
  "awakening-burst": { url: `${base}audio/cues/awakening-burst.mp3` },
  "monument-read": { url: `${base}audio/cues/monument-read.mp3` },
  "book-open": { url: `${base}audio/cues/book-open.mp3` },
  "page-flip": { url: `${base}audio/cues/page-flip.mp3` },
};
