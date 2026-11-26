import { describe, expect, it } from "vitest";
import { SEED_WORDS, createSaveStore, randomSeed } from "./saves";

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
}

function clock(start = 1000) {
  let t = start;
  return () => (t += 10);
}

describe("save slots", () => {
  it("records time on old journeys and accumulates it across reloads and save writes", () => {
    const old = { id: "old", seed: "test", createdAt: 1, playedAt: 2, restored: 3 };
    const backing = storage({ "wayshrine:slots": JSON.stringify([old]), "wayshrine:slot:old": "{}" });
    const first = createSaveStore(backing, clock());
    const second = createSaveStore(backing, clock(5000));
    expect(first.last()?.playtimeMs).toBeUndefined();
    first.recordPlaytime("old", 61_250);
    first.writePosition("old", { x: 2, z: 3 });
    second.recordPlaytime("old", 800);
    first.write("old", "{}", 4);
    expect(createSaveStore(backing).last()?.playtimeMs).toBe(62_050);
    expect(first.readPosition("old")).toEqual({ x: 2, z: 3 });
  });

  it("keeps any number of journeys, newest played first, and offers the last one to continue", () => {
    const s = createSaveStore(storage(), clock());
    expect(s.list()).toEqual([]);
    expect(s.last()).toBeNull();
    const ids = Array.from({ length: 25 }, (_, i) => {
      const slot = s.create(`world-${i}`);
      s.write(slot.id, JSON.stringify({ v: 5, seed: `world-${i}`, restored: ["a"] }), i);
      return slot.id;
    });
    expect(new Set(ids).size).toBe(25);
    expect(s.list()).toHaveLength(25);
    expect(s.list()[0]!.seed).toBe("world-24");
    expect(s.last()!.id).toBe(ids[24]);
    // Playing an older one brings it back to the top.
    s.write(ids[3]!, "{}", 4);
    expect(s.list()[0]!.id).toBe(ids[3]);
    expect(s.last()!.id).toBe(ids[3]);
  });

  it("keeps the saved data and position of each slot apart, and across a reload", () => {
    const backing = storage();
    const a = createSaveStore(backing, clock());
    const one = a.create("one"), two = a.create("two");
    a.write(one.id, "ONE", 1);
    a.write(two.id, "TWO", 2);
    a.writePosition(one.id, { x: 10.123, z: -4 });
    const b = createSaveStore(backing, clock(5000));
    expect(b.list().map((s) => s.seed).sort()).toEqual(["one", "two"]);
    expect(b.read(one.id)).toBe("ONE");
    expect(b.read(two.id)).toBe("TWO");
    expect(b.readPosition(one.id)).toEqual({ x: 10.12, z: -4 });
    expect(b.readPosition(two.id)).toBeNull();
    expect(b.list().find((s) => s.id === two.id)!.restored).toBe(2);
  });

  it("does not list a new journey until something is saved to it", () => {
    const s = createSaveStore(storage(), clock());
    const slot = s.create("fresh");
    expect(s.list()).toEqual([]);
    s.writePosition(slot.id, { x: 1, z: 2 });
    expect(s.list().map((x) => x.id)).toEqual([slot.id]);
  });

  it("deletes one journey without touching the others", () => {
    const backing = storage();
    const s = createSaveStore(backing, clock());
    const a = s.create("a"), b = s.create("b");
    s.write(a.id, "A", 0);
    s.write(b.id, "B", 0);
    s.writePosition(b.id, { x: 1, z: 1 });
    s.remove(b.id);
    expect(s.list().map((x) => x.id)).toEqual([a.id]);
    expect(s.read(b.id)).toBeNull();
    expect(s.readPosition(b.id)).toBeNull();
    expect(s.last()!.id).toBe(a.id);
    expect([...backing.data.keys()].some((k) => k.includes(b.id))).toBe(false);
  });

  it("brings saves from before slots into slots, once, and leaves the old entries", () => {
    const backing = storage({
      "wayshrine:save:wayshrine": JSON.stringify({ v: 5, seed: "wayshrine", restored: ["1,1", "2,2", "3,3"] }),
      "wayshrine:save:other": JSON.stringify({ v: 5, seed: "other", restored: ["1,1"] }),
      "wayshrine:settings": "{}",
    });
    const s = createSaveStore(backing, clock());
    expect(s.list().map((x) => [x.seed, x.restored]).sort()).toEqual([["other", 1], ["wayshrine", 3]]);
    expect(s.last()!.seed).toBe("wayshrine");
    expect(s.read(s.last()!.id)).toContain("\"wayshrine\"");
    expect(backing.getItem("wayshrine:save:wayshrine")).not.toBeNull();
    // A second start does not copy them again.
    const again = createSaveStore(backing, clock(9000));
    expect(again.list()).toHaveLength(2);
  });

  it("reuses the world's slot for a seed, or makes a new one", () => {
    const s = createSaveStore(storage(), clock());
    const slot = s.create("same");
    s.write(slot.id, "x", 0);
    expect(s.forSeed("same").id).toBe(slot.id);
    expect(s.forSeed("different").id).not.toBe(slot.id);
  });

  it("works without storage, and survives damaged data", () => {
    const s = createSaveStore(null, clock());
    const slot = s.create("memory");
    s.write(slot.id, "x", 0);
    expect(s.list()).toHaveLength(1);
    const broken = createSaveStore(storage({ "wayshrine:slots": "{not json" }), clock());
    expect(broken.list()).toEqual([]);
  });

  it("keeps slots created, updated, and removed by either open store", () => {
    const backing = storage();
    const first = createSaveStore(backing, clock());
    const second = createSaveStore(backing, clock(5000));
    const a = first.create("first");
    const b = second.create("second");
    first.write(a.id, "A", 1);
    second.write(b.id, "B", 2);
    second.remove(a.id);
    expect(() => first.write(a.id, "STALE", 3)).toThrow("Journey was removed");
    first.write(b.id, "NEW", 4);
    expect(second.list().map(({ seed, restored }) => [seed, restored])).toEqual([["second", 4]]);
    expect(first.read(a.id)).toBeNull();
  });

  it("keeps the advertised landmark count when the journey body write fails", () => {
    const backing = storage();
    const saves = createSaveStore(backing, clock());
    const slot = saves.create("quota");
    saves.write(slot.id, "FIRST", 1);
    const setItem = backing.setItem;
    backing.setItem = (key, value) => {
      if (key === `wayshrine:slot:${slot.id}`) throw new Error("quota");
      setItem(key, value);
    };
    expect(() => saves.write(slot.id, "SECOND", 2)).toThrow("quota");
    expect(saves.read(slot.id)).toBe("FIRST");
    expect(saves.last()?.restored).toBe(1);
  });

  it("makes readable random seeds", () => {
    const seeds = new Set(Array.from({ length: 50 }, (_, i) => randomSeed(() => ((i * 7919) % 1000) / 1000)));
    for (const seed of seeds) expect(seed).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
    expect(seeds.size).toBeGreaterThan(10);
    expect(randomSeed(() => 0.9999999)).toMatch(/^[a-z]+-[a-z]+-999$/);
  });

  it("draws seeds from many short words", () => {
    const { adjectives, nouns } = SEED_WORDS;
    for (const list of [adjectives, nouns]) {
      expect(new Set(list).size).toBe(list.length);
      for (const word of list) expect(word).toMatch(/^[a-z]{2,5}$/);
    }
    expect(adjectives.length).toBeGreaterThanOrEqual(50);
    expect(nouns.length).toBeGreaterThanOrEqual(90);
    // Never longer than five letters twice over plus three digits and two hyphens.
    expect(randomSeed(() => 0.5).length).toBeLessThanOrEqual(15);
  });
});
