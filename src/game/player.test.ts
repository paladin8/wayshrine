import { describe, expect, it } from "vitest";
import {
    canTraverse,
  capabilitiesForCount,
  landmarksBeforeAct,
  neighborsOf,
  anchorOf,
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
import { PLAYER_RADIUS, PLAYER_SPEED, blockerAt, clearOfObstacles, movePlayer, reachOf, shrineInReach, startPosition } from "./player";

const none = new Set<Capability>();
const every = new Set<Capability>(["boat", "snowshoes", "climbing"]);

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
  function reachable(terrain: Terrain, caps: ReadonlySet<Capability>, from: Point, to: Point): boolean {
    const margin = 256;
    const x0 = Math.floor(Math.min(from.x, to.x)) - margin;
    const z0 = Math.floor(Math.min(from.z, to.z)) - margin;
    const w = Math.ceil(Math.abs(from.x - to.x)) + 2 * margin + 1;
    const h = Math.ceil(Math.abs(from.z - to.z)) + 2 * margin + 1;
    const seen = new Uint8Array(w * h);
    const idx = (tx: number, tz: number) => (tz - z0) * w + (tx - x0);
    const goal = idx(Math.floor(to.x), Math.floor(to.z));
    const queue: number[] = [idx(Math.floor(from.x), Math.floor(from.z))];
    seen[queue[0]!] = 1;
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i]!;
      if (cur === goal) return true;
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
    return false;
  }

  it("reaches every landmark with only the abilities held when its act begins", () => {
    for (const seed of ["tile-a", "tile-b"]) {
      const terrain = createTerrain(createWorld(seed));
      const start = startPosition(terrain);
      for (const region of terrain.world.landmarks) {
        const caps = capabilitiesForCount(landmarksBeforeAct(region.landmark!.act));
        expect(reachable(terrain, caps, start, region.site), `${seed} -> ${region.landmark!.id}`).toBe(true);
      }
    }
  }, 240_000);

  it("cannot reach a later act without its ability (gates are real here)", () => {
    // Guard on the test itself: some landmark must be out of reach with no abilities,
    // otherwise the reachability test above proves nothing.
    const terrain = createTerrain(createWorld("tile-a"));
    const start = startPosition(terrain);
    const act2 = terrain.world.landmarks.find((r) => r.landmark!.act === 2 && r.biome === "water")!;
    expect(reachable(terrain, none, start, act2.site)).toBe(false);
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

  it("is used from its anchor, not from far away", () => {
    for (const region of terrain.world.landmarks) {
      const at = anchorOf(region);
      expect(shrineInReach(terrain, at)).toBe(region);
      expect(shrineInReach(terrain, { x: at.x + reachOf(region) + 4, z: at.z })).not.toBe(region);
    }
  });

  it("can be walked to from where travel arrives, through its collision", () => {
    // Flood-fill the footprint at 0.2 resolution with the player's radius around every solid.
    for (const region of terrain.world.landmarks) {
      const start = standPoint(region);
      expect(blockerAt(terrain, every, start.x, start.z)).toBeNull();
      const free = (x: number, z: number): boolean =>
        obstacles.near(x, z, PLAYER_RADIUS).every((o) => Math.hypot(o.x - x, o.z - z) >= o.r + PLAYER_RADIUS);
      expect(free(start.x, start.z), `${region.landmark!.id} arrival`).toBe(true);
      const res = 0.2;
      const key = (x: number, z: number): string => `${Math.round(x / res)},${Math.round(z / res)}`;
      const seen = new Set([key(start.x, start.z)]);
      const stack: Point[] = [start];
      const at = anchorOf(region);
      let arrived = false;
      while (stack.length && !arrived) {
        const p = stack.pop()!;
        if (Math.hypot(p.x - at.x, p.z - at.z) <= reachOf(region)) arrived = true;
        for (const [dx, dz] of [[res, 0], [-res, 0], [0, res], [0, -res]] as const) {
          const n = { x: p.x + dx, z: p.z + dz };
          if (Math.abs(n.x - region.site.x) > 24 || Math.abs(n.z - region.site.z) > 24) continue;
          const k = key(n.x, n.z);
          if (seen.has(k) || blockerAt(terrain, every, n.x, n.z) !== null || !free(n.x, n.z)) continue;
          seen.add(k);
          stack.push(n);
        }
      }
      expect(arrived, `${region.landmark!.id} reachable on foot`).toBe(true);
    }
  }, 120_000);
});
