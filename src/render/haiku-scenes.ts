import * as THREE from "three";
import { createRng, type Rng } from "../core";
import type { HaikuSceneKind, Monument, MonumentPlan, Obstacles, Point, Terrain } from "../world";
import { deadOf } from "./vitality-mesh";

const TAU = 2 * Math.PI;
const FACET = new THREE.IcosahedronGeometry(1);
const TIMBER = 0x64473b;

function scenery() {
  const root = new THREE.Group();
  const materials = new Map<number, { material: THREE.MeshStandardMaterial; live: THREE.Color; dead: THREE.Color }>();
  let lastLife = -1;

  function mesh(geometry: THREE.BufferGeometry, hex: number, x: number, y: number, z: number) {
    let colors = materials.get(hex);
    if (!colors) {
      const live = new THREE.Color(hex);
      colors = { material: new THREE.MeshStandardMaterial({ flatShading: true }), live, dead: deadOf(live) };
      materials.set(hex, colors);
    }
    const piece = new THREE.Mesh(geometry, colors.material);
    piece.position.set(x, y, z);
    root.add(piece);
    return piece;
  }

  return {
    root,
    box(w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
      return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
    },
    cylinder(top: number, base: number, height: number, sides: number, color: number, x: number, y: number, z: number) {
      return mesh(new THREE.CylinderGeometry(top, base, height, sides), color, x, y, z);
    },
    facet(color: number, x: number, y: number, z: number, w: number, h: number, d: number) {
      const piece = mesh(FACET, color, x, y, z);
      piece.scale.set(w, h, d);
      return piece;
    },
    tint(life: number) {
      if (life === lastLife) return;
      lastLife = life;
      for (const { material, live, dead } of materials.values()) material.color.copy(dead).lerp(live, life);
    },
  };
}

type Scenery = ReturnType<typeof scenery>;
type SceneFrame = (life: number, age: number, bellAge: number) => void;
type BuildScene = (art: Scenery, rng: Rng, ground: (x: number, z: number) => number) => SceneFrame;

function branch(art: Scenery, from: THREE.Vector3, to: THREE.Vector3, radius: number, color: number) {
  const direction = to.clone().sub(from);
  const mid = from.clone().lerp(to, 0.5);
  const beam = art.cylinder(radius * 0.65, radius, direction.length(), 6, color, mid.x, mid.y, mid.z);
  beam.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction.normalize());
  beam.castShadow = true;
}

