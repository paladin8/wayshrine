import { neighborsOf, type Biome, type Region, type World } from "./world";

export function ordinaryRegionNearLandmark(world: World, biome: Biome): Region {
  for (const landmark of world.landmarks) {
    if (landmark.biome !== biome) continue;
    for (const { rx, rz } of neighborsOf(landmark.coord)) {
      const region = world.region(rx, rz);
      if (!region.landmark && region.biome === biome) return region;
    }
  }
  throw new Error(`No ordinary ${biome} region next to a matching landmark in seed ${world.seed}`);
}
