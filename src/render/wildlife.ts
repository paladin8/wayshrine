import * as THREE from "three";
import { createRng } from "../core";
import { isWater, type Point, type Terrain } from "../world";

const BIRDS = 5;
const FISH = 7;
const TAU = Math.PI * 2;

interface Animal {
  readonly group: THREE.Group;
  readonly parts: readonly THREE.Mesh[];
  x: number;
  z: number;
  y: number;
  age: number;
  duration: number;
  phase: number;
  radius: number;
  direction: number;
}

/** Small, pooled animals that only visit land touched by the restoration wave. */
export function createWildlife(terrain: Terrain, lifeAtPoint: (x: number, z: number) => number) {
  const root = new THREE.Group();
  root.name = "Restored wildlife";
  const rng = createRng(terrain.world.seed).fork("wildlife");
  const bodyGeometry = new THREE.IcosahedronGeometry(1);
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.14, 0.39, 0, -0.04, 0.05, 0, -0.22], 3));
  wingGeometry.computeVertexNormals();

  const heron = new THREE.MeshStandardMaterial({ color: 0xe5dfca, flatShading: true, side: THREE.DoubleSide });
  const swallow = new THREE.MeshStandardMaterial({ color: 0x495550, flatShading: true, side: THREE.DoubleSide });
  const carp = new THREE.MeshStandardMaterial({ color: 0xdc9b63, flatShading: true });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8d8c9, flatShading: true });

  function animal(fish: boolean, index: number): Animal {
    const group = new THREE.Group();
    group.name = fish ? "Fish" : "Bird";
    const material = fish ? (index % 3 === 0 ? carp : silver) : (index % 3 === 0 ? swallow : heron);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.scale.set(fish ? 0.12 : 0.105, 0.10, fish ? 0.28 : 0.19);
    group.add(body);
    const parts: THREE.Mesh[] = [];
    if (fish) {
      const tail = new THREE.Mesh(bodyGeometry, material);
      tail.position.z = -0.31;
      tail.scale.set(0.16, 0.035, 0.15);
      group.add(tail);
      parts.push(tail);
    } else {
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(wingGeometry, material);
        wing.scale.x = side;
        group.add(wing);
        parts.push(wing);
      }
    }
    group.visible = false;
    root.add(group);
    return { group, parts, x: 0, y: 0, z: 0, age: 0, duration: 0, phase: 0, radius: 0, direction: 1 };
  }

  const birds = Array.from({ length: BIRDS }, (_, i) => animal(false, i));
  const fish = Array.from({ length: FISH }, (_, i) => animal(true, i));
  let wait = 0;

  function start(a: Animal, x: number, y: number, z: number, swimming: boolean, phase: number): void {
    a.x = x;
    a.y = y;
    a.z = z;
    a.age = 0;
    a.duration = swimming ? rng.range(7, 13) : rng.range(5, 8);
    a.phase = phase;
    a.radius = swimming ? rng.range(1.1, 2.8) : rng.range(2.8, 6);
    a.direction = rng.next() < 0.5 ? -1 : 1;
  }

  function visit(focus: Point, zoom: number): void {
    for (let i = 0; i < 9; i++) {
      const angle = rng.range(0, TAU);
      const distance = rng.range(2, 10 + zoom * 12);
      const x = focus.x + Math.cos(angle) * distance;
      const z = focus.z + Math.sin(angle) * distance;
      if (lifeAtPoint(x, z) < 0.78) continue;
      const tile = terrain.tileAtPoint(x, z);
      const swimming = isWater(tile.biome);
      const pool = swimming ? fish : birds;
      const free = pool.filter((a) => a.age >= a.duration);
      if (free.length < 2) continue;
      if (!swimming && tile.biome === "volcanic") continue;
      const phase = rng.range(0, TAU);
      for (let j = 0; j < Math.min(free.length, swimming ? 3 : 2); j++) {
        start(free[j]!, x + j * 0.8, tile.height, z - j * 0.65, swimming, phase + j * 0.6);
      }
      return;
    }
  }

  function pose(a: Animal, dt: number, focus: Point, zoom: number, swimming: boolean): void {
    a.age += dt;
    if (a.age >= a.duration || Math.hypot(a.x - focus.x, a.z - focus.z) > 23 + zoom * 16) {
      a.group.visible = false;
      a.age = a.duration;
      return;
    }
    const angle = a.phase + a.age * (swimming ? 0.78 : 0.59) * a.direction;
    const x = a.x + Math.cos(angle) * a.radius;
    const z = a.z + Math.sin(angle) * a.radius * 0.8;
    const tile = terrain.tileAtPoint(x, z);
    const life = lifeAtPoint(x, z);
    a.group.visible = life > 0.16 && (!swimming || isWater(tile.biome));
    if (!a.group.visible) return;

    const bob = Math.sin(a.phase + a.age * (swimming ? 9 : 2.6));
    const y = swimming ? tile.height + 0.06 + bob * 0.035 : Math.max(tile.height, a.y) + 2.1 + bob * 0.3;
    a.group.position.set(x, y, z);
    a.group.rotation.y = Math.atan2(-Math.sin(angle) * a.direction, Math.cos(angle) * a.direction * 0.8);
    a.group.scale.setScalar(Math.min(1, a.age * 2, (a.duration - a.age) * 2, (life - 0.16) * 3));
    if (swimming) a.parts[0]!.rotation.y = bob * 0.53;
    else {
      const flap = Math.sin(a.age * 23 + a.phase) * (0.26 + 0.45 * Math.max(0, Math.sin(a.age * 2 + a.phase)));
      a.parts[0]!.rotation.z = -flap;
      a.parts[1]!.rotation.z = flap;
    }
  }

  return {
    root,
    update(dt: number, focus: Point, zoom: number) {
      wait -= dt;
      if (wait <= 0) {
        visit(focus, zoom);
        wait = rng.range(0.9, 2.8);
      }
      for (const a of birds) pose(a, dt, focus, zoom, false);
      for (const a of fish) pose(a, dt, focus, zoom, true);
    },
    dispose() {
      bodyGeometry.dispose();
      wingGeometry.dispose();
      for (const material of [heron, swallow, carp, silver]) material.dispose();
    },
  };
}
