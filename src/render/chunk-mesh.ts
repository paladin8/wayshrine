import { CHUNK_SIZE, MONUMENT_CLEARING, type MonumentPlan, type Terrain } from "../world";
import { buildPropChunk } from "./prop-mesh";
import { buildTerrainChunk } from "./terrain-mesh";
import { combine, type VitalityMesh } from "./vitality-mesh";

/** Everything drawn for one chunk: ground plus scenery. */
export function buildChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  vitalityOf: (regionId: string) => number,
  monuments: MonumentPlan,
): VitalityMesh {
  const parts = [buildTerrainChunk(terrain, cx, cz, vitalityOf)];
  // Anything whose clearing could touch this chunk: within its half-diagonal plus the clearing.
  const centre = { x: (cx + 0.5) * CHUNK_SIZE, z: (cz + 0.5) * CHUNK_SIZE };
  const nearby = monuments.near(centre.x, centre.z, CHUNK_SIZE * 0.71 + MONUMENT_CLEARING);
  const props = buildPropChunk(terrain, cx, cz, vitalityOf, nearby);
  if (props) parts.push(props);
  return combine(parts);
}