const oldPond: BuildScene = (art, rng) => {
  // The curved bank is open toward the monument, leaving a gap for the boat.
  for (let i = 0; i < 13; i++) {
    const angle = 0.25 + i * 3.9 / 12;
    const x = Math.cos(angle) * rng.range(1.65, 2.02);
    const z = -Math.sin(angle) * rng.range(1.30, 1.65);
    const rock = art.facet(i % 3 === 0 ? 0x6b8072 : 0x727d7a, x, 0.11, z, rng.range(0.23, 0.44), rng.range(0.12, 0.29), 0.29);
    rock.rotation.y = rng.range(0, TAU);
    rock.rotation.z = rng.range(-0.30, 0.30);
    if (i % 6 === 0) rock.scale.multiplyScalar(1.3);
    if (i % 3 === 1) {
      for (let j = 0; j < 4; j++) {
        const reed = art.cylinder(0.012, 0.034, rng.range(0.32, 0.67), 4, j % 2 ? 0x84a85c : 0x537954,
          x + rng.range(-0.15, 0.15), 0.26, z + rng.range(-0.13, 0.13));
        reed.rotation.z = rng.range(-0.30, 0.30);
      }
    }
  }

  const pads = [[-1.13, -0.26], [-0.55, -0.83], [0.24, -0.61], [1.01, -0.24], [-0.61, 0.47], [0.71, 0.53]]
    .map(([x, z], i) => {
      const radius = rng.range(0.25, 0.41);
      const pad = art.cylinder(radius, radius * 0.94, 0.045, 7, i % 2 ? 0x799a52 : 0x508c64, x, 0.125, z);
      pad.scale.z = 0.84;
      pad.rotation.y = rng.range(0, TAU);
      return pad;
    });
  const flower = new THREE.Group();
  flower.add(art.facet(0xf4c75d, 0, 0.07, 0, 0.057, 0.057, 0.057));
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    flower.add(art.facet(i % 2 ? 0xfce3cf : 0xec9ead, Math.cos(angle) * 0.10, 0.045, Math.sin(angle) * 0.10, 0.09, 0.06, 0.08));
  }
  pads[2].add(flower);

  const frog = new THREE.Group();
  frog.add(art.facet(0x81a651, 0, 0.09, 0, 0.19, 0.12, 0.23));
  frog.add(art.facet(0xcbd489, 0, 0.14, 0.125, 0.145, 0.072, 0.12));
  for (const side of [-1, 1]) {
    frog.add(art.facet(0x7d9851, side * 0.14, 0.052, -0.067, 0.12, 0.064, 0.14));
    frog.add(art.facet(0xe8ce77, side * 0.09, 0.21, 0.153, 0.052, 0.052, 0.054));
    frog.add(art.facet(0x2e3c2a, side * 0.09, 0.212, 0.19, 0.026, 0.03, 0.022));
  }
  art.root.add(frog);

  const ripples = [0, 0.13].map((delay) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xdcf8ed, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 24), material);
    mesh.rotation.x = -Math.PI / 2;
    art.root.add(mesh);
    return { mesh, delay };
  });

  return (life, age) => {
    const cycle = Math.floor(age / 6);
    const elapsed = age % 6;
    const from = pads[cycle % 2 ? 3 : 0].position;
    const to = pads[cycle % 2 ? 0 : 3].position;
    const jump = THREE.MathUtils.clamp((elapsed - 1.4) / 0.7, 0, 1);
    frog.position.lerpVectors(from, to, jump);
    frog.position.y += 0.04 + Math.sin(Math.PI * jump) * 0.82;
    frog.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    frog.scale.setScalar(THREE.MathUtils.smoothstep(life, 0.18, 0.56));
    frog.visible = life > 0.18;
    flower.scale.setScalar(life);
    for (const { mesh, delay } of ripples) {
      const spread = (elapsed - 2.1 - delay) / 1.04;
      mesh.visible = frog.visible && spread > 0 && spread < 1;
      if (mesh.visible) {
        mesh.position.set(to.x, 0.117, to.z);
        mesh.scale.setScalar(0.17 + spread * 0.93);
        mesh.material.opacity = 0.63 * life * (1 - spread);
      }
    }
  };
};

