import * as THREE from "three";
import { railPoint, waveOriginOf, PLATFORM_END, PLATFORM_FAR, PLATFORM_NEAR, PLATFORM_TOP, RAIL_HALF_WIDTH, type FujiRailway, type Obstacle, type Terrain } from "../world";
import { lifeAt, TRAIN_CAR_LENGTH, TRAIN_CAR_OFFSET, TRAIN_CAR_WIDTH, type TrainFrame } from "../game";
import { combine, deadOf, VitalityBuilder } from "./vitality-mesh";

const steel = 0x4e5863;
const concrete = 0x999387;
const cream = 0xf6f1e8;
const vermilion = 0xa34e3d;
const glass = 0x293e51;
const roof = 0x384854;
const wood = 0x69574b;

const unitBox = new THREE.BoxGeometry();
const materials = new Map<number, THREE.MeshStandardMaterial>();

function material(color: number): THREE.MeshStandardMaterial {
  let result = materials.get(color);
  if (!result) {
    result = new THREE.MeshStandardMaterial({ color, flatShading: true });
    materials.set(color, result);
  }
  return result;
}

/** Model coordinates run along the track on X and toward the platforms on Z. */
function box(parent: THREE.Group, color: number, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh {
  const part = new THREE.Mesh(unitBox, material(color));
  part.position.set(x, y, z);
  part.scale.set(w, h, d);
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function buildLocalTrain() {
  const train = new THREE.Group();
  const length = TRAIN_CAR_LENGTH;
  const wheel = new THREE.CylinderGeometry(0.19, 0.19, 0.14, 12).rotateX(Math.PI / 2);
  for (const direction of [-1, 1]) {
    const car = new THREE.Group();
    car.position.x = direction * TRAIN_CAR_OFFSET;
    train.add(car);
    box(car, steel, 0, 0.28, 0, length - 0.15, 0.39, 1.43);
    box(car, cream, 0, 1.13, 0, length, 1.42, TRAIN_CAR_WIDTH).castShadow = true;
    box(car, roof, 0, 1.86, 0, length + 0.085, 0.17, 1.79);
    box(car, roof, 0, 1.98, 0, length - 0.2, 0.13, 1.50);
    box(car, 0x697474, -direction * 1.15, 2.077, 0, 1.42, 0.115, 0.64);
    box(car, steel, -direction * 3.8, 0.9, 0, 0.64, 1.04, 0.73);
    for (const side of [-1, 1]) {
      box(car, vermilion, 0, 0.69, side * 0.881, length + 0.018, 0.50, 0.035);
      for (const pane of [-3.42, -2.01, -0.76, 0.65, 1.84, 3.2]) {
        const x = direction * pane;
        const boardingDoor = direction === 1 && pane === -3.42;
        if (boardingDoor && side === 1) continue;
        box(car, 0x555651, x, 1.35, side * 0.892, 0.92, 0.61, 0.035);
        box(car, glass, x, 1.37, side * 0.916, 0.80, 0.48, 0.022);
        box(car, 0x8eabae, x, 1.43, side * 0.931, 0.79, 0.042, 0.015);
      }
      for (const axle of [-2.82, -2.37, 2.37, 2.82]) {
        const tire = new THREE.Mesh(wheel, material(0x44484a));
        tire.position.set(axle, 0.2, side * 0.60);
        car.add(tire);
      }
      box(car, 0x555651, direction * 4.048, 1.39, side * 0.51, 0.048, 0.56, 0.57);
      box(car, glass, direction * 4.08, 1.42, side * 0.51, 0.03, 0.44, 0.47);
      box(car, 0xffe7bf, direction * 4.087, 0.74, side * 0.62, 0.052, 0.13, 0.19);
    }
    box(car, vermilion, direction * 4.05, 0.68, 0, 0.065, 0.50, 1.78);
    box(car, 0x6f7369, direction * 4.073, 1.14, 0, 0.05, 1.30, 0.40);
    box(car, glass, direction * 4.108, 1.42, 0, 0.024, 0.47, 0.29);
    box(car, 0xf0e1ab, direction * 4.075, 1.76, 0, 0.069, 0.105, 0.43);
    box(car, steel, direction * 4.12, 0.38, 0, 0.15, 0.15, 0.34);
  }

  const door = new THREE.Group();
  door.position.set(1.4, 0, 0.9);
  box(door, glass, 0, 1.06, 0.002, 0.63, 1.28, 0.04);
  const panels = [-1, 1].map((side) => {
    const panel = new THREE.Group();
    box(panel, cream, 0, 1.06, 0.03, 0.302, 1.27, 0.04);
    box(panel, vermilion, 0, 0.69, 0.058, 0.302, 0.49, 0.026);
    box(panel, glass, 0, 1.46, 0.057, 0.19, 0.37, 0.022);
    door.add(panel);
    return { panel, side };
  });
  train.add(door);
  return {
    train,
    openDoors(fraction: number) {
      for (const { panel, side } of panels) panel.position.x = side * (0.156 + 0.32 * fraction);
    },
  };
}

/** Clip static rail surfaces to the same unit tiles that colour the terrain. */
function clipRailFace(points: readonly THREE.Vector3[], axis: "x" | "z", edge: number, sign: number): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  let previous = points.at(-1);
  if (!previous) return result;
  for (const point of points) {
    const before = (previous[axis] - edge) * sign;
    const after = (point[axis] - edge) * sign;
    if ((before >= 0) !== (after >= 0)) {
      result.push(previous.clone().lerp(point, before / (before - after)));
    }
    if (after >= 0) result.push(point);
    previous = point;
  }
  return result;
}

function bakeRailScenery(group: THREE.Group, terrain: Terrain) {
  const siteOf = (id: string) => waveOriginOf(terrain.world.regionById(id));
  const ordinary = new VitalityBuilder(siteOf);
  const shadowed = new VitalityBuilder(siteOf);
  const subdivided = new Map<number, THREE.BoxGeometry>();
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    const builder = object.castShadow ? shadowed : ordinary;
    let geometry: THREE.BufferGeometry = object.geometry;
    // Subdivide long boxes before clipping so we only visit tiles close to the rails.
    const sections = Math.ceil(object.scale.x / 2);
    if (geometry === unitBox && sections > 1) {
      let divided = subdivided.get(sections);
      if (!divided) {
        divided = new THREE.BoxGeometry(1, 1, 1, sections);
        subdivided.set(sections, divided);
      }
      geometry = divided;
    }
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const vertex = (offset: number) => new THREE.Vector3()
      .fromBufferAttribute(position, index ? index.getX(offset) : offset).applyMatrix4(object.matrixWorld);
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
      const minX = Math.floor(Math.min(a.x, b.x, c.x)), maxX = Math.floor(Math.max(a.x, b.x, c.x));
      const minZ = Math.floor(Math.min(a.z, b.z, c.z)), maxZ = Math.floor(Math.max(a.z, b.z, c.z));
      for (let x = minX; x <= maxX; x++) {
        const column = clipRailFace(clipRailFace([a, b, c], "x", x, 1), "x", x + 1, -1);
        if (column.length < 3) continue;
        for (let z = minZ; z <= maxZ; z++) {
          const face = clipRailFace(clipRailFace(column, "z", z, 1), "z", z + 1, -1);
          if (face.length < 3) continue;
          const regionId = terrain.world.regionAt(x + 0.5, z + 0.5).id;
          const first = face[0]!;
          for (let j = 1; j + 1 < face.length; j++) {
            const second = face[j]!, third = face[j + 1]!;
            builder.addTriangles(
              [first.x, first.y, first.z, second.x, second.y, second.z, third.x, third.y, third.z],
              object.material.color, regionId,
            );
          }
        }
      }
    }
  });
  for (const geometry of subdivided.values()) geometry.dispose();
  const unshadowedMesh = ordinary.build(() => 0);
  unshadowedMesh.object.castShadow = false;
  return combine([unshadowedMesh, shadowed.build(() => 0)]);
}

