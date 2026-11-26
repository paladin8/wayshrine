import { PILGRIMS_WAKE_STARS } from "../world";
import type { GameState } from "../game";
import type achievements from "../../desktop/steam-achievements.json";
import { isJourneyStorageKey, memoryStorage, type StorageLike } from "./saves";

type AchievementId = keyof typeof achievements;

export interface SteamSaveSnapshot {
  readonly version: 1;
  readonly entries: Record<string, string>;
}

export interface SteamSaveBootstrap {
  readonly snapshot: SteamSaveSnapshot | null;
  readonly importLegacy: boolean;
}

/** Reuses the journey store's existing schema so old save versions still take their normal migration path. */
export function createSteamSaveStorage(
  boot: SteamSaveBootstrap,
  write: (snapshot: string) => Promise<boolean>,
  legacy: StorageLike | null,
): { storage: StorageLike; persist: () => void; flush: () => Promise<void>; imported: boolean } {
  const storage = memoryStorage();
  let imported = false;
  if (boot.snapshot) {
    for (const [key, value] of Object.entries(boot.snapshot.entries)) storage.setItem(key, value);
  } else if (boot.importLegacy && legacy) {
    for (let i = 0; i < legacy.length; i++) {
      const key = legacy.key(i);
      if (!key || !isJourneyStorageKey(key, true)) continue;
      const value = legacy.getItem(key);
      if (value !== null) {
        storage.setItem(key, value);
        imported = true;
      }
    }
  }

  let last = boot.snapshot ? JSON.stringify(boot.snapshot) : undefined;
  let pending = Promise.resolve(true);
  let revision = 0;
  const persist = (): void => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && isJourneyStorageKey(key)) entries[key] = storage.getItem(key)!;
    }
    const snapshot = JSON.stringify({ version: 1, entries } satisfies SteamSaveSnapshot);
    if (snapshot === last) return;
    last = snapshot;
    const version = ++revision;
    pending = pending.then(() => write(snapshot)).then((written) => {
      if (!written) throw new Error("Steam save was not accepted");
      return true;
    }).catch((error) => {
      if (version === revision) last = undefined;
      console.error("Could not write Steam saves.", error);
      return false;
    });
  };
  return { storage, persist, async flush() {
    let current: Promise<boolean>;
    let written: boolean;
    do {
      current = pending;
      written = await current;
    } while (current !== pending);
    if (!written) throw new Error("Steam save failed");
  }, imported };
}

export function earnedSteamAchievements(state: GameState, landmarkCount: number, totalLandmarks: number): AchievementId[] {
  const awards: AchievementId[] = [];
  if (state.restored.size > landmarkCount) awards.push("FIRST_SHRINE");
  if (landmarkCount > 0) awards.push("FIRST_LANDMARK");
  if (state.collected.length > 0) awards.push("FIRST_RUBBING");
  if (state.collected.length >= 100) awards.push("RUBBINGS_100");
  if (state.boatLaunched) awards.push("FIRST_VOYAGE");
  if (state.snowshoesUsed) awards.push("FIRST_SNOWSHOES");
  if (state.climbingUsed) awards.push("FIRST_CLIMB");
  if (state.getaUsed) awards.push("FIRST_GETA");
  if (state.lanternUsed) awards.push("FIRST_LANTERN");
  if (state.ashSandalsUsed) awards.push("FIRST_ASH_SANDALS");
  if (state.shipLaunched) awards.push("FIRST_SAILING");
  if (landmarkCount >= PILGRIMS_WAKE_STARS) awards.push("PILGRIMS_WAKE");
  if (totalLandmarks > 0 && landmarkCount === totalLandmarks) awards.push("ALL_LANDMARKS");
  return awards;
}
