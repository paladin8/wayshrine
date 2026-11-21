import type { Terrain } from "../world";
import { buildPropChunk } from "./prop-mesh";
import { buildTerrainChunk } from "./terrain-mesh";
import { combine, type VitalityMesh } from "./vitality-mesh";

/** Everything drawn for one chunk: ground plus scenery. */
export function buildChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  vitalityOf: (regionId: string) => number,
): VitalityMesh {
  const parts = [buildTerrainChunk(terrain, cx, cz, vitalityOf)];
  const props = buildPropChunk(terrain, cx, cz, vitalityOf);
  if (props) parts.push(props);
  return combine(parts);
}
