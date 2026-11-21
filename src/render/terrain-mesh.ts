import * as THREE from "three";
import { CHUNK_SIZE, type Biome, type Terrain, type Tile } from "../world";
import { palette } from "./palette";
import { VitalityBuilder, type VitalityMesh } from "./vitality-mesh";

const BIOME_COLOR: Readonly<Record<Biome, number>> = {
  meadow: palette.grass,
  water: palette.water,
  snow: palette.snow,
  mountain: palette.rock,
};

const SIDE_SHADE = 0.8;

/** Per-tile lightness variation so flat colour still reads as facets. */
function tileColor(tx: number, tz: number, tile: Tile): THREE.Color {
  const jitter = (((tx * 73856093) ^ (tz * 19349663)) & 7) / 7;
  const c = new THREE.Color(BIOME_COLOR[tile.biome]);
  const heightLift = tile.biome === "water" ? 0 : (tile.height - 1) * 0.04;
  return c.offsetHSL(0, 0, (jitter - 0.5) * 0.05 + heightLift);
}

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
  const builder = new VitalityBuilder((id) => terrain.world.regionById(id).site);
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let tz = z0; tz < z0 + CHUNK_SIZE; tz++) {
    for (let tx = x0; tx < x0 + CHUNK_SIZE; tx++) {
      const tile = terrain.tileAt(tx, tz);
      const top = tileColor(tx, tz, tile);
      const side = top.clone().multiplyScalar(SIDE_SHADE);
      const h = tile.height;
      builder.addTriangles(
        quad([tx, h, tz], [tx, h, tz + 1], [tx + 1, h, tz + 1], [tx + 1, h, tz], [0, 1, 0]),
        top,
        tile.regionId,
        tile.biome === "water" ? { water: true } : undefined,
      );

      const faces: ReadonlyArray<{ dx: number; dz: number; corners: (lo: number) => [V, V, V, V] }> = [
        { dx: 1, dz: 0, corners: (lo) => [[tx + 1, h, tz], [tx + 1, h, tz + 1], [tx + 1, lo, tz + 1], [tx + 1, lo, tz]] },
        { dx: -1, dz: 0, corners: (lo) => [[tx, h, tz], [tx, h, tz + 1], [tx, lo, tz + 1], [tx, lo, tz]] },
        { dx: 0, dz: 1, corners: (lo) => [[tx, h, tz + 1], [tx + 1, h, tz + 1], [tx + 1, lo, tz + 1], [tx, lo, tz + 1]] },
        { dx: 0, dz: -1, corners: (lo) => [[tx, h, tz], [tx + 1, h, tz], [tx + 1, lo, tz], [tx, lo, tz]] },
      ];
      for (const f of faces) {
        const lo = terrain.tileAt(tx + f.dx, tz + f.dz).height;
        if (lo >= h) continue;
        const [a, b, c, d] = f.corners(lo);
        builder.addTriangles(quad(a, b, c, d, [f.dx, 0, f.dz]), side, tile.regionId);
      }
    }
  }
  return builder.build(vitalityOf);
}
