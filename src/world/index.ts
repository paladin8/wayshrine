export { BIOMES, BIOME_REQUIRES, CAPABILITIES, biomeRequiring, canTraverse, isWater } from "./terrain";
export type { Biome, Capability } from "./terrain";
export { REGION_REACH, REGION_SIZE, neighborsOf, parseRegionId, regionId } from "./coords";
export type { Point, RegionCoord } from "./coords";
export { createWorld } from "./world";
export type { Region, World } from "./world";
export { LANDMARK_TOTAL, greedyProgress, reachableRegions } from "./progression";
export { reachableCoords } from "./reach";
export {
  CAPABILITY_THRESHOLDS,
  FAR_SIGHT_STARS,
  HOME_RADIUS,
  LANDMARK_WINDOW,
  LANDMARK_BLEND,
  MAX_FOOTPRINT_HALF,
  LANDMARK_PLATEAU_RADIUS,
  LANDMARK_REACH_MARGIN,
  LANDMARK_SOLID_RADIUS,
  anchorOf,
  footprintHalf,
  monumentClearance,
  standPoint,
  LANDMARKS,
  LANDMARK_SPECS,
  capabilitiesForCount,
  landmarksBeforeAct,
  planLandmarks,
  ringRadius,
} from "./landmarks";
export type { Landmark, LandmarkSpec } from "./landmarks";
export { groundHeight, groundOf, surfaceHeight } from "./landmark-ground";
export type { LandmarkGround } from "./landmark-ground";
export { CHUNK_SIZE, PLATEAU_RADIUS, createTerrain, plateauBase, plateauDistance } from "./terrain-grid";
export type { Terrain, Tile } from "./terrain-grid";
export { PROP_KINDS, propsInChunk } from "./props";
export type { Prop, PropKind } from "./props";
export { MONUMENT_CLEARING, MONUMENT_EDGE_MARGIN, monumentsAroundChunk, planMonuments } from "./monuments";
export type { HaikuSceneKind, Monument, MonumentPlan, MonumentSpec } from "./monuments";
export { SHRINE_PILLAR_OFFSET, createObstacles } from "./obstacles";
export type { Obstacle, Obstacles } from "./obstacles";
export { FUJI_RAIL_SEED, PLATFORM_END, PLATFORM_TOP, RAIL_HALF_LENGTH, STAIRS, fujiRailway, railPoint, stationFloor } from "./fuji-railway";
export type { FujiRailway, FujiStation } from "./fuji-railway";
