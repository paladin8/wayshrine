import type { Biome } from "../world";

/** Every piece of music the game can play. */
export const TRACK_IDS = ["homeward-breeze"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface TrackInfo {
  readonly url: string;
}

const base = import.meta.env.BASE_URL;

export const TRACKS: Readonly<Record<TrackId, TrackInfo>> = {
  "homeward-breeze": { url: `${base}audio/music/homeward-breeze.mp3` },
};

/**
 * Which track suits a biome. One shared track for now; per-biome and
 * per-phase tracks plug in here (see docs/music.md).
 */
export function trackFor(_biome: Biome): TrackId {
  return "homeward-breeze";
}
