import { describe, expect, it, vi } from "vitest";
import { newGame } from "../game";
import { PILGRIMS_WAKE_STARS } from "../world";
import { createSaveStore, memoryStorage } from "./saves";
import { createSteamSaveStorage, earnedSteamAchievements, type SteamSaveSnapshot } from "./steam";

describe("Steam journey storage", () => {
  it("imports a legacy journey, excludes preferences, and reloads progress and position", async () => {
    const legacy = memoryStorage();
    const body = JSON.stringify({ v: 1, seed: "paper-crane", restored: ["0,0"] });
    legacy.setItem("wayshrine:save:paper-crane", body);
    legacy.setItem("wayshrine:settings", "{}");
    const write = vi.fn(async (_: string) => true);
    const cloud = createSteamSaveStorage({ snapshot: null, importLegacy: true }, write, legacy);
    const saves = createSaveStore(cloud.storage, () => 1234, () => 0.5, undefined, cloud.persist);
    const slot = saves.last()!;
    expect(cloud.imported).toBe(true);
    expect(saves.read(slot.id)).toBe(body);
    cloud.persist();
    saves.writePosition(slot.id, { x: 2.346, z: 3.25 });
    await cloud.flush();
    const saved: SteamSaveSnapshot = JSON.parse(write.mock.lastCall![0]);
    expect(Object.keys(saved.entries)).not.toContain("wayshrine:settings");
    expect(Object.keys(saved.entries)).not.toContain("wayshrine:save:paper-crane");
    const downloaded = createSteamSaveStorage({ snapshot: saved, importLegacy: false }, write, null);
    const reloaded = createSaveStore(downloaded.storage, undefined, undefined, undefined, downloaded.persist);
    expect(reloaded.last()?.seed).toBe("paper-crane");
    expect(reloaded.read(slot.id)).toBe(body);
    expect(reloaded.readPosition(slot.id)).toEqual({ x: 2.35, z: 3.25 });
    reloaded.remove(slot.id);
    const afterDelete: SteamSaveSnapshot = JSON.parse(write.mock.lastCall![0]);
    expect(afterDelete.entries).toEqual({ "wayshrine:slots": "[]" });
  });

  it("retries a failed write of the same data", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const write = vi.fn(async (_: string) => true).mockResolvedValueOnce(false);
      const cloud = createSteamSaveStorage({ snapshot: null, importLegacy: false }, write, null);
      cloud.persist();
      await cloud.flush();
      cloud.persist();
      await cloud.flush();
      expect(write).toHaveBeenCalledTimes(2);
      expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Steam milestones", () => {
  it("distinguishes ordinary shrines, landmarks, and collected rubbings", () => {
    const state = newGame("paper-crane");
    expect(earnedSteamAchievements(state, 0, 66)).toEqual([]);
    const visited = { ...state, restored: new Set(["0,0"]), collected: ["rubbing"] };
    expect(earnedSteamAchievements(visited, 0, 66)).toEqual(["FIRST_SHRINE", "FIRST_RUBBING"]);
    expect(earnedSteamAchievements(visited, 1, 66)).toEqual(["FIRST_LANDMARK", "FIRST_RUBBING"]);
  });

  it("awards saved gear uses and the two late restoration milestones", () => {
    const state = {
      ...newGame("paper-crane"),
      collected: Array.from({ length: 100 }, (_, i) => String(i)),
      boatLaunched: true, snowshoesUsed: true, climbingUsed: true, getaUsed: true,
      lanternUsed: true, ashSandalsUsed: true, shipLaunched: true,
    };
    expect(earnedSteamAchievements(state, PILGRIMS_WAKE_STARS - 1, 66)).toEqual([
      "FIRST_LANDMARK", "FIRST_RUBBING", "RUBBINGS_100", "FIRST_VOYAGE", "FIRST_SNOWSHOES",
      "FIRST_CLIMB", "FIRST_GETA", "FIRST_LANTERN", "FIRST_ASH_SANDALS", "FIRST_SAILING",
    ]);
    expect(earnedSteamAchievements(state, PILGRIMS_WAKE_STARS, 66).at(-1)).toBe("PILGRIMS_WAKE");
    expect(earnedSteamAchievements(state, 66, 66).slice(-2)).toEqual(["PILGRIMS_WAKE", "ALL_LANDMARKS"]);
  });
});
