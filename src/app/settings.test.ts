import { describe, expect, it } from "vitest";
import { createSettingsStore, defaultSettings, parseSettings } from "./settings";

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
}

describe("settings", () => {
  it("defaults to everything shown, audible, and the browser's language", () => {
    expect(defaultSettings(["ja-JP"])).toMatchObject({ showMinimap: true, muted: false, language: "ja" });
    expect(defaultSettings(["fr"]).language).toBe("en");
  });

  it("falls back per field when data is missing, damaged or the wrong type", () => {
    const d = defaultSettings();
    expect(parseSettings(null)).toEqual(d);
    expect(parseSettings("nope")).toEqual(d);
    expect(parseSettings({ musicVolume: "loud", showMinimap: 1, language: "fr" })).toEqual(d);
    expect(parseSettings({ musicVolume: NaN })).toEqual(d);
    expect(parseSettings({ character: "robot" }).character).toBe("female");
    expect(parseSettings({ character: "male" }).character).toBe("male");
  });

  it("clamps volumes", () => {
    expect(parseSettings({ musicVolume: 3, sfxVolume: -1 })).toMatchObject({ musicVolume: 1, sfxVolume: 0 });
  });

  it("reads saves from before sound effects had their own setting", () => {
    expect(parseSettings({ musicVolume: 0.2, musicMuted: true })).toMatchObject({ musicVolume: 0.2, muted: true });
    expect(parseSettings({ musicVolume: 0.2, musicMuted: true, muted: false }).muted).toBe(false);
  });

  it("saves changes, reloads them, and notifies subscribers", () => {
    const storage = new MemoryStorage();
    const store = createSettingsStore(storage, ["en"]);
    const seen: boolean[] = [];
    const stop = store.subscribe((s) => seen.push(s.showMinimap));
    store.update({ showMinimap: false, language: "ja" });
    stop();
    store.update({ showMinimap: true });
    expect(seen).toEqual([false]);
    store.update({ showMinimap: false, language: "ja", sfxVolume: 0.1 });
    const again = createSettingsStore(storage, ["en"]).get();
    expect(again).toMatchObject({ showMinimap: false, language: "ja", sfxVolume: 0.1 });
  });

  it("persists a selected theme by track ID and can return to progression", () => {
    const storage = new MemoryStorage();
    const store = createSettingsStore(storage);
    store.update({ musicTrack: "snowline-walk" });
    const reloaded = createSettingsStore(storage);
    expect(reloaded.get().musicTrack).toBe("snowline-walk");
    reloaded.update({ musicTrack: null });
    expect(createSettingsStore(storage).get().musicTrack).toBeNull();
  });

  it("follows progression for older settings and unknown track IDs", () => {
    expect(parseSettings({ musicVolume: 0.3 }).musicTrack).toBeNull();
    expect(parseSettings({ musicTrack: "a-removed-track" }).musicTrack).toBeNull();
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const store = createSettingsStore(broken);
    expect(store.update({ muted: true }).muted).toBe(true);
  });
});
