import { describe, expect, it } from "vitest";
import { MUSIC_SETS, musicSetFor } from "./tracks";

describe("musicSetFor", () => {
  it("moves through the seven themes as gear is first used", () => {
    expect(musicSetFor(false, false).background).toBe("homeward-breeze");
    expect(musicSetFor(true, false).background).toBe("waves-beyond-the-headlands");
    expect(musicSetFor(true, true).background).toBe("snowline-walk");
    expect(musicSetFor(true, true, true).background).toBe("ridgewalk");
    expect(musicSetFor(true, true, true, true).background).toBe("marshwalk");
    expect(musicSetFor(true, true, true, true, true).background).toBe("lantern-trail");
    expect(musicSetFor(true, true, true, true, true, true).background).toBe("basalt-crossing");
  });

  it("lets the latest first use win", () => {
    expect(musicSetFor(false, false, true)).toBe(MUSIC_SETS[3]);
    expect(musicSetFor(false, false, false, false, true)).toBe(MUSIC_SETS[5]);
    expect(musicSetFor(false, false, false, false, false, true)).toBe(MUSIC_SETS[6]);
  });
});
