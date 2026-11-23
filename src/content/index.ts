import type { HaikuSceneKind, MonumentSpec } from "../world";
import index from "./text-index.json";
import notes from "./landmark-notes.json";
import type { IndexEntry, TextEntry, TextKind } from "./build";

export type { SceneryBiome, Season, TextEntry, TextKind } from "./build";

const haikuScenes: Readonly<Partial<Record<string, HaikuSceneKind>>> = {
  "old pond, frog": "old-pond",
  "cherry blossoms, temple bell": "cherry-bell",
  "first snow, bridge": "snow-bridge",
  "bamboo thicket, wind": "bamboo-thicket",
  "roadside jizo, lamp, dusk": "roadside-jizo",
  "silver grass, twilight, mountains": "silver-grass",
  "great river, two houses, rain": "river-houses",
  "first snow, daffodils": "daffodil-snow",
  "rocks, cicadas": "cicada-rocks",
  "grassland, old battlefield": "summer-battlefield",
  "wheat field, foxfire, night": "foxfire-wheat",
  "lonely road, dusk": "autumn-road",
  "geese flying home": "geese-home",
  "swift river, rain": "mogami-rapids",
  "mountain, monkey, rain": "winter-macaque",
  "rapeseed field, moon and sun": "rapeseed-field",
  "village, evening": "evening-village",
  "soft falling snow": "soft-snow",
  "marsh, snipe, dusk": "marsh-snipe",
  "deer resting": "resting-deer",
  "moon, drifting clouds": "moon-viewing",
  "peony": "falling-peony",
  "winter grove, axe": "winter-grove",
};

/** What the world needs to place the monuments: small, so it ships with the main bundle. */
export const monumentSpecs: readonly MonumentSpec[] = (index as IndexEntry[]).map((e) => ({
  id: e.id,
  kind: e.kind,
  biome: e.biome,
  landmark: e.landmark,
  scene: e.scene ? haikuScenes[e.scene] : undefined,
}));

export const TEXT_COUNT = monumentSpecs.length;

let loading: Promise<ReadonlyMap<string, TextEntry>> | null = null;

/** The texts themselves, fetched the first time one is needed rather than with the game. */
export function loadTexts(): Promise<ReadonlyMap<string, TextEntry>> {
  loading ??= import("./texts.json").then((m) => new Map((m.default as TextEntry[]).map((t) => [t.id, t])));
  return loading;
}

export const TEXT_KINDS: readonly TextKind[] = ["haiku", "proverb", "fourCharacter", "idiom"];

/** The notebook's handwritten entry for each landmark, in both languages. */
export const landmarkNotes: Readonly<Record<string, { readonly en: string; readonly ja: string }>> = notes;
