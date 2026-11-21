/**
 * Turns the supplied collection of Japanese texts into the files the game loads.
 * Pure and dependency-free so it runs both from `npm run content` (plain Node) and
 * from the test that checks the generated files are up to date.
 */

export type TextKind = "haiku" | "proverb" | "fourCharacter" | "idiom";
export type Season = "spring" | "summer" | "autumn" | "winter" | "newyear";
export type SceneryBiome = "meadow" | "water" | "snow" | "mountain";

export interface SourceEntry {
  id: string;
  type: "haiku" | "proverb" | "four_character_idiom" | "idiom";
  japanese: string;
  english: string;
  author?: string;
}

export interface SourceFile {
  entries: SourceEntry[];
}

export interface Scenery {
  biome: SceneryBiome;
  season: Season;
  scene: string;
}

/** One text as the game shows it. */
export interface TextEntry {
  id: string;
  kind: TextKind;
  ja: string;
  en: string;
  /** Haiku only: the poem in three lines, for the vertical layout. Joined, equal to `ja`. */
  lines?: [string, string, string];
  /** Present for haiku, which are credited to their poet. */
  by?: { en: string; ja: string };
}

/** The part of a text the world needs to place its monument; small enough to ship in the main bundle. */
export interface IndexEntry {
  id: string;
  kind: TextKind;
  /** Haiku only: where the poem belongs. */
  biome?: SceneryBiome;
  season?: Season;
  scene?: string;
}

export interface Built {
  texts: TextEntry[];
  index: IndexEntry[];
}

const KIND: Record<SourceEntry["type"], TextKind> = {
  haiku: "haiku",
  proverb: "proverb",
  four_character_idiom: "fourCharacter",
  idiom: "idiom",
};

const POETS: Record<string, { en: string; ja: string }> = {
  "Matsuo Bashō": { en: "Matsuo Bashō", ja: "松尾芭蕉" },
  "Yosa Buson": { en: "Yosa Buson", ja: "与謝蕪村" },
  "Kobayashi Issa": { en: "Kobayashi Issa", ja: "小林一茶" },
};

/**
 * Parentheticals in the dictionary glosses fall into three kinds. Spelling variants and
 * grammatical slot-fillers carry no information on a monument, so they are dropped or
 * unwrapped here. Asides that explain the meaning ("(because they are poisonous)") are
 * kept as they are. Keyed by source id; everything not listed is left unchanged.
 */
export const ENGLISH_OVERRIDES: Readonly<Record<string, string>> = {
  "jmdict-2144020": "a student must never forget to honor their teacher",
  "jmdict-2175010": "love your neighbor",
  "jmdict-2761670": "one never knows what will happen",
  "jmdict-2845253": "a teetotaler doesn't know how tasty water is when waking up after having been drunk",
  "jmdict-2869699": "the more people fight, the closer they are",
  "jmdict-2870266": "those who have it (especially wealth) have it",
  "jmdict-2832638": "the lesson that one should not leave things unfinished",
  "jmdict-1156510": "hit it off with someone",
  "jmdict-1157650": "saying with one voice",
  "jmdict-1163550": "critical, touch-and-go situation",
  "jmdict-1164870": "something having its merits and demerits",
  "jmdict-1165630": "being resolved to do something",
  "jmdict-1341040": "spring, summer, autumn and winter",
  "jmdict-1378980": "having life-and-death power over someone",
  "jmdict-1383200": "shifting the responsibility for something on to someone",
  "jmdict-1385250": "diligent application to work or study",
  "jmdict-1388870": "once-in-a-lifetime opportunity",
  "jmdict-1448200": "busying oneself about something",
  "jmdict-1529720": "losing oneself in something",
  "jmdict-1536160": "treasuring something by never taking it off the premises",
  "jmdict-1005940": "unmanageable person (especially a woman)",
  "jmdict-1085240": "vanguard",
  "jmdict-1165740": "to intimidate someone",
  "jmdict-1185790": "to leave everything to someone",
  "jmdict-1186700": "to unmask someone's true nature",
  "jmdict-1267620": "book of trade secrets",
  "jmdict-1300320": "showing someone special courtesy (to persuade them to take a post)",
  "jmdict-1300610": "set of three status symbols",
  "jmdict-1327280": "to cut one's connections with someone",
};

export function buildContent(
  source: SourceFile,
  scenery: Readonly<Record<string, Scenery>>,
  overrides: Readonly<Record<string, string>> = ENGLISH_OVERRIDES,
  lines: Readonly<Record<string, readonly string[]>> = {},
): Built {
  const ids = new Set<string>();
  for (const e of source.entries) {
    if (ids.has(e.id)) throw new Error(`duplicate id: ${e.id}`);
    ids.add(e.id);
  }
  for (const id of Object.keys(overrides)) {
    if (!ids.has(id)) throw new Error(`override for unknown id: ${id}`);
  }

  const texts: TextEntry[] = [];
  const index: IndexEntry[] = [];
  for (const e of source.entries) {
    const kind = KIND[e.type];
    if (!kind) throw new Error(`unknown type: ${e.type}`);
    const en = (overrides[e.id] ?? e.english).replace(/\besp\./g, "especially").trim();
    const entry: TextEntry = { id: e.id, kind, ja: e.japanese.trim(), en };
    if (kind === "haiku") {
      const poet = e.author ? POETS[e.author] : undefined;
      if (!poet) throw new Error(`haiku ${e.id} has an unknown poet: ${String(e.author)}`);
      entry.by = poet;
      const l = lines[e.id];
      if (!l || l.length !== 3 || l.join("") !== entry.ja) throw new Error(`haiku ${e.id} needs three lines that join to its text`);
      entry.lines = [l[0] as string, l[1] as string, l[2] as string];
      const s = scenery[e.id];
      if (!s) throw new Error(`haiku ${e.id} has no scenery tag`);
      index.push({ id: e.id, kind, biome: s.biome, season: s.season, scene: s.scene });
    } else {
      index.push({ id: e.id, kind });
    }
    if (!entry.ja || !entry.en) throw new Error(`empty text: ${e.id}`);
    texts.push(entry);
  }
  for (const id of Object.keys(scenery)) {
    if (!ids.has(id)) throw new Error(`scenery for unknown id: ${id}`);
  }
  return { texts, index };
}
