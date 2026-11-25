import { describe, expect, it } from "vitest";
import { createSaveStore, randomSeed } from "./saves";

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

  it("makes readable random seeds", () => {
    const seeds = new Set(Array.from({ length: 50 }, (_, i) => randomSeed(() => ((i * 7919) % 1000) / 1000)));
    for (const seed of seeds) expect(seed).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
    expect(seeds.size).toBeGreaterThan(10);
    expect(randomSeed(() => 0.9999999)).toMatch(/^[a-z]+-[a-z]+-9999$/);
  });
});
