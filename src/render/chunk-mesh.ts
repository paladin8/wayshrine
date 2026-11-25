import { monumentsAroundChunk, type MonumentPlan, type Terrain } from "../world";
import { biomeDetailData } from "./biome-details";
import { propChunkData } from "./prop-mesh";
import { meshTerrain, terrainChunkData, type TerrainData } from "./terrain-mesh";
import { combine, meshFromData, type MeshData, type VitalityMesh } from "./vitality-mesh";

/**
 * Everything drawn for one chunk, as plain typed arrays. It is a pure function of the world and the
 * chunk's coordinates, so it can be built on a worker thread and handed back without copying.
 */
export interface ChunkData {
  readonly terrain: TerrainData;
  readonly props: MeshData | null;
  readonly details: MeshData | null;
}

export function buildChunkData(terrain: Terrain, cx: number, cz: number, monuments: MonumentPlan): ChunkData {
  const nearby = monumentsAroundChunk(monuments, cx, cz);
  return {
    terrain: terrainChunkData(terrain, cx, cz),
    props: propChunkData(terrain, cx, cz, nearby),
    details: biomeDetailData(terrain, cx, cz, nearby),
  };
}

/** Turns chunk data into a drawable chunk. Cheap: it wraps the arrays and hands them to the GPU. Takes ownership of them. */
export function meshChunk(terrain: Terrain, data: ChunkData, vitalityOf: (regionId: string) => number): VitalityMesh {
  const parts = [meshTerrain(terrain, data.terrain, vitalityOf)];
  if (data.props) parts.push(meshFromData(data.props, vitalityOf));
  if (data.details) parts.push(meshFromData(data.details, vitalityOf));
  return combine(parts);
}

/** Everything drawn for one chunk: ground plus scenery. */
export function buildChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  vitalityOf: (regionId: string) => number,
  monuments: MonumentPlan,
): VitalityMesh {
  return meshChunk(terrain, buildChunkData(terrain, cx, cz, monuments), vitalityOf);
}
