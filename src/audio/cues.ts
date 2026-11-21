const base = import.meta.env.BASE_URL;

/** One-shot sounds, as opposed to the looping background music. */
export const CUE_IDS = ["dawn-reverence", "awakening-burst"] as const;
export type CueId = (typeof CUE_IDS)[number];

export interface CueInfo {
  readonly url: string;
}

export const CUES: Readonly<Record<CueId, CueInfo>> = {
  "dawn-reverence": { url: `${base}audio/cues/dawn-reverence.mp3` },
  "awakening-burst": { url: `${base}audio/cues/awakening-burst.mp3` },
};
