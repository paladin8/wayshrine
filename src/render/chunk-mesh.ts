import { monumentsAroundChunk, type MonumentPlan, type Terrain } from "../world";
import { buildBiomeDetails } from "./biome-details";
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
  const nearby = monumentsAroundChunk(monuments, cx, cz);
  const props = buildPropChunk(terrain, cx, cz, vitalityOf, nearby);
  if (props) parts.push(props);
  const details = buildBiomeDetails(terrain, cx, cz, vitalityOf, nearby);
  if (details) parts.push(details);
  return combine(parts);
}
