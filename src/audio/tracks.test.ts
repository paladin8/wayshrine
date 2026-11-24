import { describe, expect, it } from "vitest";
import { MUSIC_SETS, musicSetFor, nextTheme, unlockedThemes } from "./tracks";

describe("musicSetFor", () => {
  it("moves through the themes as gear is first used and Pilgrim’s Wake unlocks", () => {
    expect(musicSetFor(false, false).background).toBe("homeward-breeze");
    expect(musicSetFor(true, false).background).toBe("waves-beyond-the-headlands");
    expect(musicSetFor(true, true).background).toBe("snowline-walk");
    expect(musicSetFor(true, true, true).background).toBe("ridgewalk");
    expect(musicSetFor(true, true, true, true).background).toBe("marshwalk");
    expect(musicSetFor(true, true, true, true, true).background).toBe("lantern-trail");
    expect(musicSetFor(true, true, true, true, true, true).background).toBe("basalt-crossing");
    expect(musicSetFor(true, true, true, true, true, true, true).background).toBe("open-sea");
    expect(musicSetFor(true, true, true, true, true, true, true, true).background).toBe("road-through-sunlit-fields");
  });

  it("lets the latest first use win", () => {
    expect(musicSetFor(false, false, true)).toBe(MUSIC_SETS[3]);
    expect(musicSetFor(false, false, false, false, true)).toBe(MUSIC_SETS[5]);
    expect(musicSetFor(false, false, false, false, false, true)).toBe(MUSIC_SETS[6]);
    expect(musicSetFor(false, false, false, false, false, false, true)).toBe(MUSIC_SETS[7]);
    expect(musicSetFor(false, false, false, false, false, false, false, true)).toBe(MUSIC_SETS[8]);
  });
});

describe("cycling unlocked themes", () => {
  const earnedFirstThree = [true, true, true, false, false, false, false, false, false];

  it("offers only the themes that have been earned", () => {
    expect(unlockedThemes([true, false, false, false, false, false, false, false, false], 0)).toEqual([0]);
    expect(unlockedThemes(earnedFirstThree, 2)).toEqual([0, 1, 2]);
  });

  it("includes a theme that is playing before it is saved", () => {
    expect(unlockedThemes(earnedFirstThree, 3)).toEqual([0, 1, 2, 3]);
  });

  it("moves to the next unlocked theme and wraps round", () => {
    expect(nextTheme([0, 1, 2], 0)).toBe(1);
    expect(nextTheme([0, 1, 2], 2)).toBe(0);
    expect(nextTheme([0], 0)).toBe(0);
  });

  it("starts from the first when the playing theme is not in the list", () => {
    expect(nextTheme([0, 1], 5)).toBe(0);
  });
});
