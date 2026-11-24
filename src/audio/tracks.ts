/** Every piece of music the game can play. */
export const TRACK_IDS = ["homeward-breeze", "waves-beyond-the-headlands", "snowline-walk", "ridgewalk", "marshwalk", "lantern-trail", "basalt-crossing", "open-sea"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface TrackInfo {
  readonly url: string;
  /** Level relative to the other tracks, for ones mastered quieter than the rest (default 1). */
  readonly gain?: number;
}

const base = import.meta.env.BASE_URL;

export const TRACKS: Readonly<Record<TrackId, TrackInfo>> = {
  "waves-beyond-the-headlands": { url: `${base}audio/music/waves-beyond-the-headlands.mp3` },
  // Mastered quieter than the other themes; 25% up brings it level.
  "snowline-walk": { url: `${base}audio/music/snowline-walk.mp3`, gain: 1.25 },
  "ridgewalk": { url: `${base}audio/music/ridgewalk.mp3` },
  "marshwalk": { url: `${base}audio/music/marshwalk.mp3` },
  "lantern-trail": { url: `${base}audio/music/lantern-trail.mp3`, gain: 1.25 },
  "basalt-crossing": { url: `${base}audio/music/basalt-crossing.mp3`, gain: 1.25 },
  // Mastered louder than the other themes (about -12 LUFS against -16); 35% down brings it level.
  "open-sea": { url: `${base}audio/music/open-sea.mp3`, gain: 0.65 },
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
  { label: "Ridgewalk", background: "ridgewalk" },
  { label: "Marshwalk", background: "marshwalk" },
  { label: "Lantern", background: "lantern-trail" },
  { label: "Basalt", background: "basalt-crossing" },
  { label: "Open sea", background: "open-sea" },
] as const satisfies readonly MusicSet[];

/** First uses open new background themes across the world. */
export function musicSetFor(launched: boolean, snowshoesUsed: boolean, climbingUsed = false, getaUsed = false, lanternUsed = false, ashSandalsUsed = false, shipLaunched = false): MusicSet {
  if (shipLaunched) return MUSIC_SETS[7];
  if (ashSandalsUsed) return MUSIC_SETS[6];
  if (lanternUsed) return MUSIC_SETS[5];
  if (getaUsed) return MUSIC_SETS[4];
  if (climbingUsed) return MUSIC_SETS[3];
  if (snowshoesUsed) return MUSIC_SETS[2];
  return launched ? MUSIC_SETS[1] : MUSIC_SETS[0];
}
