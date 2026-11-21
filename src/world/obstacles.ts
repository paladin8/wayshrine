import { REGION_SIZE } from "./coords";
import { LANDMARK_SPECS, landmarkRadius } from "./landmarks";
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
  pine: 0.25,
  rock: 0.32,
  crag: 0.5,
  lantern: 0.2,
};

/** The two pillars of a shrine's torii, either side of its centre; the gap between them stays open. */
const SHRINE_PILLAR_OFFSET = 0.9;
const SHRINE_PILLAR_RADIUS = 0.22;
const MONUMENT_RADIUS = 0.65;
const MAX_RADIUS = Math.max(0.7, ...LANDMARK_SPECS.map(landmarkRadius));

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
        const { site, landmark } = world.region(rx, rz);
        if (landmark) {
          // The landmark is the shrine: one solid footprint, no gate pillars.
          if (inside(site.x, site.z)) list.push({ x: site.x, z: site.z, r: landmarkRadius(landmark) });
          continue;
        }
        for (const dx of [-SHRINE_PILLAR_OFFSET, SHRINE_PILLAR_OFFSET]) {
          if (inside(site.x + dx, site.z)) list.push({ x: site.x + dx, z: site.z, r: SHRINE_PILLAR_RADIUS });
        }
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
