import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/** Kana, kanji and CJK punctuation: characters that should have coverage in the shipped fonts. */
const isJapanese = (c: string): boolean => {
  const cp = c.codePointAt(0) ?? 0;
  return (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xffef);
};

// Yuji Syuku omits this vertical repetition pair. The inscription font stack bundles it separately.
const BUNDLED_REPEAT_MARKS = "〳〵";

describe("Japanese font coverage", () => {
  it("covers every Japanese character in the game's text (rerun scripts/subset-yuji-syuku.py if not)", () => {
    const covered = new Set(read("scripts/yuji-syuku-subset.txt") + BUNDLED_REPEAT_MARKS);
    const text = ["src/content/texts.json", "src/content/landmark-notes.json", "src/app/i18n/ja.ts"].map(read).join("");
    const missing = [...new Set(text)].filter((c) => isJapanese(c) && !covered.has(c));
    expect(missing.join("")).toBe("");
  });
});
