import type { Point } from "../world";

/** One saved journey: a world seed and the progress made in it. */
export interface SaveSlot {
  readonly id: string;
  readonly seed: string;
  readonly createdAt: number;
  /** When the slot was last played or saved; the list is ordered by it. */
  readonly playedAt: number;
  /** How many regions have been restored, for the list. */
  readonly restored: number;
}

export interface SaveStore {
  /** Every saved journey, most recently played first. */
  list(): SaveSlot[];
  /** The journey played last, or null if none is saved. */
  last(): SaveSlot | null;
  /** A slot for a new journey in the world `seed`. It is saved once something is written to it. */
  create(seed: string): SaveSlot;
  /** The most recently played slot of this world, or a new one. */
  forSeed(seed: string): SaveSlot;
  read(id: string): string | null;
  /** Stores the game's save data and notes how far it has got. */
  write(id: string, json: string, restored: number): void;
  readPosition(id: string): Point | null;
  /** Remembers where the traveller stands. Cheap enough to call every second. */
  writePosition(id: string, position: Point): void;
  remove(id: string): void;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const INDEX_KEY = "wayshrine:slots";
const LAST_KEY = "wayshrine:lastSlot";
const bodyKey = (id: string): string => `wayshrine:slot:${id}`;
const positionKey = (id: string): string => `wayshrine:slotPosition:${id}`;
/** Saves from before there were slots: one per world seed. */
const LEGACY_PREFIX = "wayshrine:save:";

const ADJECTIVES = [
  "quiet", "misty", "gentle", "distant", "golden", "silver", "hidden", "winding", "autumn", "still", "morning", "pale",
  "wandering", "fragrant", "northern", "southern", "frosted", "old", "bright", "sleeping",
] as const;
const NOUNS = [
  "heron", "lantern", "crane", "cedar", "maple", "fox", "stream", "bell", "plum", "torii", "willow", "moss", "pine",
  "otter", "firefly", "mountain", "bridge", "harbour", "bamboo", "shrine",
] as const;

/** A readable random world seed, such as "quiet-heron-4821". */
export function randomSeed(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))]!;
  const digits = String(Math.min(9999, Math.floor(random() * 10000))).padStart(4, "0");
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${digits}`;
}

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSlot(v: unknown): v is SaveSlot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.seed === "string" && Number.isFinite(s.createdAt) && Number.isFinite(s.playedAt) && Number.isFinite(s.restored);
}

/**
 * Saved journeys in browser storage (or memory, where storage is unavailable). Saves from before there were
 * slots, one per seed, are copied into slots the first time the store is created; the old entries stay put.
 */
export function createSaveStore(
  storage: StorageLike | null = browserStorage(),
  now: () => number = Date.now,
  random: () => number = Math.random,
): SaveStore {
  const store: StorageLike = storage ?? memoryStorage();
  let slots: SaveSlot[] = [];
  let lastId: string | null = null;
  /** Slots made this session that nothing has been written to yet. */
  const pending = new Map<string, SaveSlot>();
  const touched = new Set<string>();

  const safely = (action: () => void): void => {
    try {
      action();
    } catch {
      // Saving is best-effort.
    }
  };
  const saveIndex = (): void => safely(() => store.setItem(INDEX_KEY, JSON.stringify(slots)));
  const saveLast = (): void => safely(() => {
    if (lastId) store.setItem(LAST_KEY, lastId);
  });
  const newId = (): string => `${now().toString(36)}${Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0")}`;

  const migrate = (): void => {
    const found: { seed: string; json: string }[] = [];
    safely(() => {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (!key?.startsWith(LEGACY_PREFIX)) continue;
        const json = store.getItem(key);
        if (json) found.push({ seed: key.slice(LEGACY_PREFIX.length), json });
      }
    });
    const base = now();
    slots = found.map(({ seed, json }, i) => {
      let restored = 0;
      try {
        const data = JSON.parse(json) as { restored?: unknown };
        if (Array.isArray(data.restored)) restored = data.restored.length;
      } catch {
        // A damaged save still gets a slot; loading it falls back to a new game.
      }
      const slot: SaveSlot = { id: `${newId()}${i}`, seed, createdAt: base - i, playedAt: base - i, restored };
      safely(() => store.setItem(bodyKey(slot.id), json));
      return slot;
    });
    // Nobody knows which was played last, so the furthest along is offered first.
    const furthest = slots.reduce<SaveSlot | null>((best, s) => (!best || s.restored > best.restored ? s : best), null);
    lastId = furthest?.id ?? null;
    saveIndex();
    saveLast();
  };

  safely(() => {
    const raw = store.getItem(INDEX_KEY);
    if (raw === null) {
      migrate();
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) slots = parsed.filter(isSlot);
    lastId = store.getItem(LAST_KEY);
  });

  const sorted = (): SaveSlot[] => [...slots].sort((a, b) => b.playedAt - a.playedAt);

  /** Puts a pending slot in the list, or replaces a listed one. */
  const place = (slot: SaveSlot): void => {
    const at = slots.findIndex((s) => s.id === slot.id);
    if (at >= 0) slots[at] = slot;
    else slots.push(slot);
    pending.delete(slot.id);
    saveIndex();
  };
  const find = (id: string): SaveSlot | undefined => slots.find((s) => s.id === id) ?? pending.get(id);

  return {
    list: sorted,
    last() {
      return (lastId ? slots.find((s) => s.id === lastId) : undefined) ?? sorted()[0] ?? null;
    },
    create(seed) {
      const at = now();
      const slot: SaveSlot = { id: newId(), seed, createdAt: at, playedAt: at, restored: 0 };
      pending.set(slot.id, slot);
      lastId = slot.id;
      saveLast();
      return slot;
    },
    forSeed(seed) {
      return sorted().find((s) => s.seed === seed) ?? this.create(seed);
    },
    read(id) {
      try {
        return store.getItem(bodyKey(id));
      } catch {
        return null;
      }
    },
    write(id, json, restored) {
      const slot = find(id);
      if (!slot) return;
      safely(() => store.setItem(bodyKey(id), json));
      touched.add(id);
      place({ ...slot, playedAt: now(), restored });
      lastId = id;
      saveLast();
    },
    readPosition(id) {
      try {
        const raw = store.getItem(positionKey(id));
        const p = raw ? (JSON.parse(raw) as Partial<Point>) : null;
        return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x!, z: p.z! } : null;
      } catch {
        return null;
      }
    },
    writePosition(id, position) {
      const slot = find(id);
      if (!slot) return;
      safely(() => store.setItem(positionKey(id), JSON.stringify({ x: Math.round(position.x * 100) / 100, z: Math.round(position.z * 100) / 100 })));
      // Playing counts as recent, but the list is only rewritten once a session, not every second.
      if (!touched.has(id) || pending.has(id)) {
        touched.add(id);
        place({ ...slot, playedAt: now() });
        lastId = id;
        saveLast();
      }
    },
    remove(id) {
      slots = slots.filter((s) => s.id !== id);
      pending.delete(id);
      touched.delete(id);
      saveIndex();
      safely(() => {
        store.removeItem(bodyKey(id));
        store.removeItem(positionKey(id));
        if (lastId === id) {
          lastId = null;
          store.removeItem(LAST_KEY);
        }
      });
    },
  };
}
