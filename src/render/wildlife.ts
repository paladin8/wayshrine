import * as THREE from "three";
import { createRng } from "../core";
import { isWater, type Point, type Terrain } from "../world";
import { BIRDS_BY_BIOME, LAKE_FISH, SEA_FISH, type BirdForm, type FishForm } from "./wildlife-forms";

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

interface Animal {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh;
  readonly parts: readonly THREE.Mesh[];
  readonly tail: THREE.Mesh;
  x: number;
  z: number;
  y: number;
  age: number;
  duration: number;
  phase: number;
  radius: number;
  direction: number;
}
interface Bird extends Animal {
  readonly head: THREE.Mesh;
  readonly beak: THREE.Mesh;
  form: BirdForm;
}
interface Fish extends Animal {
  form: FishForm;
}

const firstBird = BIRDS_BY_BIOME.meadow[0]!;
const firstFish = LAKE_FISH[0]!;

/** Small, pooled animals whose visits start on ground or water touched by the restoration wave. */
export function createWildlife(terrain: Terrain, lifeAtPoint: (x: number, z: number) => number) {
  const root = new THREE.Group();
  root.name = "Restored wildlife";
  const rng = createRng(terrain.world.seed).fork("wildlife");
  const range = createRng(terrain.world.seed).fork("wildlife range");
  const bodyGeometry = new THREE.IcosahedronGeometry(1);
  const beakGeometry = new THREE.ConeGeometry(1, 1, 4).rotateX(Math.PI / 2);
  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0.15, 0.27, 0, 0.04, 0.13, 0, -0.23,
    0.27, 0, 0.04, 0.46, 0, -0.09, 0.13, 0, -0.23,
  ], 3));
  wingGeometry.computeVertexNormals();
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  function material(color: number): THREE.MeshStandardMaterial {
    let result = materials.get(color);
    if (!result) {
      result = new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide });
      materials.set(color, result);
    }
    return result;
  }

  function animal(swimming: boolean): Animal {
    const group = new THREE.Group();
    const startMaterial = material(swimming ? firstFish.body : firstBird.body);
    const body = new THREE.Mesh(bodyGeometry, startMaterial);
    const tail = new THREE.Mesh(bodyGeometry, startMaterial);
    const parts = [-1, 1].map((side) => {
      const part = new THREE.Mesh(wingGeometry, startMaterial);
      part.scale.x = side;
      group.add(part);
      return part;
    });
    group.add(body, tail);
    group.name = swimming ? "Fish" : "Bird";
    group.visible = false;
    root.add(group);
    return { group, body, parts, tail, x: 0, y: 0, z: 0, age: 0, duration: 0, phase: 0, radius: 0, direction: 1 };
  }

  const birds: Bird[] = Array.from({ length: 5 }, () => {
    const base = animal(false);
    const head = new THREE.Mesh(bodyGeometry, material(firstBird.head));
    const beak = new THREE.Mesh(beakGeometry, material(firstBird.beak));
    base.group.add(head, beak);
    return { ...base, head, beak, form: firstBird };
  });
  const fish: Fish[] = Array.from({ length: 8 }, () => ({ ...animal(true), form: firstFish }));
  const sample = new THREE.Vector3();
  let wait = 0;

  function start(a: Animal, x: number, y: number, z: number, phase: number, radius: number, duration: number): void {
    a.x = x;
    a.y = y;
    a.z = z;
    a.age = 0;
    a.duration = duration;
    a.phase = phase;
    a.radius = radius * rng.range(0.85, 1.10);
  }

  function startBird(a: Bird, form: BirdForm, x: number, y: number, z: number, phase: number): void {
    a.form = form;
    a.body.material = material(form.body);
    a.body.scale.set(0.095, 0.098, 0.19);
    a.head.material = material(form.head);
    a.head.position.set(0, 0.020, 0.145);
    a.head.scale.set(0.061, 0.063, 0.070);
    a.beak.material = material(form.beak);
    a.beak.position.set(0, 0.015, 0.20 + form.bill * 0.038);
    a.beak.scale.set(0.023, 0.025, 0.096 * form.bill);
    a.tail.material = material(form.wings);
    a.tail.position.z = -0.19;
    a.tail.scale.set(0.105, 0.039, form.tail * 0.14);
    for (const [i, wing] of a.parts.entries()) {
      wing.material = material(form.wings);
      wing.scale.set(form.span * (i === 0 ? -1 : 1), 1, 0.73 + form.size * 0.28);
    }
    start(a, x, y, z, phase, form.orbit, rng.range(6, 11));
  }

  function startFish(a: Fish, form: FishForm, x: number, y: number, z: number, phase: number): void {
    a.form = form;
    a.body.material = material(form.body);
    a.body.scale.set(0.12 * form.width, 0.10 * form.depth, 0.28 * form.length);
    a.tail.material = material(form.fins);
    a.tail.position.z = -0.27 * form.length;
    a.tail.scale.set(0.14 * form.tail, 0.037, 0.13 * form.tail);
    for (const [i, fin] of a.parts.entries()) {
      fin.material = a.tail.material;
      const wingspan = form.surfacing >= 1 ? 0.92 : 0.30;
      fin.scale.set(wingspan * (i === 0 ? -1 : 1), 1, 0.55);
    }
    start(a, x, y, z, phase, form.orbit, rng.range(7, 14));
  }

  function visit(focus: Point, zoom: number): void {
    for (let attempt = 0; attempt < 9; attempt++) {
      const angle = rng.range(0, TAU);
      const distance = rng.range(2, 10 + zoom * 12);
      const x = focus.x + Math.cos(angle) * distance;
      const z = focus.z + Math.sin(angle) * distance;
      if (lifeAtPoint(x, z) < 0.78) continue;
      const tile = terrain.tileAtPoint(x, z);
      const local = range.fork(tile.regionId);
      const phase = rng.range(0, TAU);
      const direction = rng.chance(0.5) ? -1 : 1;
      const swimming = isWater(tile.biome);
      if (swimming && rng.chance(0.79)) {
        const free = fish.filter((a) => a.age >= a.duration);
        if (free.length < 2) continue;
        const forms = tile.biome === "sea" ? SEA_FISH : LAKE_FISH;
        const form = rng.chance(0.62) ? local.pick(forms) : rng.pick(forms);
        for (const [i, a] of free.slice(0, form.school).entries()) {
          a.direction = direction;
          startFish(a, form, x + i * 0.28, tile.height, z - i * 0.24, phase + i * 0.30);
        }
      } else {
        const free = birds.filter((a) => a.age >= a.duration);
        if (free.length === 0) continue;
        const forms = BIRDS_BY_BIOME[tile.biome];
        const form = rng.chance(0.7) ? local.pick(forms) : rng.pick(forms);
        if (tile.biome === "volcanic" && !rng.chance(0.14)) continue;
        const count = form.glide >= 0.85 ? 1 : rng.int(1, 4);
        for (const [i, a] of free.slice(0, count).entries()) {
          a.direction = direction;
          startBird(a, form, x + i * 0.8, tile.height, z - i * 0.65, phase + i * 0.47);
        }
      }
      return;
    }
  }

  function pose(a: Animal, dt: number, focus: Point, zoom: number, speed: number, dart: number, swimming: boolean): boolean {
    a.age += dt;
    if (a.age >= a.duration || Math.hypot(a.x - focus.x, a.z - focus.z) > 23 + zoom * 16) {
      a.group.visible = false;
      a.age = a.duration;
      return false;
    }
    const elapsed = a.age * speed;
    const angle = a.phase + (elapsed + Math.sin(elapsed * 1.55) * dart) * a.direction;
    const x = a.x + Math.cos(angle) * a.radius;
    const z = a.z + Math.sin(angle) * a.radius * 0.78;
    const tile = terrain.tileAtPoint(x, z);
    const life = lifeAtPoint(x, z);
    a.group.visible = life > 0.16 && (!swimming || isWater(tile.biome));
    if (!a.group.visible) return false;
    sample.set(x, tile.height, z);
    a.group.position.copy(sample);
    a.group.setRotationFromAxisAngle(UP, Math.atan2(-Math.sin(angle) * a.direction, Math.cos(angle) * a.direction * 0.78));
    a.group.scale.setScalar(Math.min(1, a.age * 2, (a.duration - a.age) * 2, (life - 0.16) * 3));
    return true;
  }

  function updateBird(a: Bird, dt: number, focus: Point, zoom: number): void {
    const form = a.form;
    if (!pose(a, dt, focus, zoom, form.speed * 0.63, 0.16, false)) return;
    const pulse = Math.sin(a.age * 2.1 + a.phase);
    const flap = Math.sin(a.age * form.cadence + a.phase) * Math.max(0.08, 0.70 - form.glide + 0.30 * pulse);
    a.group.position.y = Math.max(a.group.position.y, a.y) + form.altitude + pulse * Math.min(0.3, form.altitude * 0.22);
    a.group.scale.multiplyScalar(form.size);
    a.group.rotateZ(0.12 * a.direction + pulse * 0.13);
    a.parts[0]!.rotation.z = -flap;
    a.parts[1]!.rotation.z = flap;
    a.tail.rotation.x = -pulse * 0.18;
  }

  function updateFish(a: Fish, dt: number, focus: Point, zoom: number): void {
    const form = a.form;
    if (!pose(a, dt, focus, zoom, form.speed * 0.82, form.dart, true)) return;
    const beat = Math.sin(a.phase + a.age * (5.6 + form.speed * 4));
    const rise = form.surfacing >= 1 ? Math.max(0, Math.sin(a.age * 1.3 + a.phase)) ** 10 * 0.5 : 0;
    a.group.position.y += 0.042 + beat * 0.035 * form.surfacing + rise;
    a.tail.rotation.y = beat * (0.33 + form.dart);
    a.parts[0]!.rotation.z = beat * 0.14;
    a.parts[1]!.rotation.z = -beat * 0.14;
  }

  return {
    root,
    update(dt: number, focus: Point, zoom: number) {
      wait -= dt;
      if (wait <= 0) {
        visit(focus, zoom);
        wait = rng.range(0.85, 2.85);
      }
      for (const a of birds) updateBird(a, dt, focus, zoom);
      for (const a of fish) updateFish(a, dt, focus, zoom);
    },
    dispose() {
      bodyGeometry.dispose();
      beakGeometry.dispose();
      wingGeometry.dispose();
      for (const value of materials.values()) value.dispose();
    },
  };
}
