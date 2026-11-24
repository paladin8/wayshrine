/** Regenerates src/content/*.json from the source collection: `npm run content`. */
import { readFileSync, writeFileSync } from "node:fs";
import { buildContent, combineSources } from "../src/content/build.ts";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const scenery = read("content/haiku-scenery.json") as Record<string, never>;
delete (scenery as Record<string, unknown>)["_about"];

const lines = read("content/haiku-lines.json") as Record<string, never>;
delete (lines as Record<string, unknown>)["_about"];

const source = combineSources(
  read("content/source/japanese-texts.json") as never,
  read("content/source/landmark-haiku.json") as never,
  read("content/source/outer-rubbings.json") as never,
);
const { texts, index } = buildContent(source, scenery, undefined, lines);
const write = (path: string, value: unknown): void =>
  writeFileSync(new URL(`../${path}`, import.meta.url), JSON.stringify(value) + "\n");
write("src/content/texts.json", texts);
write("src/content/text-index.json", index);
console.log(`wrote ${texts.length} texts`);
