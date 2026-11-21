import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  canTraverse,
  createTerrain,
  createWorld,
  type Capability,
  type Point,
  type Terrain,
} from "../world";
import { PLAYER_SPEED, blockerAt, movePlayer, shrineInReach, startPosition } from "./player";

const none = new Set<Capability>();

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
    const barrier = world.spine[1]!;
    const key = world.spine[0]!;
    const dx = barrier.site.x - key.site.x;
    const dz = barrier.site.z - key.site.z;
    const dir = { x: dx, z: dz };
    const blocked = walk(terrain, key.site, dir, 30, none);
    expect(blocked.blockedBy).toBe(barrier.biome);
    expect(blockerAt(terrain, none, blocked.pos.x, blocked.pos.z)).toBeNull();
    expect(Math.hypot(blocked.pos.x - barrier.site.x, blocked.pos.z - barrier.site.z)).toBeGreaterThan(8);
    const seconds = Math.hypot(dx, dz) / PLAYER_SPEED;
    const crossed = walk(terrain, key.site, dir, seconds, new Set<Capability>([CAPABILITIES[0]]));
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
    const margin = 48;
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

  it("reaches each keystone shrine with only the capabilities granted so far", () => {
    for (const seed of ["tile-a", "tile-b", "tile-c"]) {
      const terrain = createTerrain(createWorld(seed));
      const spine = terrain.world.spine;
      const start = startPosition(terrain);
      CAPABILITIES.forEach((_, i) => {
        const caps = new Set<Capability>(CAPABILITIES.slice(0, i + 1));
        const keystone = spine[2 * (i + 1)]!;
        expect(reachable(terrain, caps, start, keystone.site), `${seed} -> keystone ${i + 1}`).toBe(true);
      });
    }
  }, 120_000);

  it("cannot reach the next keystone without the capability (gates are real here)", () => {
    // Informational guard on the test itself: with no capabilities the walk to
    // the second keystone must fail for the seeds we use, otherwise the
    // reachability test above proves nothing.
    const terrain = createTerrain(createWorld("tile-a"));
    const start = startPosition(terrain);
    expect(reachable(terrain, new Set(), start, terrain.world.spine[2]!.site)).toBe(false);
  }, 60_000);
});
