const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createAchievementReporter, createSteamSaveFile } = require("./steam.cjs");

const appId = "987654";
const first = "76561198000000001";
const second = "76561198000000002";
const snapshot = { version: 1, entries: { "wayshrine:slots": "[]", "wayshrine:slotPosition:abc": '{"x":2,"z":3}' } };

test("reads a synced file, writes it back atomically, and keeps accounts isolated", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wayshrine-cloud-test-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const filename = path.join(home, "steam", appId, first, "journeys.json");
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(snapshot));

  const saves = createSteamSaveFile(home, appId, first);
  assert.deepEqual(saves.read(), { snapshot, importLegacy: false });
  const updated = { version: 1, entries: { "wayshrine:slots": "[]" } };
  assert.equal(saves.write(JSON.stringify(updated)), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), updated);
  assert.deepEqual(fs.readdirSync(path.dirname(filename)), ["journeys.json"]);
  assert.deepEqual(createSteamSaveFile(home, appId, second).read(), { snapshot: null, importLegacy: false });
});

test("allows legacy import on one account and preserves an invalid downloaded file", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wayshrine-cloud-test-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const saves = createSteamSaveFile(home, appId, first);
  assert.deepEqual(saves.read(), { snapshot: null, importLegacy: true });
  assert.deepEqual(createSteamSaveFile(home, appId, second).read(), { snapshot: null, importLegacy: false });
  assert.throws(() => saves.write(JSON.stringify({ version: 1, entries: { "wayshrine:settings": "{}" } })));
  saves.write(JSON.stringify(snapshot));
  const filename = path.join(home, "steam", appId, first, "journeys.json");
  fs.writeFileSync(filename, "truncated");
  assert.throws(() => saves.read());
  assert.equal(saves.write(JSON.stringify(snapshot)), false);
  assert.equal(fs.readFileSync(filename, "utf8"), "truncated");
});

test("queues only known achievements and retries a failed Steam stats store", () => {
  const calls = [];
  let active = false;
  const awards = createAchievementReporter({
    achievement: {
      isActivated: () => active,
      activate: (id) => { active = true; calls.push(id); return false; },
    },
    stats: { store: () => { calls.push("store"); return true; } },
  });
  awards.report(["FIRST_SHRINE", "FIRST_SHRINE", "UNKNOWN"]);
  assert.deepEqual(calls, ["FIRST_SHRINE"]);
  awards.flush();
  awards.report(["FIRST_SHRINE"]);
  assert.deepEqual(calls, ["FIRST_SHRINE", "store"]);
});
