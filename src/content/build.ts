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
  author_ja?: string;
}

export interface SourceFile {
  entries: SourceEntry[];
}

export interface Scenery {
  biome: SceneryBiome;
  season: Season;
  scene: string;
  /** The landmark the poem is about, by its id in docs/landmarks.md. */
  landmark?: string;
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
  landmark?: string;
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

/**
 * English shown in game where it differs from the source collections
 * (content/english-overrides.json). Each entry repeats the Japanese it translates.
 */
export type OverrideFile = Readonly<Record<string, { ja: string; en: string }>>;

/** The override file as an id-to-English map, checking every entry still matches its source text. */
export function englishOverrides(file: OverrideFile, source: SourceFile): Record<string, string> {
  const ja = new Map(source.entries.map((e) => [e.id, e.japanese]));
  const out: Record<string, string> = {};
  for (const [id, o] of Object.entries(file)) {
    if (id.startsWith("_")) continue;
    const text = ja.get(id);
    if (text === undefined) throw new Error(`override for unknown id: ${id}`);
    if (text !== o.ja) throw new Error(`override ${id} is for ${o.ja}, but the source now reads ${text}`);
    if (!o.en.trim()) throw new Error(`override ${id} is empty`);
    out[id] = o.en;
  }
  return out;
}

/** The main collection followed by any additions (content/source/*.json beyond the main file). */
export function combineSources(main: SourceFile, ...additions: SourceFile[]): SourceFile {
  return { entries: [main, ...additions].flatMap((f) => f.entries) };
}

export function buildContent(
  source: SourceFile,
  scenery: Readonly<Record<string, Scenery>>,
  overrides: Readonly<Record<string, string>> = {},
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
      const author = e.author?.trim();
      const authorJa = e.author_ja?.trim();
      if (!author || !authorJa) throw new Error(`haiku ${e.id} needs an author in English and Japanese`);
      entry.by = { en: author, ja: authorJa };
      const l = lines[e.id];
      if (!l || l.length !== 3 || l.join("") !== entry.ja) throw new Error(`haiku ${e.id} needs three lines that join to its text`);
      entry.lines = [l[0] as string, l[1] as string, l[2] as string];
      const s = scenery[e.id];
      if (!s) throw new Error(`haiku ${e.id} has no scenery tag`);
      const placed: IndexEntry = { id: e.id, kind, biome: s.biome, season: s.season, scene: s.scene };
      if (s.landmark) placed.landmark = s.landmark;
      index.push(placed);
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
