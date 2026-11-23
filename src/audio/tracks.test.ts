import { describe, expect, it } from "vitest";
import { MUSIC_SETS, musicSetFor } from "./tracks";

describe("musicSetFor", () => {
  it("moves through the five themes as gear is first used", () => {
    expect(musicSetFor(false, false).background).toBe("homeward-breeze");
    expect(musicSetFor(true, false).background).toBe("waves-beyond-the-headlands");
    expect(musicSetFor(true, true).background).toBe("snowline-walk");
    expect(musicSetFor(true, true, true).background).toBe("ridgewalk");
    expect(musicSetFor(true, true, true, true).background).toBe("marshwalk");
  });

  it("lets the latest first use win", () => {
    expect(musicSetFor(false, false, true)).toBe(MUSIC_SETS[3]);
  });
});
