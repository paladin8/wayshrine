import type { Point } from "../world";

/** One saved journey: a world seed and the progress made in it. */
export interface SaveSlot {
  readonly id: string;
  readonly seed: string;
  readonly createdAt: number;
  /** When the slot was last played or saved; the list is ordered by it. */
  readonly playedAt: number;
  /** How many landmarks have been restored, for the list. */
  readonly restored: number;
  /** Milliseconds spent in the game. Older saves have no recorded time. */
  readonly playtimeMs?: number;
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
  has(id: string): boolean;
  read(id: string): string | null;
  /** Stores the game's save data and notes how far it has got. */
  write(id: string, json: string, restored: number, onBodyWritten?: () => void): void;
  readPosition(id: string): Point | null;
  /** Remembers where the traveller stands. Cheap enough to call every second. */
  writePosition(id: string, position: Point): void;
  /** Adds foreground playtime to the latest persisted total. */
  recordPlaytime(id: string, elapsedMs: number): void;
  remove(id: string): void;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** Serialize browser mutations across tabs on the same origin. */
export function withJourneyLock<T>(action: () => T): Promise<T> {
  const locks = navigator.locks;
  return locks ? locks.request("wayshrine:journeys", () => action()) : Promise.resolve().then(action);
}

const INDEX_KEY = "wayshrine:slots";
const LAST_KEY = "wayshrine:lastSlot";
const bodyKey = (id: string): string => `wayshrine:slot:${id}`;
const positionKey = (id: string): string => `wayshrine:slotPosition:${id}`;
/** Saves from before there were slots: one per world seed. */
const LEGACY_PREFIX = "wayshrine:save:";

/** Short words (five letters at most) so a seed such as "misty-koi-482" stays easy to read, say and type. */
const ADJECTIVES = [
  "quiet", "misty", "calm", "soft", "pale", "old", "dim", "wild", "warm", "cool", "deep", "tall", "bold", "kind", "wise",
  "fair", "new", "red", "blue", "jade", "snowy", "dusty", "windy", "rainy", "sunny", "mossy", "still", "lone", "slow",
  "swift", "brisk", "crisp", "fresh", "lucky", "noble", "proud", "shy", "sweet", "gold", "amber", "ivory", "rosy", "inky",
  "lilac", "dewy", "airy", "hazy", "cozy", "keen", "mild", "pure", "rare", "true", "vast", "zen", "north", "south", "east",
  "west", "grand", "tiny", "dark",
] as const;
const NOUNS = [
  "heron", "crane", "fox", "bell", "plum", "torii", "moss", "pine", "otter", "owl", "koi", "fern", "reed", "lily", "iris",
  "lotus", "cedar", "maple", "birch", "oak", "elm", "pear", "peach", "tea", "rice", "mist", "rain", "snow", "dew", "wave",
  "tide", "reef", "isle", "cape", "bay", "dune", "hill", "peak", "ridge", "vale", "glen", "pond", "lake", "brook", "creek",
  "ford", "path", "gate", "hut", "mill", "lamp", "kite", "drum", "flute", "gong", "fan", "sage", "pearl", "moon", "sun",
  "star", "dawn", "dusk", "wind", "cloud", "frog", "deer", "hare", "wren", "lark", "dove", "swan", "duck", "crow", "finch",
  "moth", "bee", "carp", "seal", "stone", "rock", "cliff", "cove", "leaf", "bud", "vine", "bark", "ash", "sky", "ember",
  "shell", "sand", "salt", "inn", "nest", "bow", "cave", "ice", "fog", "dale",
] as const;

/** Only journey data travels with the save file. */
export function isJourneyStorageKey(key: string, includeLegacy = false): boolean {
  return key === INDEX_KEY || key === LAST_KEY || /^wayshrine:(?:slot|slotPosition):[a-z0-9]+$/.test(key)
    || (includeLegacy && key.startsWith(LEGACY_PREFIX));
}

/** A readable random world seed, such as "misty-koi-482". */
export function randomSeed(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))]!;
  const digits = String(Math.min(999, Math.floor(random() * 1000))).padStart(3, "0");
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${digits}`;
}

/** The words a random seed is drawn from. */
export const SEED_WORDS = { adjectives: ADJECTIVES, nouns: NOUNS } as const;

export function memoryStorage(): StorageLike {
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

export function browserStorage(): StorageLike | null {
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
  /** How many of a legacy save's restored regions are landmarks; the default counts them all. */
  countLandmarks: (seed: string, restoredIds: readonly string[]) => number = (_seed, ids) => ids.length,
  onChange: () => void = () => {},
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
  const saveIndex = (): void => store.setItem(INDEX_KEY, JSON.stringify(slots));
  const saveLast = (): void => {
    if (lastId) store.setItem(LAST_KEY, lastId);
  };
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
        if (Array.isArray(data.restored)) restored = countLandmarks(seed, data.restored.filter((id): id is string => typeof id === "string"));
      } catch {
        // Keep damaged saves available without treating their metadata as progress.
      }
      const slot: SaveSlot = { id: `${newId()}${i}`, seed, createdAt: base - i, playedAt: base - i, restored };
      store.setItem(bodyKey(slot.id), json);
      return slot;
    });
    // Nobody knows which was played last, so the furthest along is offered first.
    const furthest = slots.reduce<SaveSlot | null>((best, s) => (!best || s.restored > best.restored ? s : best), null);
    lastId = furthest?.id ?? null;
    saveIndex();
    saveLast();
  };

  const refresh = (): void => {
    const raw = store.getItem(INDEX_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    slots = Array.isArray(parsed) ? parsed.filter(isSlot) : [];
    lastId = store.getItem(LAST_KEY);
  };
  safely(() => {
    if (store.getItem(INDEX_KEY) === null) migrate();
    else refresh();
  });

  const sorted = (): SaveSlot[] => [...slots].sort((a, b) => b.playedAt - a.playedAt);
  const list = (): SaveSlot[] => {
    safely(refresh);
    return sorted();
  };

  /** Puts a pending slot in the list, or replaces a listed one. */
  const place = (slot: SaveSlot): void => {
    const at = slots.findIndex((s) => s.id === slot.id);
    if (at >= 0) slots[at] = slot;
    else slots.push(slot);
    saveIndex();
    pending.delete(slot.id);
  };
  const find = (id: string): SaveSlot | undefined => slots.find((s) => s.id === id) ?? pending.get(id);

  return {
    list,
    last() {
      const journeys = list();
      return journeys.find((s) => s.id === lastId) ?? journeys[0] ?? null;
    },
    create(seed) {
      const at = now();
      const slot: SaveSlot = { id: newId(), seed, createdAt: at, playedAt: at, restored: 0, playtimeMs: 0 };
      pending.set(slot.id, slot);
      return slot;
    },
    forSeed(seed) {
      return list().find((s) => s.seed === seed) ?? this.create(seed);
    },
    has(id) {
      refresh();
      return find(id) !== undefined;
    },
    read(id) {
      return store.getItem(bodyKey(id));
    },
    write(id, json, restored, onBodyWritten) {
      refresh();
      const slot = find(id);
      if (!slot) throw new Error("Journey was removed");
      store.setItem(bodyKey(id), json);
      onBodyWritten?.();
      touched.add(id);
      place({ ...slot, playedAt: now(), restored });
      lastId = id;
      saveLast();
      onChange();
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
      refresh();
      const slot = find(id);
      if (!slot) throw new Error("Journey was removed");
      store.setItem(positionKey(id), JSON.stringify({ x: Math.round(position.x * 100) / 100, z: Math.round(position.z * 100) / 100 }));
      // Playing counts as recent, but the list is only rewritten once a session, not every second.
      if (!touched.has(id) || pending.has(id)) {
        touched.add(id);
        place({ ...slot, playedAt: now() });
        lastId = id;
        saveLast();
      }
      onChange();
    },
    recordPlaytime(id, elapsedMs) {
      const elapsed = Math.floor(elapsedMs);
      if (!Number.isSafeInteger(elapsed) || elapsed <= 0) return;
      refresh();
      const slot = find(id);
      if (!slot) throw new Error("Journey was removed");
      const playedAt = touched.has(id) ? slot.playedAt : now();
      const previous = slot.playtimeMs ?? 0;
      const recorded = Number.isSafeInteger(previous) && previous > 0 ? previous : 0;
      place({ ...slot, playedAt, playtimeMs: recorded + elapsed });
      if (!touched.has(id)) {
        touched.add(id);
        lastId = id;
        saveLast();
      }
      onChange();
    },
    remove(id) {
      refresh();
      slots = slots.filter((s) => s.id !== id);
      pending.delete(id);
      touched.delete(id);
      saveIndex();
      store.removeItem(bodyKey(id));
      store.removeItem(positionKey(id));
      if (lastId === id) {
        lastId = null;
        store.removeItem(LAST_KEY);
      }
      onChange();
    },
  };
}