const cherryBell: BuildScene = (art, rng, ground) => {
  const trunk = new THREE.Vector3(-1.27, ground(-1.27, -0.24), -0.24);
  const fork = trunk.clone().add(new THREE.Vector3(-0.21, 1.38, -0.03));
  const crown = [
    [-0.85, 0.87, 0.15], [-0.22, 1.40, -0.38], [0.46, 1.10, 0.18],
    [0.91, 0.71, -0.23], [-0.42, 0.67, -0.80], [0.14, 0.81, 0.73],
  ];
  branch(art, trunk, fork, 0.19, TIMBER);
  for (const [x, y, z] of crown) {
    const tip = fork.clone().add(new THREE.Vector3(x, y, z));
    branch(art, fork, tip, 0.074, TIMBER);
    for (let i = 0; i < 5; i++) {
      const size = rng.range(0.30, 0.64);
      const bloom = art.facet(rng.pick([0xe893a7, 0xf5bdc5, 0xfbd9d9, 0xdd83a0]), tip.x + rng.range(-0.29, 0.29),
        tip.y + rng.range(-0.22, 0.28), tip.z + rng.range(-0.31, 0.31), size, size * 0.71, size * 0.88);
      bloom.rotation.y = rng.range(0, TAU);
      bloom.castShadow = true;
    }
  }

  const x = 1.04;
  const z = -0.18;
  const floor = ground(x, z);
  const frame = 0x834f41;
  art.box(1.72, 0.13, 1.13, 0x8b8980, x, floor + 0.035, z);
  for (const side of [-1, 1]) {
    art.box(0.15, 1.85, 0.17, frame, x + side * 0.67, floor + 0.99, z).castShadow = true;
    art.box(0.28, 0.20, 0.30, 0x878475, x + side * 0.67, floor + 0.13, z);
    const roof = art.box(1.83, 0.09, 0.64, 0x504e55, x, floor + 2.07, z + side * 0.29);
    roof.rotation.x = side * 0.26;
    roof.castShadow = true;
    art.box(1.88, 0.055, 0.07, 0x68636a, x, floor + 1.99, z + side * 0.59);
  }
  art.box(1.59, 0.14, 0.24, frame, x, floor + 1.83, z);
  art.box(1.90, 0.10, 0.09, 0x55525b, x, floor + 2.17, z);
  art.cylinder(0.04, 0.04, 0.17, 6, 0x766048, x, floor + 1.69, z);

  const bell = new THREE.Group();
  bell.position.set(x, floor + 1.64, z);
  bell.add(art.cylinder(0.23, 0.32, 0.62, 12, 0x66867a, 0, -0.42, 0));
  bell.add(art.cylinder(0.26, 0.26, 0.08, 12, 0x79866c, 0, -0.16, 0));
  bell.add(art.cylinder(0.35, 0.37, 0.09, 12, 0x858c71, 0, -0.74, 0));
  bell.add(art.cylinder(0.30, 0.30, 0.027, 12, 0x334f48, 0, -0.793, 0));
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9;
    bell.add(art.facet(0xa1a288, 0.27 * Math.cos(a), -0.44, 0.27 * Math.sin(a), 0.033, 0.039, 0.033));
  }
  art.root.add(bell);

  const petals = Array.from({ length: 24 }, () => {
    const petal = art.facet(rng.pick([0xfbe1d7, 0xf6b4c7, 0xe893a7]), 0, 0, 0, 0.072, 0.020, 0.048);
    return { petal, phase: rng.next(), x: rng.range(-2.6, 0.38), z: rng.range(-1.25, 0.82), speed: rng.range(0.16, 0.30) };
  });

  return (life, age, bellAge) => {
    bell.rotation.x = Math.exp(-bellAge * 1.15) * Math.sin(bellAge * 9) * 0.21;
    for (const { petal, phase, x, z, speed } of petals) {
      const t = (phase + age * speed) % 1;
      petal.visible = life > phase && life > 0.13;
      petal.position.set(x + 1.43 * t + Math.sin(t * TAU + phase * 10) * 0.24, 2.72 - 2.67 * t, z + 0.76 * t);
      petal.rotation.set(age * 1.3 + phase * TAU, phase * TAU, t * TAU);
    }
  };
};

const snowBridge: BuildScene = (art, rng, ground) => {
  // Each board follows the existing trail so the bridge is naturally walkable.
  const waterWidth = 0.68;
  for (let i = -8; i <= 8; i++) {
    const z = i * 0.27;
    const x = Math.sin(i * 0.38) * 0.32;
    const water = art.box(waterWidth, 0.022, 0.29, i % 3 ? 0x829eae : 0x758f9e, x, ground(x, z) + 0.036, z);
    water.rotation.y = Math.cos(i * 0.38) * 0.23;
    if (i % 2) {
      const rockX = x + (i % 3 ? -0.44 : 0.46);
      art.facet(0x99a9b4, rockX, ground(rockX, z) + 0.05, z, 0.19, 0.16, 0.22);
      art.facet(0xdde9ed, rockX, ground(rockX, z) + 0.15, z, 0.15, 0.065, 0.18);
    }
  }
  for (let i = -5; i <= 5; i++) {
    const x = i * 0.25;
    const y = ground(x, 0);
    const board = art.box(0.236, 0.12, rng.range(0.88, 0.99), i % 3 === 0 ? 0x9c816e : 0x7d665b, x, y + 0.085, 0);
    board.rotation.y = rng.range(-0.035, 0.035);
    if (i % 3 !== 1) art.box(0.19, 0.038, 0.15, 0xe2ebed, x, y + 0.158, (i % 2 ? -1 : 1) * 0.35);
  }
  for (const z of [-0.53, 0.53]) {
    for (const x of [-1.10, 0, 1.10]) {
      art.box(0.095, 0.53, 0.10, TIMBER, x, ground(x, z) + 0.29, z);
      art.box(0.12, 0.06, 0.12, 0xdce8ef, x, ground(x, z) + 0.58, z);
    }
    for (const x of [-1.17, 0]) {
      branch(art, new THREE.Vector3(x, ground(x, z) + 0.43, z),
        new THREE.Vector3(x + 1.17, ground(x + 1.17, z) + 0.43, z), 0.045, 0x967465);
    }
  }

  const flakes = Array.from({ length: 34 }, () => {
    const size = rng.range(0.027, 0.054);
    const flake = art.facet(0xf4f9ff, 0, 0, 0, size, size, size);
    return { flake, x: rng.range(-2, 2), z: rng.range(-2, 2), phase: rng.next(), speed: rng.range(0.16, 0.38) };
  });

  return (life, age) => {
    for (const { flake, phase, x, z, speed } of flakes) {
      const t = (phase + age * speed) % 1;
      flake.visible = life > phase && life > 0.08;
      flake.position.set(x + 0.54 * t, ground(x, z) + 2.85 * (1 - t), z + Math.sin(t * TAU + 6 * phase) * 0.22);
      flake.rotation.z = age + phase * TAU;
    }
  };
};

