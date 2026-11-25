/**
 * Builds chunk geometry off the main thread. A chunk is a pure function of the world seed and its
 * coordinates (see docs/ARCHITECTURE.md), so a worker with its own copy of the world produces exactly
 * what the main thread would, and hands back typed arrays without copying them.
 */
import { createTerrain, createWorld, planMonuments, type MonumentPlan, type MonumentSpec, type Terrain } from "../world";
import { buildChunkData, type ChunkData } from "./chunk-mesh";
import { transferablesOf } from "./vitality-mesh";

export type ChunkRequest =
  | { readonly type: "init"; readonly seed: string; readonly specs: readonly MonumentSpec[] }
  | { readonly type: "build"; readonly cx: number; readonly cz: number };

export interface ChunkResponse {
  readonly cx: number;
  readonly cz: number;
  readonly data: ChunkData;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<ChunkRequest>) => void) | null;
  postMessage(message: ChunkResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let terrain: Terrain | null = null;
let monuments: MonumentPlan | null = null;

scope.onmessage = (event) => {
  const request = event.data;
  if (request.type === "init") {
    terrain = createTerrain(createWorld(request.seed));
    monuments = planMonuments(terrain, request.specs);
    return;
  }
  if (!terrain || !monuments) return;
  const data = buildChunkData(terrain, request.cx, request.cz, monuments);
  const transfer = [data.terrain.ground, data.props, data.details].flatMap((part) => (part ? transferablesOf(part) : []));
  for (const strip of data.terrain.strips) transfer.push(strip.vertices.buffer as ArrayBuffer, strip.flow.buffer as ArrayBuffer);
  scope.postMessage({ cx: request.cx, cz: request.cz, data }, transfer);
};
