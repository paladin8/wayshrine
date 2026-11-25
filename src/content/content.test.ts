import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildContent, combineSources, englishOverrides, withoutExcluded } from "./build";
import type { ExclusionFile, OverrideFile, Scenery, SourceFile } from "./build";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const source = withoutExcluded(
  combineSources(
    read("content/source/japanese-texts.json") as SourceFile,
    read("content/source/landmark-haiku.json") as SourceFile,
    read("content/source/outer-rubbings.json") as SourceFile,
  ),
  read("content/excluded-texts.json") as ExclusionFile,
);
const scenery = read("content/haiku-scenery.json") as Record<string, Scenery>;
delete (scenery as Record<string, unknown>)["_about"];
const lines = read("content/haiku-lines.json") as Record<string, string[]>;
delete (lines as Record<string, unknown>)["_about"];
const overrideFile = read("content/english-overrides.json") as OverrideFile;
const overrides = englishOverrides(overrideFile, source);
const built = buildContent(source, scenery, overrides, lines);

describe("content", () => {
  it("has 1208 unique texts (1209 in the sources, one excluded)", () => {
    expect(built.texts).toHaveLength(1208);
    expect(new Set(built.texts.map((t) => t.id)).size).toBe(1208);
    expect(built.texts.some((t) => t.id === "jmdict-1242770")).toBe(false);
  });

  it("adds 200 distinct inscriptions", () => {
    const added = (read("content/source/outer-rubbings.json") as SourceFile).entries;
    expect(added).toHaveLength(200);
    const prior = source.entries.slice(0, -added.length);
    const inscriptionKey = (text: string) => text.normalize("NFKC").replace(/[\p{P}\s]/gu, "");
    const seen = new Set(prior.map((entry) => inscriptionKey(entry.japanese)));
    for (const entry of added) {
      const inscription = inscriptionKey(entry.japanese);
      expect(seen.has(inscription), entry.id).toBe(false);
      seen.add(inscription);
    }
  });

  it("generated files are up to date (run `npm run content`)", () => {
    expect(read("src/content/texts.json")).toEqual(built.texts);
    expect(read("src/content/text-index.json")).toEqual(built.index);
  });

  it("tags every haiku with scenery and a poet, and nothing else", () => {
    const haiku = built.texts.filter((t) => t.kind === "haiku");
    expect(haiku).toHaveLength(59);
    for (const h of haiku) expect(h.by?.ja).toBeTruthy();
    expect(built.index.filter((e) => e.biome).length).toBe(59);
  });

  it("links haiku only to landmarks on the list in docs/landmarks.md, at most one each", () => {
    const listed = new Set(
      [...readFileSync(new URL("../../docs/landmarks.md", import.meta.url), "utf8").matchAll(/^\| \d+ \|[^|]*\| ([a-z0-9-]+) \|/gm)].map((m) => m[1]),
    );
    expect(listed.size).toBe(66);
    const linked = built.index.flatMap((e) => (e.landmark ? [e.landmark] : []));
    expect(linked.length).toBe(9);
    for (const id of linked) expect(listed).toContain(id);
    expect(new Set(linked).size).toBe(linked.length);
  });

  it("splits every haiku into three lines that rejoin to the text", () => {
    for (const h of built.texts.filter((t) => t.kind === "haiku")) expect(h.lines?.join("")).toBe(h.ja);
  });

  it("drops spelling-variant parentheticals", () => {
    expect(built.texts.find((t) => t.id === "jmdict-2175010")?.en).toBe("love your neighbor");
  });

  it("rejects an exclusion whose Japanese no longer matches its source entry", () => {
    expect(() => withoutExcluded(source, { "jmdict-2175010": { ja: "別の文", reason: "x" } })).toThrow();
  });

  it("rejects an override whose Japanese no longer matches its source entry", () => {
    expect(() => englishOverrides({ "jmdict-2175010": { ja: "別の文", en: "x" } }, source)).toThrow();
    expect(() => englishOverrides({ nope: { ja: "x", en: "x" } }, source)).toThrow();
  });

  it("rejects overrides and scenery for unknown ids", () => {
    expect(() => buildContent(source, scenery, { nope: "x" }, lines)).toThrow();
    expect(() => buildContent(source, { ...scenery, nope: { biome: "water", season: "spring", scene: "" } }, undefined, lines)).toThrow();
  });
});

describe("landmark haiku placement", () => {
  it("puts a rubbing within one region of every landmark", async () => {
    const { monumentSpecs } = await import("./index");
    const { createWorld, createTerrain, planMonuments } = await import("../world");
    for (const seed of ["wayshrine", "cedar-path", "winter-coast", "silver-river", "fuji-rail"]) {
      const world = createWorld(seed);
      const plan = planMonuments(createTerrain(world), monumentSpecs);
      for (const { coord, landmark } of world.landmarks) {
        const nearby = plan.all.some(({ regionId }) => {
          const { rx, rz } = world.regionById(regionId).coord;
          return Math.max(Math.abs(coord.rx - rx), Math.abs(coord.rz - rz)) <= 1;
        });
        expect(nearby, `${seed}: ${landmark!.id}`).toBe(true);
      }
    }
  });

  it("stands every linked haiku in its landmark's region", async () => {
    const { monumentSpecs } = await import("./index");
    const { createWorld, createTerrain, planMonuments } = await import("../world");
    const linked = monumentSpecs.filter((s) => s.landmark);
    expect(linked).toHaveLength(9);
    for (const seed of ["wayshrine", "another"]) {
      const terrain = createTerrain(createWorld(seed));
      const plan = planMonuments(terrain, monumentSpecs);
      for (const spec of linked) {
        const region = terrain.world.landmarks.find((r) => r.landmark?.id === spec.landmark);
        expect(plan.byId(spec.id)?.regionId).toBe(region?.id);
      }
    }
  });
});

describe("landmark notebook notes", () => {
  it("has a note in both languages for every landmark, short enough to fit a page", async () => {
    const { landmarkNotes } = await import("./index");
    const { LANDMARK_SPECS } = await import("../world");
    expect(Object.keys(landmarkNotes).sort()).toEqual(LANDMARK_SPECS.map((l) => l.id).sort());
    for (const [id, note] of Object.entries(landmarkNotes)) {
      expect(note.en.length, id).toBeGreaterThan(40);
      expect(note.en.length, id).toBeLessThanOrEqual(190);
      expect(note.ja.length, id).toBeGreaterThan(15);
      expect(note.ja.length, id).toBeLessThanOrEqual(90);
    }
  });
});
