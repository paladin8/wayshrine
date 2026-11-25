import * as THREE from "three";
import { CHUNK_SIZE, ginzanStream, waveOriginOf, type Terrain } from "../world";
import { biomeArt } from "./biome-art";
import { buildGinzanSurfaces, ginzanFlowAt, type GinzanStrip } from "./ginzan-water";
import { combine, meshFromData, VitalityBuilder, type MeshData, type VitalityMesh } from "./vitality-mesh";

const SIDE_SHADE = 0.8;
const fujiGrass = new THREE.Color(0x90a96a);
const cityColors = { street: 0x666a71, sidewalk: 0xb4ab9d, garden: 0x879871 };
const fieldColors = {
  bank: 0x81965a,
  paddy: 0x8fae9f,
  rice: 0x70984b,
  channel: 0x6f9faf,
};

type V = readonly [number, number, number];

/** Triangles for a quad, wound so the face normal points along `outward`. */
function quad(a: V, b: V, c: V, d: V, outward: V): number[] {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const cx = c[0] - a[0], cy = c[1] - a[1], cz = c[2] - a[2];
  const dx = d[0] - a[0], dy = d[1] - a[1], dz = d[2] - a[2];
  // A tapering wall can end in one degenerate triangle. Count both when choosing the winding.
  const normal = [
    by * cz - bz * cy + cy * dz - cz * dy,
    bz * cx - bx * cz + cz * dx - cx * dz,
    bx * cy - by * cx + cx * dy - cy * dx,
  ];
  const flip = normal[0]! * outward[0] + normal[1]! * outward[1] + normal[2]! * outward[2] < 0;
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
  return meshTerrain(terrain, terrainChunkData(terrain, cx, cz), vitalityOf);
}

/** The ground of a chunk as plain data: the ground itself plus any spring surfaces laid over it. */
export interface TerrainData {
  readonly ground: MeshData;
  readonly strips: readonly GinzanStrip[];
}

/** Makes the drawable ground from `terrainChunkData`. */
export function meshTerrain(terrain: Terrain, data: TerrainData, vitalityOf: (regionId: string) => number): VitalityMesh {
  const ground = meshFromData(data.ground, vitalityOf);
  const springs = buildGinzanSurfaces(terrain, data.strips, vitalityOf);
  return springs ? combine([ground, springs]) : ground;
}

export function terrainChunkData(terrain: Terrain, cx: number, cz: number): TerrainData {
  const builder = new VitalityBuilder((id) => waveOriginOf(terrain.world.regionById(id)));
  const art = biomeArt(terrain);
  const ginzan = ginzanStream(terrain.world);
  const strips = new Map<string, { vertices: number[]; flow: number[] }>();
  const flowAt = new Map<string, readonly number[]>();
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let tz = z0; tz < z0 + CHUNK_SIZE; tz++) {
    for (let tx = x0; tx < x0 + CHUNK_SIZE; tx++) {
      const tile = terrain.tileAt(tx, tz);
      const field = tile.fujiField;
      const top = field ? new THREE.Color(fieldColors[field]) : tile.tokyoSurface
        ? new THREE.Color(cityColors[tile.tokyoSurface])
        : art.top(tx, tz, tile, terrain.world.regionById(tile.regionId));
      if (!field && tile.fujiVerge) top.lerp(fujiGrass, tile.fujiVerge * 0.90);
      const spring = tile.ginzanSurface;
      const side = top.clone().multiplyScalar(SIDE_SHADE);
      const c = terrain.corners(tx, tz);
      const surface = quad([tx, c[0], tz], [tx, c[2], tz + 1], [tx + 1, c[3], tz + 1], [tx + 1, c[1], tz], [0, 1, 0]);
      builder.addTriangles(
        surface,
        top,
        tile.regionId,
        tile.biome === "water" || tile.biome === "sea" ? { water: tile.biome }
          : field === "channel" ? { water: "water" } : undefined,
      );

      if (ginzan && spring) {
        const strip = strips.get(tile.regionId) ?? { vertices: [], flow: [] };
        strip.vertices.push(...surface);
        for (let i = 0; i < surface.length; i += 3) {
          const x = surface[i]!, z = surface[i + 2]!;
          const key = `${x},${z}`;
          let flow = flowAt.get(key);
          if (!flow) {
            flow = ginzanFlowAt(ginzan, x, z);
            flowAt.set(key, flow);
          }
          strip.flow.push(...flow);
        }
        strips.set(tile.regionId, strip);
      }
      if (field === "rice") {
        const plants: number[] = [];
        for (const [dx, dz] of [[0.25, 0.28], [0.67, 0.59]] as const) {
          const x = tx + dx, z = tz + dz;
          const y = terrain.groundAt(x, z);
          plants.push(x - 0.09, y, z, x + 0.04, y + 0.36, z + 0.13, x + 0.08, y, z,
            x, y, z - 0.09, x - 0.14, y + 0.29, z, x, y, z + 0.075);
        }
        builder.addTriangles(plants, new THREE.Color(0x8faf5b), tile.regionId, { sway: { baseY: tile.height, height: 0.35 } });
      }

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
        const riseA = e.ph[0] - e.qh[0];
        const riseB = e.ph[1] - e.qh[1];
        if (riseA <= 0 && riseB <= 0) continue;
        let a: V = [e.a[0], e.ph[0], e.a[2]];
        let b: V = [e.b[0], e.ph[1], e.b[2]];
        let lowA: V = [e.a[0], e.qh[0], e.a[2]];
        let lowB: V = [e.b[0], e.qh[1], e.b[2]];
        if (riseA < 0 || riseB < 0) {
          // The two walls meet at the exact place their sloping edges cross.
          const t = riseA / (riseA - riseB);
          const cross: V = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ];
          if (riseA < 0) a = lowA = cross;
          else b = lowB = cross;
        }
        builder.addTriangles(
          quad(a, b, lowB, lowA, e.out),
          side,
          tile.regionId,
        );
      }
    }
  }
  return {
    ground: builder.finish()!,
    strips: [...strips].map(([id, strip]) => ({ id, vertices: new Float32Array(strip.vertices), flow: new Float32Array(strip.flow) })),
  };
}
