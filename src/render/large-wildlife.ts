import * as THREE from "three";
import { createRng } from "../core";
import { PLATEAU_RADIUS, SHRINE_CLEARING_RADIUS, plateauDistance, type Biome, type Obstacle, type Point, type Region, type Terrain } from "../world";
import { appendAnimalObstacles, withinBoatHeight } from "./animal-collision";
import { createAnimalModels, type Species } from "./animal-models";
import { swimMotion, wildlifeMotion } from "./wildlife-motion";

const SPECIES: Readonly<Record<Biome, readonly Species[]>> = {
  meadow: ["deer", "deer", "fox"],
  forest: ["deer", "boar", "boar", "serow"],
  marsh: ["crane", "crane", "boar"],
  snow: ["fox", "serow", "deer"],
  mountain: ["serow", "serow", "fox"],
  volcanic: ["fox", "serow"],
  dunes: ["fox"],
  water: ["otter"],
  sea: ["dolphin", "dolphin", "whale"],
};

const TAU = Math.PI * 2;
const MAX_GROUPS = 3;
const SIGHTING_RATE = 0.25;

interface Sighting extends Point {
  readonly species: Species;
  readonly biome: Biome;
  readonly angle: number;
  readonly radius: number;
  readonly count: number;
  readonly scale: number;
  readonly afloat: boolean;
}

/** Each region gets one seeded chance. The group uses a small viable route clear of shrines and banks. */
export function createSightings(terrain: Terrain): (region: Region) => Sighting | null {
  const rng = createRng(terrain.world.seed).fork("large-wildlife");
  const plans = new WeakMap<Region, Sighting | null>();
  return (region) => {
    const known = plans.get(region);
    if (known !== undefined) return known;
    const local = rng.fork(region.id);
    plans.set(region, null);
    if (!local.chance(SIGHTING_RATE)) return null;
    const species = local.pick(SPECIES[region.biome]);
    const afloat = region.biome === "water" || region.biome === "sea";
    const count = species === "whale" || species === "fox" ? 1
      : species === "dolphin" ? local.int(2, 4)
      : species === "deer" || species === "crane" ? 2
      : local.int(1, 3);
    const radius = species === "whale" ? 7.4 : species === "dolphin" ? 5.5
      : afloat ? 3.1 : species === "boar" ? 2.55 : species === "fox" ? 2.35 : 1.7;
    const clearance = radius + (afloat ? 2.9 : 1.4);
    const shrineClearance = clearance + (region.landmark ? 0 : SHRINE_CLEARING_RADIUS - PLATEAU_RADIUS);
    for (let i = 0; i < 24; i++) {
      const bearing = local.range(0, TAU);
      const distance = local.range(7, 31);
      const x = region.site.x + Math.sin(bearing) * distance;
      const z = region.site.z + Math.cos(bearing) * distance;
      const tile = terrain.tileAtPoint(x, z);
      if (tile.regionId !== region.id || tile.biome !== region.biome || plateauDistance(region, x, z) < shrineClearance) continue;
      const viable = Array.from({ length: 12 }, (_, step) => {
        const a = TAU * step / 12;
        return terrain.tileAtPoint(x + Math.cos(a) * clearance, z + Math.sin(a) * clearance);
      }).every(t => t.regionId === region.id && t.biome === region.biome && (afloat || Math.abs(t.height - tile.height) <= 0.7));
      if (!viable) continue;
      const sight = { species, biome: region.biome, x, z, angle: local.range(0, TAU), radius, count, scale: local.range(0.95, 1.22), afloat };
      plans.set(region, sight);
      return sight;
    }
    return null;
  };
}