const BUILDERS: Readonly<Record<HaikuSceneKind, BuildScene>> = {
  "old-pond": oldPond,
  "cherry-bell": cherryBell,
  "snow-bridge": snowBridge,
};

function sceneAnchor(terrain: Terrain, obstacles: Obstacles, monument: Monument): Point {
  const biome = terrain.tileAtPoint(monument.x, monument.z).biome;
  let best: Point = monument;
  let bestScore = Infinity;
  for (let i = 0; i < 8; i++) {
    // Prefer the far side of the monument from the default camera.
    const angle = (-3 + i) * TAU / 8;
    const x = monument.x + Math.cos(angle) * 3.65;
    const z = monument.z + Math.sin(angle) * 3.65;
    const height = terrain.groundAt(x, z);
    let score = i * 0.065 + Math.abs(height - monument.y);
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const tile = terrain.tileAtPoint(x + dx, z + dz);
      score += Math.abs(terrain.groundAt(x + dx, z + dz) - height);
      if (tile.biome !== biome || terrain.world.regionAt(x + dx, z + dz).id !== monument.regionId) score += 30;
    }
    // Leave space for the set piece, and keep large props out of its foreground.
    const foreground = 1.4;
    score += 4 * obstacles.near(x, z, 2.05).length;
    score += obstacles.near(x + foreground, z + foreground, 1.45).length;
    if (score < bestScore) {
      best = { x, z };
      bestScore = score;
    }
  }
  return best;
}

export function createHaikuScenes(
  terrain: Terrain,
  monuments: MonumentPlan,
  obstacles: Obstacles,
  lifeAtPoint: (x: number, z: number) => number,
  onBell: () => void,
) {
  const root = new THREE.Group();
  const scenes = monuments.all.flatMap((monument) => {
    if (!monument.scene) return [];
    const anchor = sceneAnchor(terrain, obstacles, monument);
    const y = terrain.groundAt(anchor.x, anchor.z);
    const localGround = (x: number, z: number): number => terrain.groundAt(anchor.x + x, anchor.z + z) - y;
    const art = scenery();
    const tick = BUILDERS[monument.scene](art, createRng(monument.id + terrain.world.seed), localGround);
    art.root.position.set(anchor.x, y, anchor.z);
    root.add(art.root);
    return [{ monument, anchor, art, tick, age: 0, bellAge: 10, rang: false }];
  });
  return {
    root,
    update(dt: number, focus: Point, viewSize: number, awakening: { regionId: string; progress: number } | null) {
      for (const scene of scenes) {
        const { anchor, monument, art, tick } = scene;
        const active = awakening?.regionId === monument.regionId;
        if (!active) scene.rang = false;
        art.root.visible = Math.hypot(anchor.x - focus.x, anchor.z - focus.z) < viewSize * 1.2 + 4;
        if (!art.root.visible && !active) continue;

        const life = lifeAtPoint(anchor.x, anchor.z);
        if (monument.scene === "cherry-bell" && active && !scene.rang && life >= 0.5 && awakening.progress < 1) {
          scene.rang = true;
          scene.bellAge = 0;
          onBell();
        }
        scene.age = life > 0 ? scene.age + dt : 0;
        scene.bellAge = Math.min(scene.bellAge + dt, 10);
        if (!art.root.visible) continue;
        art.tint(life);
        tick(life, scene.age, scene.bellAge);
      }
    },
  };
}
