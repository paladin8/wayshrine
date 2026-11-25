import * as THREE from "three";
import { createRng, type Rng } from "../core";
import { hirosakiGarden, hirosakiPathPoint, plateauBase, type Point, type Terrain } from "../world";
import { Kind, ParticleLayer } from "./particles";
import { deadOf } from "./vitality-mesh";

// These offsets follow the water and winter cherry trees in content/landmarks/hirosaki-castle.py.
const MOAT_HEIGHT = -0.25;
const MOAT = [
  { x: -9.9, z: -0.55, width: 14.65, depth: 2.3, eastBank: false },
  { x: 4.75, z: -9.3, width: 2.25, depth: 11.05, eastBank: true },
] as const;
const BANK_TREES = [
  [-5.8, 4.2, 0.95], [-4.8, 7.2, 0.85], [0.6, 4.2, 0.9], [3.4, 4.4, 0.85],
  [9.2, -6.6, 0.8], [9, 4.2, 0.8], [-9.4, 3.6, 0.8], [1.4, 8, 0.85], [6.4, 8.6, 0.8],
] as const;

const BLOSSOM = [0xe59ab1, 0xf3b7c8, 0xffcedb, 0xffdde5].map((hex) => new THREE.Color(hex));
const FLOATING_PETAL = new THREE.Color(0xffb4d2);