export function createLargeWildlife(terrain: Terrain, life: (x: number, z: number) => number) {
  const root = new THREE.Group();
  root.name = "Rare wildlife";
  const models = createAnimalModels();
  const plan = createSightings(terrain);
  const wakeGeometry = new THREE.BufferGeometry().setAttribute(
    "position", new THREE.Float32BufferAttribute([
      -0.19, 0, -0.40, -0.41, 0, -0.79, -0.36, 0, -0.78,
      -0.41, 0, -0.79, -0.61, 0, -1.20, -0.58, 0, -1.20,
      0.16, 0, -0.30, 0.36, 0, -0.72, 0.31, 0, -0.72,
      0.36, 0, -0.72, 0.57, 0, -1.05, 0.53, 0, -1.05,
    ], 3),
  );
  const wakeMaterial = new THREE.MeshBasicMaterial({ color: 0xaac9ca, side: THREE.DoubleSide, transparent: true, opacity: 0.49, depthWrite: false });
  const blowGeometry = new THREE.ConeGeometry(0.26, 1, 6, 1, true).rotateZ(Math.PI);
  const blowMaterial = new THREE.MeshBasicMaterial({ color: 0xd3e4e3, transparent: true, opacity: 0.46, depthWrite: false, side: THREE.DoubleSide });
  const groups = new Map<Sighting, ReturnType<typeof makeGroup>>();
  let scan = 0;

  function makeGroup(sight: Sighting) {
    const group = new THREE.Group();
    root.add(group);
    const animals = Array.from({ length: sight.count }, (_, i) => {
      const model = models.build(sight.species, i === 0);
      group.add(model.group);
      const wake = new THREE.Mesh(wakeGeometry, wakeMaterial);
      if (sight.afloat) group.add(wake);
      const blow = sight.species === "whale" ? new THREE.Mesh(blowGeometry, blowMaterial) : null;
      if (blow) group.add(blow);
      return { ...model, wake, blow, solid: false };
    });
    return { group, animals, time: 0 };
  }

  function stream(focus: Point, zoom: number): void {
    const region = terrain.world.regionAt(focus.x, focus.z);
    const next: { sight: Sighting; dist: number }[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const sight = plan(terrain.world.region(region.coord.rx + dx, region.coord.rz + dz));
        if (!sight) continue;
        const dist = Math.hypot(sight.x - focus.x, sight.z - focus.z);
        if (dist < 33 + zoom * 24 && life(sight.x, sight.z) > 0.75) next.push({ sight, dist });
      }
    }
    const nearby = next.sort((a, b) => a.dist - b.dist).slice(0, MAX_GROUPS);
    for (const [sight, group] of groups) {
      if (nearby.some(candidate => candidate.sight === sight)) continue;
      root.remove(group.group);
      groups.delete(sight);
    }
    for (const { sight } of nearby) if (!groups.has(sight)) groups.set(sight, makeGroup(sight));
  }

  return {
    root,
    update(dt: number, focus: Point, zoom: number) {
      scan -= dt;
      if (scan <= 0) {
        stream(focus, zoom);
        scan = 0.35;
      }
      for (const [sight, group] of groups) {
        group.time += dt;
        group.animals.forEach((animal, i) => {
          const t = group.time + i * (sight.species === "dolphin" ? 0.63 : 2.32);
          const radius = sight.radius * (i === 0 ? 1 : 0.80);
          const motion = wildlifeMotion(sight.species, t, radius);
          const angle = sight.angle + motion.angle + i * (sight.afloat ? 0.55 : 1.42);
          const x = sight.x + Math.cos(angle) * radius;
          const z = sight.z + Math.sin(angle) * radius * 0.78;
          const tile = terrain.tileAtPoint(x, z);
          const wet = tile.biome === "water" || tile.biome === "sea";
          animal.group.visible = tile.biome === sight.biome && life(x, z) > 0.58;
          animal.solid = false;
          animal.wake.visible = false;
          if (animal.blow) animal.blow.visible = false;
          if (!animal.group.visible) return;
          const whale = sight.species === "whale";
          const water = sight.afloat ? swimMotion(sight.species, t) : null;
          const lift = water?.lift ?? 0;
          const ground = wet ? tile.height : terrain.groundAt(x, z);
          const size = sight.scale * (i === 0 ? 1 : 0.83) * Math.min(1, group.time * 1.65);
          animal.group.position.set(x, ground + lift, z);
          animal.group.scale.setScalar(size);
          animal.solid = size >= 0.35 && (!water || withinBoatHeight(sight.species, lift));
          animal.group.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle) * 0.78);
          animal.group.rotation.x = water?.pitch ?? 0;
          animal.pose(t, motion.gait, motion.phase);
          if (animal.blow && water && water.blow > 0) {
            const plume = Math.sin(water.blow * Math.PI * 0.5) * size;
            const heading = animal.group.rotation.y;
            animal.blow.position.set(x + Math.sin(heading) * 0.68, ground + 0.54 + plume * 0.57, z + Math.cos(heading) * 0.68);
            animal.blow.scale.set(plume, plume * 0.90, plume);
            animal.blow.visible = true;
          }
          if (sight.afloat && lift > -0.25) {
            animal.wake.position.set(x, ground + (tile.biome === "sea" ? 0.15 : 0.10), z);
            animal.wake.rotation.y = animal.group.rotation.y;
            animal.wake.scale.set(size * (whale ? 1.5 : 0.66), 1, size * (whale ? 2.3 : 1.24));
            animal.wake.visible = true;
          }
        });
      }
    },
    appendObstaclesNear(x: number, z: number, reach: number, out: Obstacle[]) {
      for (const [sight, group] of groups) {
        for (const animal of group.animals) {
          if (animal.solid) appendAnimalObstacles(animal.group, sight.species, x, z, reach, out);
        }
      }
    },
    dispose() {
      root.clear();
      groups.clear();
      wakeGeometry.dispose();
      wakeMaterial.dispose();
      blowGeometry.dispose();
      blowMaterial.dispose();
      models.dispose();
    },
  };
}
