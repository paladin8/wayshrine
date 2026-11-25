import { REGION_SIZE } from "./coords";
import { HOKORA_RADIUS, hokoraOf } from "./hokora";
import { groundOf } from "./landmark-ground";
import { LANDMARK_SOLID_RADIUS } from "./landmarks";
import { MONUMENT_CLEARING, monumentsAroundChunk, type MonumentPlan } from "./monuments";
import { propsInChunk, type PropKind } from "./props";
import { CHUNK_SIZE, type Terrain } from "./terrain-grid";

/** A solid disc on the ground plane. Everything the player cannot walk through is made of these. */
export interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

export interface Obstacles {
  /** Obstacles whose discs come within `radius` of a point. */
  near(x: number, z: number, radius: number): Obstacle[];
}

/**
 * Collision radius per prop kind, before the prop's own scale. Low plants are absent:
 * they can be walked over. The radii cover trunks and bases, not crowns, so the player
 * can pass under foliage and between trees.
 */
const PROP_RADIUS: Partial<Record<PropKind, number>> = {
  tree: 0.22,
  cherry: 0.24,
  farmhouse: 2.0,
  "city-building": 2.55,
  pine: 0.25,
  rock: 0.32,
  crag: 0.5,
  lantern: 0.2,
};

/** The two pillars of a shrine's torii, either side of its centre; the gap between them stays open. */
export const SHRINE_PILLAR_OFFSET = 0.9;
const SHRINE_PILLAR_RADIUS = 0.22;
const MONUMENT_RADIUS = 0.65;
const MAX_RADIUS = LANDMARK_SOLID_RADIUS;

/**
 * Collision for a world, built lazily a chunk at a time and cached. Obstacles are a pure function of
 * the seed and the monument plan, like the scenery they come from, and they are derived from the very
 * props that are drawn so nothing is solid that is not visible, or the reverse.
 */
export function createObstacles(terrain: Terrain, monuments: MonumentPlan): Obstacles {
  const world = terrain.world;
  const cache = new Map<string, Obstacle[]>();

  function inChunk(cx: number, cz: number): Obstacle[] {
    const key = `${cx},${cz}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const nearby = monumentsAroundChunk(monuments, cx, cz);
    const clearings = nearby.map((m) => ({ x: m.x, z: m.z, radius: MONUMENT_CLEARING }));
    const list: Obstacle[] = [];
    for (const p of propsInChunk(terrain, cx, cz, clearings)) {
      const r = PROP_RADIUS[p.kind];
      if (r) list.push({ x: p.x, z: p.z, r: r * p.scale });
    }
    const inside = (x: number, z: number): boolean =>
      Math.floor(x / CHUNK_SIZE) === cx && Math.floor(z / CHUNK_SIZE) === cz;
    for (const m of nearby) if (inside(m.x, m.z)) list.push({ x: m.x, z: m.z, r: MONUMENT_RADIUS });
    const rxMin = Math.floor((cx * CHUNK_SIZE) / REGION_SIZE) - 1;
    const rxMax = Math.floor(((cx + 1) * CHUNK_SIZE) / REGION_SIZE) + 1;
    const rzMin = Math.floor((cz * CHUNK_SIZE) / REGION_SIZE) - 1;
    const rzMax = Math.floor(((cz + 1) * CHUNK_SIZE) / REGION_SIZE) + 1;
    for (let rz = rzMin; rz <= rzMax; rz++) {
      for (let rx = rxMin; rx <= rxMax; rx++) {
        const region = world.region(rx, rz);
        const { shrine, landmark, biome } = region;
        if (landmark) {
          // The landmark is the shrine: no gate pillars. A crafted model brings its own solids.
          const model = groundOf(landmark.id);
          if (!model) {
            if (inside(shrine.x, shrine.z)) list.push({ x: shrine.x, z: shrine.z, r: LANDMARK_SOLID_RADIUS });
          } else {
            for (const [sx, sz, r] of model.solids) {
              if (inside(shrine.x + sx, shrine.z + sz)) list.push({ x: shrine.x + sx, z: shrine.z + sz, r });
            }
          }
          continue;
        }
        if (biome === "water") {
          // Three overlapping discs keep the boat beside the lake shrine's dock.
          for (const dx of [-0.68, 0, 0.68]) {
            if (inside(shrine.x + dx, shrine.z + 0.12)) list.push({ x: shrine.x + dx, z: shrine.z + 0.12, r: 0.91 });
          }
        } else {
          for (const dx of [-SHRINE_PILLAR_OFFSET, SHRINE_PILLAR_OFFSET]) {
            if (inside(shrine.x + dx, shrine.z)) list.push({ x: shrine.x + dx, z: shrine.z, r: SHRINE_PILLAR_RADIUS });
          }
        }
        const hokora = hokoraOf(region);
        if (hokora && inside(hokora.x, hokora.z)) list.push({ x: hokora.x, z: hokora.z, r: HOKORA_RADIUS });
      }
    }
    cache.set(key, list);
    return list;
  }

  return {
    near(x, z, radius) {
      const reach = radius + MAX_RADIUS;
      const out: Obstacle[] = [];
      const cx0 = Math.floor((x - reach) / CHUNK_SIZE);
      const cx1 = Math.floor((x + reach) / CHUNK_SIZE);
      const cz0 = Math.floor((z - reach) / CHUNK_SIZE);
      const cz1 = Math.floor((z + reach) / CHUNK_SIZE);
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          for (const o of inChunk(cx, cz)) if (Math.hypot(o.x - x, o.z - z) <= radius + o.r) out.push(o);
        }
      }
      return out;
    },
  };
}
