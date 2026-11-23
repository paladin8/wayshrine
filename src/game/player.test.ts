import { describe, expect, it } from "vitest";
import { ordinaryRegionNearLandmark } from "../test-fixtures";
import {
  CAPABILITIES,
  canTraverse,
  capabilitiesForCount,
  landmarksBeforeAct,
  neighborsOf,
  footprintHalf,
  LANDMARK_REACH_MARGIN,
  createObstacles,
  planMonuments,
  standPoint,
  createTerrain,
  createWorld,
  type Capability,
  type Obstacles,
  type Point,
  type Region,
  type Terrain,
  type World,
} from "../world";
import { PLAYER_RADIUS, PLAYER_SPEED, blockerAt, clearOfObstacles, movePlayer, SHRINE_REACH, shrineInReach, startPosition } from "./player";

const none = new Set<Capability>();
const every: ReadonlySet<Capability> = new Set(CAPABILITIES);

/** An edge-adjacent meadow and water region whose joining line stays inside the two. */
function meadowBesideWater(world: World): [Region, Region] {
  for (let rx = -12; rx <= 12; rx++) {
    for (let rz = -12; rz <= 12; rz++) {
      const a = world.region(rx, rz);
      if (a.biome !== "meadow") continue;
      for (const n of neighborsOf(a.coord)) {
        const b = world.region(n.rx, n.rz);
        if (b.biome !== "water") continue;
        let inside = true;
        for (let t = 0; t <= 24; t++) {
          const f = t / 24;
          const at = world.regionAt(a.site.x + (b.site.x - a.site.x) * f, a.site.z + (b.site.z - a.site.z) * f);
          if (at.id !== a.id && at.id !== b.id) inside = false;
        }
        if (inside) return [a, b];
      }
    }
  }
  throw new Error("no meadow beside water");
}

function walk(terrain: Terrain, from: Point, dir: Point, seconds: number, caps: ReadonlySet<Capability>) {
  let pos = from;
  let blockedBy = null as ReturnType<typeof movePlayer>["blockedBy"];
  for (let i = 0; i < seconds * 60; i++) {
    const r = movePlayer(pos, dir, 1 / 60, terrain, caps);
    pos = r.pos;
    blockedBy = r.blockedBy ?? blockedBy;
  }
  return { pos, blockedBy };
}

describe("player movement", () => {
  const terrain = createTerrain(createWorld("player"));

  it("starts free, in reach of the first shrine", () => {
    const start = startPosition(terrain);
    expect(blockerAt(terrain, none, start.x, start.z)).toBeNull();
    expect(shrineInReach(terrain, start)?.id).toBe("0,0");
  });

  it("moves freely over meadow", () => {
    const start = startPosition(terrain);
    const { pos, blockedBy } = walk(terrain, start, { x: 0, z: 1 }, 0.2, none);
    expect(blockedBy).toBeNull();
    expect(pos.z).toBeGreaterThan(start.z);
  });

  it("never ends up standing where it may not", () => {
    // Walk in many directions for a long time with no capabilities.
    const start = startPosition(terrain);
    for (let a = 0; a < 16; a++) {
      const dir = { x: Math.cos((a * Math.PI) / 8), z: Math.sin((a * Math.PI) / 8) };
      const { pos } = walk(terrain, start, dir, 20, none);
      expect(blockerAt(terrain, none, pos.x, pos.z)).toBeNull();
    }
  });

  it("is stopped by a barrier biome until the capability is held", () => {
    const world = terrain.world;
    const [key, barrier] = meadowBesideWater(world);
    const dx = barrier.site.x - key.site.x;
    const dz = barrier.site.z - key.site.z;
    const dir = { x: dx, z: dz };
    const blocked = walk(terrain, key.site, dir, 30, none);
    expect(blocked.blockedBy).toBe(barrier.biome);
    expect(blockerAt(terrain, none, blocked.pos.x, blocked.pos.z)).toBeNull();
    expect(Math.hypot(blocked.pos.x - barrier.site.x, blocked.pos.z - barrier.site.z)).toBeGreaterThan(8);
    const seconds = Math.hypot(dx, dz) / PLAYER_SPEED;
    const crossed = walk(terrain, key.site, dir, seconds, new Set<Capability>(["boat"]));
    expect(world.regionAt(crossed.pos.x, crossed.pos.z).id).toBe(barrier.id);
  });
});

