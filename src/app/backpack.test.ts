import { describe, expect, it } from "vitest";
import { CAPABILITY_THRESHOLDS, PILGRIMS_WAKE_STARS } from "../world";
import { GEAR, backpackContents } from "./backpack";
import { GEAR_ICONS } from "./gear-icons";

describe("backpack", () => {
  it("lists every piece of gear once, in the order it is found, each with an icon", () => {
    expect(GEAR).toHaveLength(Object.keys(CAPABILITY_THRESHOLDS).length + 1);
    expect(GEAR.map((g) => g.stars)).toEqual([...GEAR.map((g) => g.stars)].sort((a, b) => a - b));
    expect(GEAR.at(-1)).toEqual({ id: "pilgrimsWake", stars: PILGRIMS_WAKE_STARS });
    for (const g of GEAR) expect(GEAR_ICONS[g.id], g.id).toContain("<svg");
  });

  it("starts empty with only the first threshold showing", () => {
    expect(backpackContents(0)).toEqual({ held: [], nextStars: GEAR[0].stars });
  });

  it("holds the gear found so far and shows just the next threshold, never which gear it is", () => {
    for (const [i, found] of GEAR.entries()) {
      const c = backpackContents(found.stars);
      expect(c.held.map((g) => g.id)).toEqual(GEAR.slice(0, i + 1).map((g) => g.id));
      expect(c.nextStars).toBe(GEAR[i + 1]?.stars ?? null);
      // The result carries no handle on the unfound gear.
      expect(JSON.stringify(c)).not.toContain(GEAR[i + 1]?.id ?? "\0");
    }
    expect(backpackContents(GEAR.at(-1)!.stars - 1).held).toHaveLength(GEAR.length - 1);
  });
});
