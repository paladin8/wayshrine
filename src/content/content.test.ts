import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildContent, combineSources } from "./build";
import type { Scenery, SourceFile } from "./build";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const source = combineSources(
  read("content/source/japanese-texts.json") as SourceFile,
  read("content/source/landmark-haiku.json") as SourceFile,
);
const scenery = read("content/haiku-scenery.json") as Record<string, Scenery>;
delete (scenery as Record<string, unknown>)["_about"];
const lines = read("content/haiku-lines.json") as Record<string, string[]>;
delete (lines as Record<string, unknown>)["_about"];
const built = buildContent(source, scenery, undefined, lines);

describe("content", () => {
  it("has 1009 unique texts", () => {
    expect(built.texts).toHaveLength(1009);
    expect(new Set(built.texts.map((t) => t.id)).size).toBe(1009);
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
    expect(listed.size).toBe(50);
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

  it("rejects overrides and scenery for unknown ids", () => {
    expect(() => buildContent(source, scenery, { nope: "x" }, lines)).toThrow();
    expect(() => buildContent(source, { ...scenery, nope: { biome: "water", season: "spring", scene: "" } }, undefined, lines)).toThrow();
  });
});