/**
 * Tile-level proof of ADR 0003: a player holding only the capabilities granted
 * so far can walk, tile by tile, from the start to the next keystone shrine.
 * The region-level proof in world.test.ts cannot see narrow gaps or islets.
 */
describe("tile-level progression", () => {
  /**
   * Floods the walkable tiles from `from` and reports which of `targets` it reached. The search box
   * extends `margin` tiles past the targets, enough for the detours around patches of blocking terrain.
   */
  function reachableAmong(terrain: Terrain, caps: ReadonlySet<Capability>, from: Point, targets: Point[]): boolean[] {
    const margin = 640;
    const xs = [from.x, ...targets.map((t) => t.x)];
    const zs = [from.z, ...targets.map((t) => t.z)];
    const x0 = Math.floor(Math.min(...xs)) - margin;
    const z0 = Math.floor(Math.min(...zs)) - margin;
    const w = Math.ceil(Math.max(...xs)) - x0 + margin + 1;
    const h = Math.ceil(Math.max(...zs)) - z0 + margin + 1;
    const seen = new Uint8Array(w * h);
    const idx = (tx: number, tz: number) => (tz - z0) * w + (tx - x0);
    const goals = new Map(targets.map((t, i) => [idx(Math.floor(t.x), Math.floor(t.z)), i]));
    const found = targets.map(() => false);
    let left = goals.size;
    const queue: number[] = [idx(Math.floor(from.x), Math.floor(from.z))];
    seen[queue[0]!] = 1;
    for (let i = 0; i < queue.length && left > 0; i++) {
      const cur = queue[i]!;
      const goal = goals.get(cur);
      if (goal !== undefined && !found[goal]) {
        found[goal] = true;
        left--;
      }
      const tx = x0 + (cur % w);
      const tz = z0 + Math.floor(cur / w);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = tx + dx;
        const nz = tz + dz;
        if (nx < x0 || nz < z0 || nx >= x0 + w || nz >= z0 + h) continue;
        const n = idx(nx, nz);
        if (seen[n] || !canTraverse(terrain.biomeAt(nx, nz), caps)) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return found;
  }

  it("reaches every landmark with only the abilities held when its act begins", () => {
    for (const seed of ["tile-a", "tile-b"]) {
      const terrain = createTerrain(createWorld(seed));
      const start = startPosition(terrain);
      const acts = [...new Set(terrain.world.landmarks.map((r) => r.landmark!.act))];
      for (const act of acts) {
        const regions = terrain.world.landmarks.filter((r) => r.landmark!.act === act);
        const caps = capabilitiesForCount(landmarksBeforeAct(act));
        const ok = reachableAmong(terrain, caps, start, regions.map((r) => r.site));
        regions.forEach((r, i) => expect(ok[i], `${seed} -> ${r.landmark!.id}`).toBe(true));
      }
    }
  }, 600_000);

  it("cannot reach a later act without its ability (gates are real here)", () => {
    // Guard on the test itself: some landmark must be out of reach with no abilities,
    // otherwise the reachability test above proves nothing.
    const terrain = createTerrain(createWorld("tile-a"));
    const start = startPosition(terrain);
    const act2 = terrain.world.landmarks.find((r) => r.landmark!.act === 2 && r.biome === "water")!;
    expect(reachableAmong(terrain, none, start, [act2.site])[0]).toBe(false);
  }, 60_000);
});

describe("collision with obstacles", () => {
  const terrain = createTerrain(createWorld("collide"));
  const start = startPosition(terrain);
  const disc = (x: number, z: number, r: number): Obstacles => ({
    near: (px, pz, radius) => (Math.hypot(x - px, z - pz) <= radius + r ? [{ x, z, r }] : []),
  });

  it("is stopped by a solid disc in its way and slides around it", () => {
    const tree = disc(start.x + 1.5, start.z, 0.4);
    let pos = start;
    for (let i = 0; i < 120; i++) pos = movePlayer(pos, { x: 1, z: 0.01 }, 1 / 60, terrain, none, tree).pos;
    expect(Math.hypot(pos.x - (start.x + 1.5), pos.z - start.z)).toBeGreaterThanOrEqual(0.4 + PLAYER_RADIUS - 1e-6);
    // Pushing diagonally into it slides along its edge rather than sticking.
    let slide = { x: start.x + 1.0, z: start.z - 0.5 };
    const before = slide.z;
    for (let i = 0; i < 60; i++) slide = movePlayer(slide, { x: 1, z: 0.6 }, 1 / 60, terrain, none, tree).pos;
    expect(slide.z).toBeGreaterThan(before);
  });

  it("frees a player who starts inside an obstacle", () => {
    const rock = disc(start.x, start.z, 0.5);
    const out = clearOfObstacles(terrain, none, rock, start);
    expect(Math.hypot(out.x - start.x, out.z - start.z)).toBeGreaterThanOrEqual(0.5 + PLAYER_RADIUS - 1e-6);
  });

  it("ignores obstacles when none are given", () => {
    const { pos } = walk(terrain, start, { x: 1, z: 0 }, 0.3, none);
    expect(pos.x).toBeGreaterThan(start.x + 1);
  });
});

describe("landmark as shrine", () => {
  const terrain = createTerrain(createWorld("lm-reach"));
  const obstacles = createObstacles(terrain, planMonuments(terrain, []));

  it("covers every landmark's footprint, including corners and the approach on all sides", () => {
    for (const region of terrain.world.landmarks) {
      const { x, z } = region.shrine;
      const half = footprintHalf(region.landmark!);
      const inside = half + LANDMARK_REACH_MARGIN - 0.1;
      for (const dx of [-inside, 0, inside]) {
        for (const dz of [-inside, 0, inside]) {
          expect(shrineInReach(terrain, { x: x + dx, z: z + dz })).toBe(region);
        }
      }
      const outside = half + LANDMARK_REACH_MARGIN + 0.1;
      expect(shrineInReach(terrain, { x: x + outside, z })).toBeNull();
    }
  });

  it("allows activation from each landmark's travel arrival spot", () => {
    for (const region of terrain.world.landmarks) {
      const start = standPoint(region);
      expect(blockerAt(terrain, every, start.x, start.z)).toBeNull();
      const free = obstacles.near(start.x, start.z, PLAYER_RADIUS).every(
        (o) => Math.hypot(start.x - o.x, start.z - o.z) >= o.r + PLAYER_RADIUS,
      );
      expect(free, `${region.landmark!.id} arrival`).toBe(true);
      expect(shrineInReach(terrain, start)).toBe(region);
    }
  });

  it("allows a boat to reach and activate the lake and sea shrines from the water", () => {
    const terrain = createTerrain(createWorld("wayshrine"));
    const solids = createObstacles(terrain, planMonuments(terrain, []));
    for (const [biome, cap] of [["water", "boat"], ["sea", "ship"]] as const) {
      const region = ordinaryRegionNearLandmark(terrain.world, biome);
      const { x, z } = region.shrine;
      const start = { x, z: z + 5 };
      const caps = new Set<Capability>([cap]);
      expect(shrineInReach(terrain, start)).toBeNull();
      expect(blockerAt(terrain, none, start.x, start.z)).toBe(biome);
      const arrived = movePlayer(start, { x: 0, z: -1 }, 5 / PLAYER_SPEED, terrain, caps, solids);
      expect(arrived.blockedBy).toBeNull();
      expect(shrineInReach(terrain, arrived.pos)).toBe(region);
      expect(terrain.tileAtPoint(arrived.pos.x, arrived.pos.z).biome).toBe(biome);
      if (biome === "water") expect(arrived.pos.z).toBeGreaterThan(z + 1.2);
      else expect(arrived.pos.z).toBeCloseTo(z);
    }
  });

  it("keeps the usual activation radius for ordinary shrines", () => {
    const region = terrain.world.region(0, 0);
    const { x, z } = region.shrine;
    expect(shrineInReach(terrain, { x: x + SHRINE_REACH - 0.1, z })).toBe(region);
    expect(shrineInReach(terrain, { x: x + SHRINE_REACH + 0.1, z })).toBeNull();
  });
});
