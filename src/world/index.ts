export { BIOMES, BIOME_REQUIRES, CAPABILITIES, biomeRequiring, canTraverse } from "./terrain";
export type { Biome, Capability } from "./terrain";
export { REGION_REACH, REGION_SIZE, neighborsOf, parseRegionId, regionId } from "./coords";
export type { Point, RegionCoord } from "./coords";
export { createWorld } from "./world";
export type { Region, World } from "./world";
export { LANDMARK_TOTAL, greedyProgress, reachableRegions } from "./progression";
export { reachableCoords } from "./reach";
export {
  CAPABILITY_THRESHOLDS,
  HOME_RADIUS,
  LANDMARK_BLEND,
  LANDMARK_MONUMENT_CLEARANCE,
  LANDMARK_PLATEAU_RADIUS,
  LANDMARK_REACH_MARGIN,
  LANDMARK_SOLID_RADIUS,
  anchorOf,
  footprintHalf,
  landmarkReach,
  standPoint,
  LANDMARKS,
  LANDMARK_SPECS,
  capabilitiesForCount,
  landmarksBeforeAct,
  planLandmarks,
  ringRadius,
} from "./landmarks";
export type { Landmark, LandmarkSpec } from "./landmarks";
export { groundHeight, groundOf } from "./landmark-ground";
export type { LandmarkGround } from "./landmark-ground";
export { CHUNK_SIZE, PLATEAU_RADIUS, createTerrain, plateauBase, plateauDistance } from "./terrain-grid";
export type { Terrain, Tile } from "./terrain-grid";
export { PROP_KINDS, propsInChunk } from "./props";
export type { Prop, PropKind } from "./props";
export { MONUMENT_CLEARING, MONUMENT_EDGE_MARGIN, monumentsAroundChunk, planMonuments } from "./monuments";
export type { Monument, MonumentPlan, MonumentSpec } from "./monuments";
export { createObstacles } from "./obstacles";
export type { Obstacle, Obstacles } from "./obstacles";