/** The hanaikada accumulates along the outside wall, leaving gaps of blue water. */
function petalRaft(section: (typeof MOAT)[number], rng: Rng): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const length = section.eastBank ? section.depth : section.width;
  const vertices: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < length * 38; i++) {
    const along = rng.range(0.25, length - 0.25);
    const spread = 0.45 + 0.8 * Math.sin(along * 0.95 + 0.3) ** 2;
    const inset = 0.13 + spread * rng.next() ** 1.6;
    const x = section.eastBank ? section.x + section.width - inset : section.x + along;
    const z = section.eastBank ? section.z + along : section.z + section.depth - inset;
    const size = rng.range(0.06, 0.33);
    const turn = rng.range(0, Math.PI * 2);
    const color = rng.pick(BLOSSOM);
    const y = MOAT_HEIGHT + 0.031 + i * 0.00001;
    for (let edge = 0; edge < 5; edge++) {
      const a = turn + (edge + 1) * Math.PI * 0.4;
      const b = turn + edge * Math.PI * 0.4;
      vertices.push(x, y, z, x + Math.cos(a) * size, y, z + Math.sin(a) * size, x + Math.cos(b) * size, y, z + Math.sin(b) * size);
      for (let v = 0; v < 3; v++) colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.9 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

const PATH_STONE = new THREE.Color(0xb2a59d);
const PATH_STONE_DEAD = deadOf(PATH_STONE);

function avenue(
  terrain: Terrain,
  garden: NonNullable<ReturnType<typeof hirosakiGarden>>,
  base: number,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const vertices: number[] = [];
  const colors: number[] = [];
  const start = 10.2; // Overlap the authored stone walk up to the red bridge.
  const steps = Math.ceil(Math.max(0, garden.pathEnd - start) / 0.25);
  for (let step = 0; step <= steps && steps > 0; step++) {
    const distance = THREE.MathUtils.lerp(start, garden.pathEnd, step / steps);
    const centre = hirosakiPathPoint(garden, distance);
    const taper = Math.min(1, (garden.pathEnd - distance) / 2.1);
    const width = (0.55 + Math.min(0.36, (distance - start) * 0.11)) * taper;
    for (const across of [-1.22, -0.72, 0.72, 1.22]) {
      const x = centre.x + across * width;
      const y = terrain.groundAt(x, centre.z) - base + 0.048;
      vertices.push(x - garden.origin.x, y, distance);
      colors.push(1, 1, 1, Math.abs(across) < 1 ? taper : 0);
    }
  }
  const indices: number[] = [];
  for (let step = 0; step < steps; step++) {
    for (let strip = 0; strip < 3; strip++) {
      const i = step * 4 + strip;
      indices.push(i, i + 4, i + 1, i + 1, i + 4, i + 5);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

export function createHirosakiScenery(scene: THREE.Scene, terrain: Terrain, lifeAtPoint: (x: number, z: number) => number) {
  const garden = hirosakiGarden(terrain.world);
  if (!garden) return (_clock: number, _pixelScale: number, _focus: Point): void => {};
  const { origin } = garden;
  const rng = createRng(terrain.world.seed).fork("hirosaki-petals");
  const group = new THREE.Group();
  group.name = "Hirosaki cherry blossoms";
  const base = plateauBase(terrain.world.regionById(garden.regionId));
  group.position.set(origin.x, base, origin.z);
  const path = avenue(terrain, garden, base);
  group.add(path);
  const rafts = MOAT.map((section) => {
    const mesh = petalRaft(section, rng);
    group.add(mesh);
    return { mesh, x: origin.x + section.x + section.width / 2, z: origin.z + section.z + section.depth / 2 };
  });
  const crownGeometry = new THREE.IcosahedronGeometry(1, 0);
  const crownMaterial = new THREE.MeshStandardMaterial({ flatShading: true });
  const transform = new THREE.Object3D();
  const crowns = BANK_TREES.map(([x, z, scale]) => {
    const mesh = new THREE.InstancedMesh(crownGeometry, crownMaterial, 8);
    mesh.position.set(x, 1.46 * scale, z);
    mesh.castShadow = true;
    for (let i = 0; i < mesh.count; i++) {
      const angle = i * 2.39996;
      const radius = i < 2 ? 0.2 : rng.range(0.52, 1.15);
      transform.position.set(Math.cos(angle) * radius, rng.range(-0.12, 0.46), Math.sin(angle) * radius);
      transform.rotation.y = angle;
      transform.scale.set(rng.range(0.51, 0.8), rng.range(0.39, 0.62), rng.range(0.51, 0.8));
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      mesh.setColorAt(i, BLOSSOM[i % BLOSSOM.length]!);
    }
    group.add(mesh);
    return { mesh, x: origin.x + x, z: origin.z + z, scale };
  });
  scene.add(group);

  const emitters = [
    ...crowns.map(({ x, z, scale }) => ({ x, z, y: base + 2.05 * scale })),
    ...garden.trees.map(({ x, z, scale }) => ({ x, z, y: terrain.groundAt(x, z) + 2.55 * scale })),
  ].map(({ x, y, z }) => ({
    x, y, z,
    towardMoat: x > origin.x + 7.8 && z < origin.z + 2 ? -1.65 : 0.85,
    drifts: Array.from({ length: 6 }, () => ({
      dx: rng.range(-1.25, 1.25), dz: rng.range(-1.1, 1.1), phase: rng.next(),
      speed: rng.range(0.18, 0.31), fall: rng.range(1.4, 2.6), size: rng.range(5, 11),
    })),
  }));
  const petals = new ParticleLayer(emitters.reduce((count, emitter) => count + emitter.drifts.length, 0), false);
  petals.points.renderOrder = 2;
  scene.add(petals.points);

  return (clock: number, pixelScale: number, focus: Point): void => {
    const nearby = Math.hypot(focus.x - origin.x, focus.z - origin.z) < 65;
    group.visible = nearby;
    petals.points.visible = nearby;
    if (!nearby) return;

    path.material.color.copy(PATH_STONE_DEAD).lerp(PATH_STONE, lifeAtPoint(origin.x - 2.7, origin.z + 14));
    for (const { mesh, x, z } of rafts) {
      const life = lifeAtPoint(x, z);
      mesh.visible = life > 0.12;
      mesh.material.opacity = THREE.MathUtils.smoothstep(life, 0.12, 0.93);
      mesh.position.x = Math.sin(clock * 0.55) * 0.027 * life;
    }
    for (const { mesh, x, z, scale } of crowns) {
      const bloom = THREE.MathUtils.smoothstep(lifeAtPoint(x, z), 0.14, 0.88);
      mesh.visible = bloom > 0.001;
      mesh.scale.setScalar(scale * bloom);
    }
    let i = 0;
    for (const { x, y, z, towardMoat, drifts } of emitters) {
      const life = lifeAtPoint(x, z);
      for (const drift of drifts) {
        const p = petals.particles[i++]!;
        p.active = life > 0.58;
        if (!p.active) continue;
        const t = (clock * drift.speed + drift.phase) % 1;
        p.kind = Kind.Petal;
        p.age = t;
        p.x = x + drift.dx + Math.sin(t * 7 + drift.phase * 6) * 0.33 + t * towardMoat;
        p.y = y - t * drift.fall;
        p.z = z + drift.dz - t * 1.55;
        p.size = drift.size;
        [p.r, p.g, p.b] = [FLOATING_PETAL.r, FLOATING_PETAL.g, FLOATING_PETAL.b];
        p.alpha = life * 0.95;
      }
    }
    petals.flush(pixelScale);
  };
}
