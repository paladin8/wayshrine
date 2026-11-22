/** Every piece of music the game can play. */
export const TRACK_IDS = ["homeward-breeze", "waves-beyond-the-headlands", "snowline-walk"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface TrackInfo {
  readonly url: string;
}

const base = import.meta.env.BASE_URL;

export const TRACKS: Readonly<Record<TrackId, TrackInfo>> = {
  "waves-beyond-the-headlands": { url: `${base}audio/music/waves-beyond-the-headlands.mp3` },
  "snowline-walk": { url: `${base}audio/music/snowline-walk.mp3` },
  "homeward-breeze": { url: `${base}audio/music/homeward-breeze.mp3` },
};

/** A background theme selectable in debug or through story progression. */
export interface MusicSet {
  readonly label: string;
  readonly background: TrackId;
}

export const MUSIC_SETS = [
  {
    label: "Breeze",
    background: "homeward-breeze",
  },
  {
    label: "Waves",
    background: "waves-beyond-the-headlands",
  },
  { label: "Snowline", background: "snowline-walk" },
] as const satisfies readonly MusicSet[];

/** First uses open new background themes across the world. */
export function musicSetFor(launched: boolean, snowshoesUsed: boolean): MusicSet {
  if (snowshoesUsed) return MUSIC_SETS[2];
  return launched ? MUSIC_SETS[1] : MUSIC_SETS[0];
}
