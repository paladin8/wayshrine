export { BIOMES, BIOME_REQUIRES, CAPABILITIES, biomeRequiring, canTraverse } from "./terrain";
export type { Biome, Capability } from "./terrain";
export { REGION_SIZE, neighborsOf, parseRegionId, regionId } from "./coords";
export type { Point, RegionCoord } from "./coords";
export { createWorld } from "./world";
export type { Region, Shrine, World } from "./world";
export { greedyProgress, reachableRegions } from "./progression";
export { CHUNK_SIZE, PLATEAU_RADIUS, createTerrain } from "./terrain-grid";
export type { Terrain, Tile } from "./terrain-grid";
