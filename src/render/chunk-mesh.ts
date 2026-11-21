import { monumentsAroundChunk, type MonumentPlan, type Terrain } from "../world";
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
  const props = buildPropChunk(terrain, cx, cz, vitalityOf, monumentsAroundChunk(monuments, cx, cz));
  if (props) parts.push(props);
  return combine(parts);
}
