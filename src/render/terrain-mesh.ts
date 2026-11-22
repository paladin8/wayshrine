import { CHUNK_SIZE, type Terrain } from "../world";
import { biomeArt } from "./biome-art";
import { VitalityBuilder, type VitalityMesh } from "./vitality-mesh";

const SIDE_SHADE = 0.8;

type V = readonly [number, number, number];

/** Triangles for a quad, wound so the face normal points along `outward`. */
function quad(a: V, b: V, c: V, d: V, outward: V): number[] {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  const n = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ];
  const flip = n[0]! * outward[0] + n[1]! * outward[1] + n[2]! * outward[2] < 0;
  return (flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]).flat();
}

/**
 * The ground of one chunk: a column per tile (top face, plus side faces
 * wherever a neighbour is lower).
 */
export function buildTerrainChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  vitalityOf: (regionId: string) => number,
): VitalityMesh {
  const builder = new VitalityBuilder((id) => terrain.world.regionById(id).shrine);
  const art = biomeArt(terrain);
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let tz = z0; tz < z0 + CHUNK_SIZE; tz++) {
    for (let tx = x0; tx < x0 + CHUNK_SIZE; tx++) {
      const tile = terrain.tileAt(tx, tz);
      const top = art.top(tx, tz, tile, terrain.world.regionById(tile.regionId));
      const side = top.clone().multiplyScalar(SIDE_SHADE);
      const c = terrain.corners(tx, tz);
      builder.addTriangles(
        quad([tx, c[0], tz], [tx, c[2], tz + 1], [tx + 1, c[3], tz + 1], [tx + 1, c[1], tz], [0, 1, 0]),
        top,
        tile.regionId,
        tile.biome === "water" || tile.biome === "sea" ? { water: tile.biome } : undefined,
      );

      // A side face wherever this tile's edge stands above its neighbour's, down to the neighbour's edge.
      const n1 = terrain.corners(tx + 1, tz);
      const n0 = terrain.corners(tx - 1, tz);
      const m1 = terrain.corners(tx, tz + 1);
      const m0 = terrain.corners(tx, tz - 1);
      const edges: ReadonlyArray<{ out: V; a: V; b: V; ph: [number, number]; qh: [number, number] }> = [
        { out: [1, 0, 0], a: [tx + 1, 0, tz], b: [tx + 1, 0, tz + 1], ph: [c[1], c[3]], qh: [n1[0], n1[2]] },
        { out: [-1, 0, 0], a: [tx, 0, tz], b: [tx, 0, tz + 1], ph: [c[0], c[2]], qh: [n0[1], n0[3]] },
        { out: [0, 0, 1], a: [tx, 0, tz + 1], b: [tx + 1, 0, tz + 1], ph: [c[2], c[3]], qh: [m1[0], m1[1]] },
        { out: [0, 0, -1], a: [tx, 0, tz], b: [tx + 1, 0, tz], ph: [c[0], c[1]], qh: [m0[2], m0[3]] },
      ];
      for (const e of edges) {
        const lo0 = Math.min(e.ph[0], e.qh[0]);
        const lo1 = Math.min(e.ph[1], e.qh[1]);
        if (lo0 >= e.ph[0] && lo1 >= e.ph[1]) continue;
        builder.addTriangles(
          quad([e.a[0], e.ph[0], e.a[2]], [e.b[0], e.ph[1], e.b[2]], [e.b[0], lo1, e.b[2]], [e.a[0], lo0, e.a[2]], e.out),
          side,
          tile.regionId,
        );
      }
    }
  }
  return builder.build(vitalityOf);
}
