/** Every piece of music the game can play. */
export const TRACK_IDS = ["homeward-breeze", "waves-beyond-the-headlands", "snowline-walk", "ridgewalk", "marshwalk", "lantern-trail", "basalt-crossing", "open-sea", "road-through-sunlit-fields", "starbound-farewell"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface TrackInfo {
  readonly url: string;
  /** Level relative to the other tracks, for ones mastered quieter than the rest (default 1). */
  readonly gain?: number;
  /** One-shot pieces set this to false. Background themes loop by default. */
  readonly loop?: boolean;
}

const base = import.meta.env.BASE_URL;

export const TRACKS: Readonly<Record<TrackId, TrackInfo>> = {
  "waves-beyond-the-headlands": { url: `${base}audio/music/waves-beyond-the-headlands.mp3` },
  "snowline-walk": { url: `${base}audio/music/snowline-walk.mp3`, gain: 1.4 },
  "ridgewalk": { url: `${base}audio/music/ridgewalk.mp3`, gain: 1.25 },
  "marshwalk": { url: `${base}audio/music/marshwalk.mp3` },
  "lantern-trail": { url: `${base}audio/music/lantern-trail.mp3`, gain: 1.4 },
  "basalt-crossing": { url: `${base}audio/music/basalt-crossing.mp3` },
  "open-sea": { url: `${base}audio/music/open-sea.mp3`, gain: 0.7 },
  "road-through-sunlit-fields": { url: `${base}audio/music/road-through-sunlit-fields.mp3`, gain: 0.8 },
  "starbound-farewell": { url: `${base}audio/music/starbound-farewell.mp3`, loop: false },
  "homeward-breeze": { url: `${base}audio/music/homeward-breeze.mp3` },
};

/** A background theme selectable in debug or through story progression. */
export interface MusicSet {
  readonly label: string;
  readonly background: TrackId;
}

export const COMPLETION_TRACK = "starbound-farewell" satisfies TrackId;

export const FINAL_MUSIC = { label: "Sunlit fields", background: "road-through-sunlit-fields" } as const satisfies MusicSet;

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
  FINAL_MUSIC,
] as const satisfies readonly MusicSet[];

/** Gear first uses and the Pilgrim’s Wake unlock open new background themes across the world. */
export function musicSetFor(launched: boolean, snowshoesUsed: boolean, climbingUsed = false, getaUsed = false, lanternUsed = false, ashSandalsUsed = false, shipLaunched = false, pilgrimsWake = false): MusicSet {
  if (pilgrimsWake) return FINAL_MUSIC;
  if (shipLaunched) return MUSIC_SETS[7];
  if (ashSandalsUsed) return MUSIC_SETS[6];
  if (lanternUsed) return MUSIC_SETS[5];
  if (getaUsed) return MUSIC_SETS[4];
  if (climbingUsed) return MUSIC_SETS[3];
  if (snowshoesUsed) return MUSIC_SETS[2];
  return launched ? MUSIC_SETS[1] : MUSIC_SETS[0];
}

/** The themes a player can cycle through: those they have earned, plus the one playing now (a gear moment may be using a theme before it is saved). `earned` is in MUSIC_SETS order. */
export function unlockedThemes(earned: readonly boolean[], playing: number): readonly number[] {
  return MUSIC_SETS.map((_, i) => i).filter((i) => earned[i] === true || i === playing);
}

/** The theme after `playing` among `unlocked`, wrapping round to the first. */
export function nextTheme(unlocked: readonly number[], playing: number): number {
  return unlocked[(unlocked.indexOf(playing) + 1) % unlocked.length] ?? 0;
}
