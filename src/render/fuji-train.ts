import * as THREE from "three";
import { railPoint, PLATFORM_END, PLATFORM_TOP, RAIL_HALF_LENGTH, STAIRS, type FujiRailway, type Obstacle, type Terrain } from "../world";
import type { TrainFrame } from "../game";

const steel = 0x4e5863;
const concrete = 0x999387;
const cream = 0xf6f1e8;
const blue = 0x2e618c;
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

function nose(parent: THREE.Group, direction: -1 | 1): void {
  const rings = [
    [3.1, 0.89, 0.38, 1.9],
    [3.8, 0.86, 0.38, 1.71],
    [4.55, 0.74, 0.37, 1.22],
    [5.35, 0.53, 0.35, 0.8],
    [5.88, 0.19, 0.36, 0.57],
    [5.94, 0.02, 0.39, 0.49],
  ] as const;
  const positions: number[] = [];
  for (const [x, w, bottom, top] of rings) {
    const edge = (top - bottom) * 0.18;
    const ring = [[-w * 0.82, bottom], [-w, bottom + edge], [-w, top - edge], [-w * 0.68, top],
      [w * 0.68, top], [w, top - edge], [w, bottom + edge], [w * 0.82, bottom]] as const;
    for (const [z, y] of ring) positions.push(x, y, z);
  }
  const geometry = new THREE.BufferGeometry();
  const indices: number[] = [];
  for (let row = 0; row < rings.length - 1; row++) {
    for (let col = 0; col < 8; col++) {
      const a = row * 8 + col;
      const b = row * 8 + (col + 1) % 8;
      indices.push(a, b, a + 8, b, b + 8, a + 8);
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cab = new THREE.Group();
  if (direction === -1) cab.rotation.y = Math.PI;
  const shell = new THREE.Mesh(geometry, material(cream));
  shell.castShadow = true;
  cab.add(shell);
  const windshield = box(cab, glass, 3.78, 1.68, 0, 0.66, 0.065, 1.2);
  windshield.rotation.z = -0.48;
  for (const side of [-1, 1]) {
    const light = box(cab, 0xfff1cb, 5.25, 0.68, side * 0.44, 0.45, 0.09, 0.2);
    light.rotation.z = -0.36;
  }
  parent.add(cab);
}

function buildTrain() {
  const train = new THREE.Group();
  for (const [x, width] of [[-7.25, 6.2], [0, 8.1], [7.25, 6.2]] as const) {
    const car = new THREE.Group();
    car.position.x = x;
    train.add(car);
    box(car, steel, 0, 0.33, 0, width - 0.12, 0.55, 1.34);
    box(car, cream, 0, 1.13, 0, width, 1.48, 1.76).castShadow = true;
    box(car, cream, 0, 1.9, 0, width, 0.19, 1.4);
    for (const side of [-1, 1]) {
      box(car, blue, 0, 0.87, side * 0.886, width, 0.18, 0.038);
      for (let pane = -2.35; pane <= 2.4; pane += 0.79) {
        box(car, glass, pane, 1.42, side * 0.888, 0.51, 0.35, 0.028);
      }
      for (const wheel of [-width * 0.31, width * 0.31]) {
        const bogie = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.13, 12), material(steel));
        bogie.rotation.x = Math.PI / 2;
        bogie.position.set(wheel, 0.18, side * 0.57);
        car.add(bogie);
      }
    }
    if (x) nose(car, x < 0 ? -1 : 1);
  }
  const door = new THREE.Group();
  door.position.set(1.4, 0, 0.9);
  box(door, glass, 0, 1.06, 0.002, 0.63, 1.28, 0.04);
  const panels = [-1, 1].map((side) => {
    const panel = new THREE.Group();
    box(panel, cream, 0, 1.06, 0.03, 0.302, 1.27, 0.04);
    box(panel, blue, 0, 0.87, 0.058, 0.302, 0.18, 0.026);
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

export function buildFujiTrain(line: FujiRailway, terrain: Terrain) {
  const root = new THREE.Group();
  root.name = "Mount Fuji railway";
  root.position.set(line.origin.x, line.height, line.origin.z);
  root.rotation.y = -Math.atan2(line.along.z, line.along.x);
  const { train, openDoors } = buildTrain();
  root.add(train);
  box(root, concrete, 0, -0.18, 0, RAIL_HALF_LENGTH * 2, 0.36, 1.94);
  for (const side of [-1, 1]) {
    box(root, steel, 0, 0.055, side * 0.61, RAIL_HALF_LENGTH * 2, 0.11, 0.09);
  }
  const tieCount = 100;
  const ties = new THREE.InstancedMesh(unitBox, material(wood), tieCount);
  const transform = new THREE.Matrix4().makeScale(0.18, 0.06, 1.57);
  for (let i = 0; i < tieCount; i++) {
    transform.setPosition((i + 0.5) * 2 * RAIL_HALF_LENGTH / tieCount - RAIL_HALF_LENGTH, 0.025, 0);
    ties.setMatrixAt(i, transform);
  }
  root.add(ties);

  function ground(distance: number, across: number): number {
    const p = railPoint(line, distance, across);
    return terrain.groundAt(p.x, p.z) - line.height;
  }
  function support(x: number, z: number, top: number, width: number): void {
    const bottom = ground(x, z) - 0.15;
    if (bottom < top) box(root, concrete, x, (bottom + top) / 2, z, width, top - bottom, width);
  }

  for (let x = -56; x <= 56; x += 7) {
    support(x, 0, -0.32, 0.78);
    if (x % 14 !== 0) continue;
    // Keep the mountain-facing window clear through the centre of the pass.
    const side = Math.abs(x) <= 14 ? 1 : -1;
    support(x, 1.6 * side, 0, 0.25);
    box(root, steel, x, 1.47, 1.6 * side, 0.11, 2.94, 0.11);
    box(root, steel, x, 2.88, 0.82 * side, 0.08, 0.08, 1.65);
  }
  box(root, steel, 0, 2.84, 0, RAIL_HALF_LENGTH * 2, 0.026, 0.026);

  const posts: Obstacle[] = [];
  const lights = line.stations.map((station) => {
    const x = station.distance;
    box(root, concrete, x, PLATFORM_TOP - 0.24, 2.5, PLATFORM_END * 2, 0.48, 2.91).castShadow = true;
    box(root, 0xeac389, x, 0.435, 1.14, 19, 0.03, 0.15);
    box(root, roof, x, 2.93, 2.92, 13.8, 0.2, 2.77).castShadow = true;
    box(root, blue, x, 2.78, 1.55, 13.8, 0.15, 0.08);
    for (const dx of [-6, 0, 6]) {
      box(root, steel, x + dx, 1.65, 3.55, 0.17, 2.45, 0.17);
      support(x + dx, 2.55, -0.04, 0.73);
      posts.push({ ...railPoint(line, x + dx, 3.55), r: 0.15 });
    }
    for (const dx of STAIRS.offsets) {
      const base = ground(x + dx, STAIRS.edge + STAIRS.count * STAIRS.depth);
      for (let i = 0; i < STAIRS.count; i++) {
        const h = (PLATFORM_TOP - base) * (STAIRS.count - i) / STAIRS.count;
        box(root, concrete, x + dx, base + h / 2, STAIRS.edge + (i + 0.5) * STAIRS.depth, STAIRS.width, h, STAIRS.depth);
      }
    }
    box(root, steel, x - 7.4, 1.16, 3.56, 0.13, 2.3, 0.13);
    box(root, roof, x - 7.4, 2.15, 3.53, 0.34, 0.44, 0.24);
    const lamp = new THREE.MeshStandardMaterial({ color: 0x8f6d40, emissive: 0xffd58a, emissiveIntensity: 0 });
    const signal = new THREE.MeshStandardMaterial({ color: 0x583f33, emissive: 0xffa756, emissiveIntensity: 0 });
    box(root, cream, x, 2.77, 2.77, 11.6, 0.05, 0.09).material = lamp;
    box(root, cream, x - 7.4, 2.16, 3.39, 0.18, 0.19, 0.04).material = signal;
    return { lamp, signal };
  });

  // A few houses at the ends frame the open stretch at the foot of the mountain.
  for (const [x, z, w] of [[-36, -6, 3.4], [-31, -8.5, 2.9], [32, -7.1, 4.3], [38, -5.8, 3.4]] as const) {
    const y = ground(x, z);
    box(root, 0xb4a395, x, y + 0.9, z, w, 1.8, 2.36).castShadow = true;
    for (const side of [-1, 1]) {
      box(root, roof, x, y + 2.08, z + side * 0.61, w + 0.36, 0.12, 1.44).rotation.x = side * 0.44;
    }
    posts.push({ ...railPoint(line, x, z), r: 1.28 });
  }

  // Low planted rows provide a near layer of motion as the mountain comes into view.
  const dormantLeaves = new THREE.Color(0x74726a);
  const liveLeaves = new THREE.Color(0x688d51);
  const teaMaterial = new THREE.MeshStandardMaterial({ color: dormantLeaves, flatShading: true });
  const rows = 4;
  const plantsPerRow = 18;
  const tea = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), teaMaterial, rows * plantsPerRow);
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < plantsPerRow; i++) {
      const x = (i - (plantsPerRow - 1) / 2) * 1.35 + (row % 2) * 0.5;
      const z = -4.1 - row * 1.55;
      transform.makeScale(1.25, 0.46, 0.9);
      transform.setPosition(x, ground(x, z) + 0.13, z);
      tea.setMatrixAt(row * plantsPerRow + i, transform);
    }
  }
  tea.receiveShadow = true;
  root.add(tea);

  return {
    root,
    posts,
    update(frame: TrainFrame | undefined, parkedDistance: number, service: boolean, vitality: readonly number[]) {
      train.visible = !frame?.windowView && (service || frame !== undefined);
      train.position.x = frame?.distance ?? parkedDistance;
      openDoors(frame ? Math.min(1, frame.boarding * 3) : 1);
      teaMaterial.color.copy(dormantLeaves).lerp(liveLeaves, vitality[0]!);
      lights.forEach(({ lamp, signal }, index) => {
        lamp.emissiveIntensity = 1.9 * vitality[index]!;
        signal.emissive.setHex(service ? 0x93f5ba : 0xffa756);
        signal.emissiveIntensity = 1.8 * vitality[index]!;
      });
    },
  };
}
