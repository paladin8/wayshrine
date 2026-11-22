import type { AwakeningKind } from "../game";
import type { CueId } from "./cues";

/** Every piece of music the game can play. */
export const TRACK_IDS = ["homeward-breeze", "waves-beyond-the-headlands"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface TrackInfo {
  readonly url: string;
}

const base = import.meta.env.BASE_URL;

export const TRACKS: Readonly<Record<TrackId, TrackInfo>> = {
  "waves-beyond-the-headlands": { url: `${base}audio/music/waves-beyond-the-headlands.mp3` },
  "homeward-breeze": { url: `${base}audio/music/homeward-breeze.mp3` },
};

/** A background theme and its harmonically matched restoration swells. */
export interface MusicSet {
  readonly label: string;
  readonly background: TrackId;
  readonly awakening: Readonly<Record<AwakeningKind, CueId>>;
}

export const MUSIC_SETS = [
  {
    label: "Breeze",
    background: "homeward-breeze",
    awakening: { shrine: "dawn-reverence", landmark: "radiant-arrival" },
  },
  {
    label: "Waves",
    background: "waves-beyond-the-headlands",
    awakening: { shrine: "dawn-reverence-a", landmark: "radiant-arrival-a" },
  },
] as const satisfies readonly MusicSet[];

/** The first voyage opens the second score across the world. */
export function musicSetFor(launched: boolean): MusicSet {
  return launched ? MUSIC_SETS[1] : MUSIC_SETS[0];
}
