import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildContent } from "./build";
import type { Scenery, SourceFile } from "./build";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const source = read("content/source/japanese-texts.json") as SourceFile;
const scenery = read("content/haiku-scenery.json") as Record<string, Scenery>;
delete (scenery as Record<string, unknown>)["_about"];
const built = buildContent(source, scenery);

describe("content", () => {
  it("has 1000 unique texts", () => {
    expect(built.texts).toHaveLength(1000);
    expect(new Set(built.texts.map((t) => t.id)).size).toBe(1000);
  });

  it("generated files are up to date (run `npm run content`)", () => {
    expect(read("src/content/texts.json")).toEqual(built.texts);
    expect(read("src/content/text-index.json")).toEqual(built.index);
  });

  it("tags every haiku with scenery and a poet, and nothing else", () => {
    const haiku = built.texts.filter((t) => t.kind === "haiku");
    expect(haiku).toHaveLength(50);
    for (const h of haiku) expect(h.by?.ja).toBeTruthy();
    expect(built.index.filter((e) => e.biome).length).toBe(50);
  });

  it("drops spelling-variant parentheticals", () => {
    expect(built.texts.find((t) => t.id === "jmdict-2175010")?.en).toBe("love your neighbor");
  });

  it("rejects overrides and scenery for unknown ids", () => {
    expect(() => buildContent(source, scenery, { nope: "x" })).toThrow();
    expect(() => buildContent(source, { ...scenery, nope: { biome: "water", season: "spring", scene: "" } })).toThrow();
  });
});
