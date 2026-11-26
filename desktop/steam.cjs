const fs = require("node:fs");
const path = require("node:path");
const achievements = require("./steam-achievements.json");

const SAVE_NAME = "journeys.json";
const SAVE_KEY = /^(?:wayshrine:(?:slots|lastSlot)|wayshrine:(?:slot|slotPosition):[a-z0-9]+)$/;

function parseSnapshot(json) {
  const snapshot = JSON.parse(json);
  if (snapshot?.version !== 1 || !snapshot.entries || typeof snapshot.entries !== "object" || Array.isArray(snapshot.entries)
    || !Object.entries(snapshot.entries).every(([key, value]) => SAVE_KEY.test(key) && typeof value === "string")) {
    throw new Error("Invalid Wayshrine Steam save");
  }
  return snapshot;
}

/** Steam Auto-Cloud syncs journeys.json on launch and exit. The migration marker stays local. */
function createSteamSaveFile(userData, appId, steamId) {
  if (!/^[1-9]\d*$/.test(appId) || !/^[1-9]\d{16}$/.test(steamId)) throw new Error("Invalid Steam identity");
  const root = path.join(userData, "steam", appId);
  const directory = path.join(root, steamId);
  const filename = path.join(directory, SAVE_NAME);
  const migrationClaim = path.join(root, "legacy-account");
  let loaded = false;

  return {
    read() {
      loaded = false;
      let snapshot = null;
      try {
        snapshot = parseSnapshot(fs.readFileSync(filename, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      fs.mkdirSync(root, { recursive: true });
      try {
        fs.writeFileSync(migrationClaim, steamId, { flag: "wx" });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      const importLegacy = snapshot === null && fs.readFileSync(migrationClaim, "utf8") === steamId;
      loaded = true;
      return { snapshot, importLegacy };
    },
    write(snapshot) {
      if (!loaded || typeof snapshot !== "string") return false;
      parseSnapshot(snapshot);
      fs.mkdirSync(directory, { recursive: true });
      const temporary = path.join(directory, "journeys.tmp");
      fs.writeFileSync(temporary, snapshot);
      fs.renameSync(temporary, filename);
      return true;
    },
  };
}

function createAchievementReporter(client) {
  const pending = new Set();
  const completed = new Set();
  const needsStore = new Set();
  const flush = () => {
    for (const id of pending) {
      const active = client.achievement.isActivated(id);
      const saved = active ? !needsStore.has(id) || client.stats.store() : client.achievement.activate(id);
      if (!saved) {
        needsStore.add(id);
        continue;
      }
      needsStore.delete(id);
      pending.delete(id);
      completed.add(id);
    }
  };
  return {
    report(ids) {
      if (!Array.isArray(ids)) return;
      for (const id of ids) {
        if (typeof id === "string" && Object.hasOwn(achievements, id) && !completed.has(id)) pending.add(id);
      }
      flush();
    },
    flush,
  };
}

function startSteam(userData, resources, expectedAppId) {
  const launchAppId = process.env.SteamAppId;
  const appId = process.env.WAYSHRINE_STEAM_APP_ID || launchAppId || expectedAppId;
  if (!/^[1-9]\d*$/.test(appId ?? "") || Number(appId) > 0xffffffff
    || (expectedAppId && appId !== expectedAppId) || (launchAppId && appId !== launchAppId)) return null;
  try {
    const client = require(path.join(resources, "steamworks.js")).init(Number(appId));
    if (client.utils.getAppId() !== Number(appId)) throw new Error("Unexpected Steam App ID");
    const steamId = String(client.localplayer.getSteamId().steamId64);
    const save = createSteamSaveFile(userData, appId, steamId);
    const awards = createAchievementReporter(client);
    const retry = setInterval(awards.flush, 30000);
    retry.unref();
    return { save, awards };
  } catch (error) {
    console.warn("Steamworks could not initialize. Using the standalone profile.", error.message);
    return null;
  }
}

module.exports = { createAchievementReporter, createSteamSaveFile, startSteam };