export function buildFujiTrain(line: FujiRailway, terrain: Terrain) {
  const root = new THREE.Group();
  root.position.set(line.origin.x, line.height, line.origin.z);
  root.rotation.y = -Math.atan2(line.along.z, line.along.x);
  const { train, openDoors } = buildLocalTrain();
  root.add(train);
  const scenery = new THREE.Group();
  const length = line.end - line.start;
  const centre = (line.end + line.start) / 2;
  box(scenery, concrete, centre, -0.18, 0, length, 0.36, RAIL_HALF_WIDTH * 2);
  for (const side of [-1, 1]) {
    box(scenery, steel, centre, 0.055, side * 0.61, length, 0.11, 0.09);
  }
  const tieCount = Math.ceil(length / 1.2);
  for (let i = 0; i < tieCount; i++) {
    box(scenery, wood, line.start + (i + 0.5) * length / tieCount, 0.025, 0, 0.18, 0.06, 1.57);
  }

  function ground(distance: number, across: number): number {
    const p = railPoint(line, distance, across);
    return terrain.groundAt(p.x, p.z) - line.height;
  }
  function support(x: number, z: number, top: number, width: number): void {
    const bottom = ground(x, z) - 0.15;
    if (bottom < top) box(scenery, concrete, x, (bottom + top) / 2, z, width, top - bottom, width);
  }

  for (let x = Math.ceil(line.start / 7) * 7; x <= line.end; x += 7) {
    support(x, 0, -0.32, 0.78);
    if (x % 14 !== 0) continue;
    // Keep the mountain-facing window clear through the centre of the pass.
    const side = Math.abs(x) <= 14 ? 1 : -1;
    support(x, 1.6 * side, 0, 0.25);
    box(scenery, steel, x, 1.47, 1.6 * side, 0.11, 2.94, 0.11);
    box(scenery, steel, x, 2.88, 0.82 * side, 0.08, 0.08, 1.65);
  }
  box(scenery, steel, centre, 2.84, 0, length, 0.026, 0.026);

  const posts: Obstacle[] = [];
  const lights: {
    regionId: string;
    distance: number;
    bulb: THREE.MeshStandardMaterial;
    alive: THREE.Color;
    dead: THREE.Color;
    strength: number;
    signal: boolean;
  }[] = [];
  const addLight = (x: number, y: number, z: number, w: number, h: number, d: number, signal = false) => {
    const alive = new THREE.Color(signal ? 0x583f33 : 0x8f6d40);
    const dead = deadOf(alive);
    const bulb = new THREE.MeshStandardMaterial({ color: dead, emissive: signal ? 0xffa756 : 0xffd58a, emissiveIntensity: 0 });
    box(root, cream, x, y + PLATFORM_TOP - 0.43, z, w, h, d).material = bulb;
    const point = railPoint(line, x, z);
    const region = terrain.world.regionAt(Math.floor(point.x) + 0.5, Math.floor(point.z) + 0.5);
    const distance = Math.hypot(point.x - region.shrine.x, point.z - region.shrine.z);
    lights.push({ regionId: region.id, distance, bulb, alive, dead, strength: signal ? 1.8 : 1.9, signal });
  };

  for (const station of line.stations) {
    const x = station.distance;
    box(scenery, concrete, x, PLATFORM_TOP + 0.009, (PLATFORM_NEAR + PLATFORM_FAR) / 2, PLATFORM_END * 2, 0.026, PLATFORM_FAR - PLATFORM_NEAR);
    box(scenery, 0xd2bd91, x, PLATFORM_TOP + 0.025, 1.14, 19, 0.012, 0.13);
    const shelter = new THREE.Group();
    shelter.position.y = PLATFORM_TOP - 0.43;
    scenery.add(shelter);
    // A low timber waiting shelter with a tiled gable and a seat along the back wall.
    for (const side of [-1, 1]) {
      const pitch = box(shelter, roof, x, 2.91, 2.68 + side * 0.73, 12.8, 0.13, 1.68);
      pitch.rotation.x = side * 0.42;
      pitch.castShadow = true;
      box(shelter, wood, x, 2.49, 2.68 + side * 1.44, 12.4, 0.14, 0.10);
    }
    box(shelter, roof, x, 3.25, 2.68, 12.9, 0.12, 0.21);
    box(shelter, 0xb09a72, x, 1.32, 3.65, 11.95, 1.7, 0.15);
    for (const dx of [-4.1, 0, 4.1]) {
      box(shelter, wood, x + dx, 1.69, 3.55, 1.52, 0.72, 0.15);
      for (const side of [-1, 1]) {
        box(shelter, 0x465957, x + dx + side * 0.37, 1.69, 3.46, 0.63, 0.56, 0.045);
      }
    }
    box(shelter, 0x8d6a47, x - 3.23, 0.88, 3.21, 3.1, 0.13, 0.43);
    box(shelter, 0xd9cead, x + 3.75, 2.1, 3.49, 2.8, 0.4, 0.13);
    box(shelter, 0x617a66, x + 3.75, 1.986, 3.41, 2.54, 0.07, 0.045);
    for (const dx of [-6, 0, 6]) {
      box(shelter, wood, x + dx, 1.5, 3.55, 0.18, 2.15, 0.18);
      posts.push({ ...railPoint(line, x + dx, 3.55), r: 0.18 });
    }
    for (let dx = -5.3; dx <= 5.3; dx += 0.7) {
      posts.push({ ...railPoint(line, x + dx, 3.65), r: 0.34 });
    }
    box(shelter, steel, x - 7.4, 1.16, 3.56, 0.13, 2.3, 0.13);
    box(shelter, roof, x - 7.4, 2.15, 3.53, 0.34, 0.44, 0.24);
    for (const dx of [-3.4, 3.4]) {
      box(shelter, wood, x + dx, 2.63, 2.56, 0.06, 0.21, 0.06);
      addLight(x + dx, 2.49, 2.56, 0.24, 0.18, 0.24);
    }
    addLight(x - 7.4, 2.16, 3.39, 0.18, 0.19, 0.04, true);
  }

  root.updateMatrix();
  scenery.applyMatrix4(root.matrix);
  const restoredScenery = bakeRailScenery(scenery, terrain);
  const railway = new THREE.Group();
  railway.name = "Mount Fuji railway";
  railway.add(root, restoredScenery.object);

  return {
    root: railway,
    posts,
    scenery: restoredScenery,
    update(frame: TrainFrame | undefined, parkedDistance: number, service: boolean, progressOf: (id: string) => number) {
      train.visible = !frame?.windowView && (service || frame !== undefined);
      train.position.x = frame?.distance ?? parkedDistance;
      openDoors(frame ? Math.min(1, frame.boarding * 3) : 1);
      for (const { regionId, distance, bulb, alive, dead, strength, signal } of lights) {
        const life = lifeAt(progressOf(regionId), distance);
        bulb.color.copy(dead).lerp(alive, life);
        bulb.emissiveIntensity = strength * life;
        if (signal) bulb.emissive.setHex(service ? 0x93f5ba : 0xffa756);
      }
    },
  };
}
