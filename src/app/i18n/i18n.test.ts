import { describe, expect, it } from "vitest";
import { BIOMES, CAPABILITIES, LANDMARKS } from "../../world";
import { LOCALES, detectLocale, isLocale, messagesFor, type Messages } from "./index";

/** Every string a catalog yields, including the ones produced by functions. */
function allText(m: Messages): string[] {
  return [
    ...CAPABILITIES.map((c) => m.capability[c]),
    m.farSight,
    m.gearRequirement(3, "locked"),
    m.gearRequirement(3, "unlocked"),
    ...BIOMES.map((b) => m.terrain[b]),
    ...LANDMARKS.map((l) => m.landmarkNames[l.id] ?? ""),
    m.blocked("X", "Y"),
    m.landmarksRestored(7),
    ...Object.values(m.landmarkList),
    m.promptRestore,
    m.promptSkip,
    m.compassHere,
    m.compassNearest(52),
    ...Object.values(m.map),
    m.mapNeeds("X"),
    ...Object.values(m.settings).flat(),
    m.monuments.promptRead,
    m.monuments.promptWorn,
    ...Object.values(m.monuments.kind),
    m.monuments.book,
    m.monuments.bookOpen,
    m.monuments.progress(3, 1000),
    m.monuments.empty,
    m.monuments.filterAll,
    m.monuments.close,
    m.monuments.loading,
  ];
}

describe("i18n", () => {
  it("names every landmark in every language, and the Japanese uses Japanese script", () => {
    for (const l of LANDMARKS) {
      expect(messagesFor("en").landmarkNames[l.id], l.id).toBeTruthy();
      expect(messagesFor("ja").landmarkNames[l.id], l.id).toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
    }
  });

  it("has the same number of strings in every language, none empty", () => {
    const counts = LOCALES.map((l) => allText(messagesFor(l)).length);
    expect(new Set(counts).size).toBe(1);
    for (const l of LOCALES) for (const s of allText(messagesFor(l))) expect(s.trim()).not.toBe("");
  });

  it("keeps the values that are inserted into sentences", () => {
    for (const l of LOCALES) {
      const m = messagesFor(l);
      // Lower case: English lower-cases the capability mid-sentence.
      expect(m.blocked("qq", "zz")).toContain("qq");
      expect(m.blocked("qq", "zz")).toContain("zz");
      expect(m.landmarksRestored(42)).toContain("42");
      for (const status of ["locked", "unlocked"] as const) {
        expect(m.gearRequirement(39, status)).toContain("39");
      }
      expect(m.compassNearest(123)).toContain("123");
    }
  });

  it("actually translates Japanese rather than repeating English", () => {
    const en = allText(messagesFor("en"));
    const ja = allText(messagesFor("ja"));
    const same = ja.filter((s, i) => s === en[i]);
    expect(same).toEqual([]);
    for (const s of ja) expect(s).toMatch(/[぀-ヿ一-鿿]/);
  });

  it("detects the language from the browser's preference order", () => {
    expect(detectLocale(["ja-JP", "en-US"])).toBe("ja");
    expect(detectLocale(["fr-FR", "ja"])).toBe("ja");
    expect(detectLocale(["en-GB"])).toBe("en");
    expect(detectLocale(["de", "fr"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });

  it("recognises only supported locales", () => {
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(3)).toBe(false);
  });
});
