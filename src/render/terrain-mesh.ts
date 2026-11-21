import * as THREE from "three";
import { CHUNK_SIZE, type Biome, type Terrain, type Tile } from "../world";
import { palette } from "./palette";

const BIOME_COLOR: Readonly<Record<Biome, number>> = {
  meadow: palette.grass,
  water: palette.water,
  snow: palette.snow,
  mountain: palette.rock,
};

const SIDE_SHADE = 0.8;

/** A dead tile: the same colour drained of saturation and darkened. */
function deadOf(c: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.12, hsl.l * 0.62);
}

/** Per-tile lightness variation so flat colour still reads as facets. */
function tileColor(tx: number, tz: number, tile: Tile): THREE.Color {
  const jitter = (((tx * 73856093) ^ (tz * 19349663)) & 7) / 7;
  const c = new THREE.Color(BIOME_COLOR[tile.biome]);
  const heightLift = tile.biome === "water" ? 0 : (tile.height - 1) * 0.04;
  return c.offsetHSL(0, 0, (jitter - 0.5) * 0.05 + heightLift);
}

export interface ChunkMesh {
  readonly mesh: THREE.Mesh;
  readonly regionIds: ReadonlySet<string>;
  /** Recolours the chunk: 0 is dead and grey, 1 is fully alive. */
  applyVitality(vitalityOf: (regionId: string) => number): void;
  dispose(): void;
}

/**
 * One mesh per chunk: a column per tile (top face, plus side faces wherever a
 * neighbour is lower). Alive and dead colours are both kept per vertex so a
 * region can be recoloured without rebuilding geometry.
 */
export function buildChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  vitalityOf: (regionId: string) => number,
): ChunkMesh {
  const positions: number[] = [];
  const alive: number[] = [];
  const dead: number[] = [];
  const vertexRegion: number[] = [];
  const regionList: string[] = [];
  const regionIndex = new Map<string, number>();

  const indexOf = (id: string): number => {
    let i = regionIndex.get(id);
    if (i === undefined) {
      i = regionList.length;
      regionList.push(id);
      regionIndex.set(id, i);
    }
    return i;
  };

  type V = readonly [number, number, number];
  const quad = (a: V, b: V, c: V, d: V, outward: V, color: THREE.Color, region: number): void => {
    // Wind the triangles so the face normal points along `outward`.
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    const flip = n[0]! * outward[0] + n[1]! * outward[1] + n[2]! * outward[2] < 0;
    const tris = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    const dc = deadOf(color);
    for (const v of tris) {
      positions.push(v[0], v[1], v[2]);
      alive.push(color.r, color.g, color.b);
      dead.push(dc.r, dc.g, dc.b);
      vertexRegion.push(region);
    }
  };

  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let tz = z0; tz < z0 + CHUNK_SIZE; tz++) {
    for (let tx = x0; tx < x0 + CHUNK_SIZE; tx++) {
      const tile = terrain.tileAt(tx, tz);
      const region = indexOf(tile.regionId);
      const top = tileColor(tx, tz, tile);
      const side = top.clone().multiplyScalar(SIDE_SHADE);
      const h = tile.height;
      quad([tx, h, tz], [tx, h, tz + 1], [tx + 1, h, tz + 1], [tx + 1, h, tz], [0, 1, 0], top, region);

      const faces = [
        { dx: 1, dz: 0, p: (lo: number): V[] => [[tx + 1, h, tz], [tx + 1, h, tz + 1], [tx + 1, lo, tz + 1], [tx + 1, lo, tz]] },
        { dx: -1, dz: 0, p: (lo: number): V[] => [[tx, h, tz], [tx, h, tz + 1], [tx, lo, tz + 1], [tx, lo, tz]] },
        { dx: 0, dz: 1, p: (lo: number): V[] => [[tx, h, tz + 1], [tx + 1, h, tz + 1], [tx + 1, lo, tz + 1], [tx, lo, tz + 1]] },
        { dx: 0, dz: -1, p: (lo: number): V[] => [[tx, h, tz], [tx + 1, h, tz], [tx + 1, lo, tz], [tx, lo, tz]] },
      ];
      for (const f of faces) {
        const lo = terrain.tileAt(tx + f.dx, tz + f.dz).height;
        if (lo >= h) continue;
        const [a, b, c, d] = f.p(lo) as [V, V, V, V];
        quad(a, b, c, d, [f.dx, 0, f.dz], side, region);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const colors = new Float32Array(alive);
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute("color", colorAttr);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const applyVitality = (v: (regionId: string) => number): void => {
    const perRegion = regionList.map((id) => Math.min(1, Math.max(0, v(id))));
    for (let i = 0; i < vertexRegion.length; i++) {
      const t = perRegion[vertexRegion[i]!]!;
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        colors[j] = dead[j]! + (alive[j]! - dead[j]!) * t;
      }
    }
    colorAttr.needsUpdate = true;
  };
  applyVitality(vitalityOf);

  return {
    mesh,
    regionIds: new Set(regionList),
    applyVitality,
    dispose: () => {
      geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  };
}
