import type { MonumentSpec } from "../world";
import index from "./text-index.json";
import type { IndexEntry, TextEntry, TextKind } from "./build";

export type { SceneryBiome, Season, TextEntry, TextKind } from "./build";

/** What the world needs to place the monuments: small, so it ships with the main bundle. */
export const monumentSpecs: readonly MonumentSpec[] = (index as IndexEntry[]).map((e) => ({
  id: e.id,
  kind: e.kind,
  biome: e.biome,
}));

export const TEXT_COUNT = monumentSpecs.length;

let loading: Promise<ReadonlyMap<string, TextEntry>> | null = null;

/** The texts themselves, fetched the first time one is needed rather than with the game. */
export function loadTexts(): Promise<ReadonlyMap<string, TextEntry>> {
  loading ??= import("./texts.json").then((m) => new Map((m.default as TextEntry[]).map((t) => [t.id, t])));
  return loading;
}

export const TEXT_KINDS: readonly TextKind[] = ["haiku", "proverb", "fourCharacter", "idiom"];
