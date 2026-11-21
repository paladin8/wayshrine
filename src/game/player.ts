import {
  BIOME_REQUIRES,
  canTraverse,
  type Biome,
  type Capability,
  type Obstacles,
  type Point,
  type Region,
  type Terrain,
} from "../world";

export const PLAYER_SPEED = 4.5;
export const PLAYER_RADIUS = 0.3;
/** How close the player must be to a shrine to interact with it. */
export const SHRINE_REACH = 3.5;

/** Largest distance moved in one collision step, to avoid skipping thin terrain. */
const MAX_STEP = 0.25;

/** Where a new player stands: beside the first shrine, on its plateau. */
export function startPosition(terrain: Terrain): Point {
  const site = terrain.world.region(0, 0).site;
  return { x: site.x, z: site.z + 2 };
}

/** The biome that blocks standing at (x, z), or null if the spot is free. */
export function blockerAt(
  terrain: Terrain,
  caps: ReadonlySet<Capability>,
  x: number,
  z: number,
): Biome | null {
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const biome = terrain.biomeAt(Math.floor(x + dx * PLAYER_RADIUS), Math.floor(z + dz * PLAYER_RADIUS));
    if (!canTraverse(biome, caps)) return biome;
  }
  return null;
}

/**
 * Pushes a position out of every solid disc it overlaps, along the line from the disc's centre.
 * Because the push is always outward, it also frees a player who is already inside one
 * (a teleport, an old save), and moving along an obstacle's edge slides naturally.
 */
function pushOut(obstacles: Obstacles, x: number, z: number): Point {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of obstacles.near(x, z, PLAYER_RADIUS)) {
      const dx = x - o.x;
      const dz = z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + PLAYER_RADIUS;
      if (d >= min) continue;
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      x = o.x + nx * min;
      z = o.z + nz * min;
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

/** The position with any overlap with solid obstacles removed, or `pos` if that would leave allowed ground. */
export function clearOfObstacles(
  terrain: Terrain,
  caps: ReadonlySet<Capability>,
  obstacles: Obstacles,
  pos: Point,
): Point {
  const pushed = pushOut(obstacles, pos.x, pos.z);
  return blockerAt(terrain, caps, pushed.x, pushed.z) === null ? pushed : pos;
}

export interface MoveResult {
  readonly pos: Point;
  /** The biome that stopped (part of) the move, if any. */
  readonly blockedBy: Biome | null;
}

/** Moves the player along `dir` (any length; normalised here), sliding along obstacles. */
export function movePlayer(
  pos: Point,
  dir: Point,
  dt: number,
  terrain: Terrain,
  caps: ReadonlySet<Capability>,
  /** Solid things to slide around; none by default. */
  obstacles?: Obstacles,
): MoveResult {
  const len = Math.hypot(dir.x, dir.z);
  if (len === 0 || dt <= 0) return { pos, blockedBy: null };
  const total = PLAYER_SPEED * dt;
  const steps = Math.max(1, Math.ceil(total / MAX_STEP));
  const sx = (dir.x / len) * (total / steps);
  const sz = (dir.z / len) * (total / steps);
  let { x, z } = pos;
  let blockedBy: Biome | null = null;
  for (let i = 0; i < steps; i++) {
    const full = blockerAt(terrain, caps, x + sx, z + sz);
    if (full === null) {
      x += sx;
      z += sz;
    } else {
      blockedBy = full;
      if (blockerAt(terrain, caps, x + sx, z) === null) x += sx;
      else if (blockerAt(terrain, caps, x, z + sz) === null) z += sz;
    }
    if (obstacles) {
      const pushed = pushOut(obstacles, x, z);
      // Never let a push carry the player onto ground they cannot stand on.
      if (blockerAt(terrain, caps, pushed.x, pushed.z) === null) ({ x, z } = pushed);
    }
  }
  return { pos: { x, z }, blockedBy };
}

/** The shrine the player is close enough to use, if any. */
export function shrineInReach(terrain: Terrain, pos: Point): Region | null {
  const r = terrain.world.regionAt(pos.x, pos.z);
  return Math.hypot(r.site.x - pos.x, r.site.z - pos.z) <= SHRINE_REACH ? r : null;
}

/** The capability needed to cross a biome, for messages. */
export function requirementOf(biome: Biome): Capability | null {
  return BIOME_REQUIRES[biome];
}

/**
 * A spot the player may stand on: `pos` itself if it is free, else the nearest
 * free tile centre. Used when capabilities are lost (a reset, an old save) so
 * the player is never left stuck in terrain they can no longer cross.
 */
export function safePosition(terrain: Terrain, caps: ReadonlySet<Capability>, pos: Point): Point {
  if (blockerAt(terrain, caps, pos.x, pos.z) === null) return pos;
  const tx = Math.floor(pos.x);
  const tz = Math.floor(pos.z);
  for (let r = 1; r <= 64; r++) {
    let best: Point | null = null;
    let bestDist = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = tx + dx + 0.5;
        const z = tz + dz + 0.5;
        const d = Math.hypot(x - pos.x, z - pos.z);
        if (d < bestDist && blockerAt(terrain, caps, x, z) === null) {
          best = { x, z };
          bestDist = d;
        }
      }
    }
    if (best) return best;
  }
  return startPosition(terrain);
}
