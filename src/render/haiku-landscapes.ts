import * as THREE from "three";
import { blade, branch, TAU, TIMBER, type BuildScene, type Scenery } from "./haiku-scenery";

function wind(age: number): number {
  return 0.24 * Math.sin(age * 2.1) + Math.pow(0.5 + 0.5 * Math.sin(age * 0.81), 4);
}

export const bambooThicket: BuildScene = (art, rng, ground) => {
  const stalks = [
    [-1.45, -0.47], [-1.32, -1.23], [-0.75, -0.80], [-0.76, 0.06], [-0.14, -1.46],
    [-0.02, -0.70], [0.40, -0.98], [0.74, -0.29], [0.91, 0.35], [1.22, -0.55],
    [-0.88, 0.66], [1.39, 0.05],
  ].map(([x, z], i) => {
    const stalk = new THREE.Group();
    stalk.position.set(x, ground(x, z), z);
    const height = rng.range(1.8, 3.75);
    const radius = rng.range(0.052, 0.078);
    const green = rng.pick([0x8ca764, 0x6d8c58, 0xa4b66b, 0x789150]);
    const trunk = art.cylinder(radius * 0.66, radius, height, 6, green, 0, height / 2, 0);
    trunk.castShadow = true;
    stalk.add(trunk);
    for (let j = 1; j <= 5; j++) {
      const ringRadius = radius * (1.08 - 0.053 * j);
      stalk.add(art.cylinder(ringRadius, ringRadius, 0.033, 6, 0x546746, 0, height * (j / 6), 0));
    }
    for (let j = 0; j < 3; j++) {
      const bough = new THREE.Group();
      const angle = rng.range(0, TAU);
      bough.rotation.y = angle;
      bough.position.y = height * (0.54 + j * 0.16);
      const length = rng.range(0.30, 0.57);
      bough.add(branch(art, new THREE.Vector3(), new THREE.Vector3(length, 0.10, 0), 0.018, green, false));
      for (let k = 0; k < 4; k++) {
        const leaf = blade(art, rng.pick([0x8aab61, 0xacc879, 0x648e52]), length * (0.36 + k * 0.22), 0.08, 0,
          rng.range(0.14, 0.20), rng.range(0.32, 0.47));
        leaf.rotation.set(k % 2 ? 0.65 : -0.56, k * 0.63, -1.12 + k * 0.43);
        bough.add(leaf);
      }
      stalk.add(bough);
    }
    art.root.add(stalk);
    return { stalk, lean: rng.range(-0.19, 0.14), phase: i * 0.81 };
  });
  const looseLeaves = Array.from({ length: 11 }, () => {
    const leaf = blade(art, rng.pick([0xadd07a, 0xccd489, 0x85a75e]), 0, 0, 0, 0.08, 0.23);
    return { leaf, start: rng.next(), y: rng.range(0.65, 2.85), z: rng.range(-1.25, 1.0), speed: rng.range(0.35, 0.67) };
  });

  return (life, age) => {
    const gust = wind(age);
    for (const { stalk, lean, phase } of stalks) {
      stalk.rotation.x = 0.07 * Math.cos(phase) + life * gust * 0.09;
      stalk.rotation.z = lean - life * (gust * 0.23 + Math.sin(age * 2 + phase) * 0.035);
    }
    for (const { leaf, start, y, z, speed } of looseLeaves) {
      const t = (start + age * speed) % 1;
      leaf.visible = life > start && gust > 0.26;
      leaf.position.set(-1.72 + t * 3.55, y - t * 0.55 + Math.sin(t * TAU + start * TAU) * 0.20, z + t * 0.62);
      leaf.rotation.set(age * 3 + start * TAU, 0.45, -0.82);
      leaf.scale.x = 0.08 * Math.sin(t * Math.PI);
    }
  };
};

export const roadsideJizo: BuildScene = (art, rng, ground) => {
  const plinthY = ground(-0.52, -0.34);
  const x = -0.52;
  const z = -0.34;
  const stone = 0x969c94;
  art.box(0.96, 0.14, 0.80, 0x777f75, x, plinthY + 0.03, z);
  art.box(0.77, 0.15, 0.65, 0xa1a69e, x, plinthY + 0.145, z);
  const robe = art.cylinder(0.18, 0.34, 0.78, 8, stone, x, plinthY + 0.53, z);
  robe.castShadow = true;
  art.facet(0xabada0, x, plinthY + 1.11, z + 0.02, 0.24, 0.245, 0.22).castShadow = true;
  const bib = art.mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.29, 8, 1, true, Math.PI * 0.06, Math.PI * 0.88),
    0xad584d, x, plinthY + 0.72, z + 0.025);
  bib.material.side = THREE.DoubleSide;
  art.facet(0xb9b6a4, x, plinthY + 0.58, z + 0.26, 0.088, 0.115, 0.055);
  for (const side of [-1, 1]) {
    const eye = art.box(0.048, 0.018, 0.035, 0x59625b, x + side * 0.076, plinthY + 1.11, z + 0.208);
    eye.rotation.z = side * 0.15;
  }
  for (let i = 0; i < 7; i++) {
    const px = rng.range(-1.31, 0.80);
    const pz = rng.range(0.65, 1.42);
    art.facet(rng.pick([0x9f9a8c, 0x838b78, 0xb2a999]), px, ground(px, pz) + 0.035, pz,
      rng.range(0.15, 0.29), 0.08, rng.range(0.12, 0.23));
  }
  const lx = 0.72;
  const lz = -0.11;
  const ly = ground(lx, lz);
  art.cylinder(0.12, 0.28, 0.21, 6, 0x858d7d, lx, ly + 0.11, lz);
  art.cylinder(0.095, 0.12, 0.52, 6, stone, lx, ly + 0.42, lz);
  art.box(0.41, 0.10, 0.41, stone, lx, ly + 0.70, lz);
  for (const dx of [-0.14, 0.14]) for (const dz of [-0.14, 0.14]) {
    art.box(0.052, 0.23, 0.052, 0x777e73, lx + dx, ly + 0.83, lz + dz);
  }
  const cap = art.cylinder(0.10, 0.37, 0.21, 4, 0x777c71, lx, ly + 1.04, lz);
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  art.facet(0x9b9e88, lx, ly + 1.18, lz, 0.10, 0.087, 0.10);

  const flame = art.facet(0xffb747, lx, ly + 0.813, lz, 0.087, 0.16, 0.087);
  const flameSize = flame.scale.clone();
  flame.material.emissive.setHex(0xff9c36);
  flame.material.emissiveIntensity = 0.65;
  const lightPool = new THREE.CircleGeometry(0.78, 24);
  const lightColors = Array.from({ length: lightPool.getAttribute("position").count }, (_, i) => [1, 1, 1, i === 0 ? 1 : 0]);
  lightPool.setAttribute("color", new THREE.Float32BufferAttribute(lightColors.flat(), 4));
  const pool = new THREE.Mesh(lightPool, new THREE.MeshBasicMaterial({
    color: 0xf3af59, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(lx, ly + 0.027, lz);
  art.root.add(pool);

  return (life, age) => {
    const flicker = 0.94 + Math.sin(age * 19) * 0.065 + Math.sin(age * 11) * 0.035;
    flame.visible = pool.visible = life > 0.25;
    const lit = THREE.MathUtils.smoothstep(life, 0.25, 0.78);
    flame.scale.copy(flameSize).multiplyScalar(lit * flicker);
    pool.material.opacity = lit * flicker * 0.24;
  };
};

export const silverGrass: BuildScene = (art, rng, ground) => {
  const outcrop = [[-1.50, -0.58], [-0.80, -0.88], [-0.22, -1.10], [0.58, -1.25], [1.24, -0.94]];
  for (const [i, [x, z]] of outcrop.entries()) {
    const boulder = art.facet(i % 2 ? 0x92928f : 0x747c83, x, ground(x, z) + 0.24, z,
      rng.range(0.40, 0.65), rng.range(0.43, 0.85), rng.range(0.38, 0.60));
    boulder.rotation.set(0.11 * i, rng.range(0, TAU), rng.range(-0.38, 0.38));
    boulder.castShadow = true;
  }
  const bunches = [[-1.45, 0.37], [-0.97, -0.30], [-0.48, 0.32], [-0.20, 0.96], [0.36, 0.04], [0.80, 0.57], [1.35, -0.19], [1.50, 0.49]]
    .map(([x, z], i) => {
      const bunch = new THREE.Group();
      bunch.position.set(x, ground(x, z), z);
      for (let j = 0; j < 4; j++) {
        const height = rng.range(0.67, 1.2) + (i % 3 === 1 ? 0.23 : 0);
        const stemX = rng.range(-0.15, 0.15);
        const stemZ = rng.range(-0.13, 0.13);
        const bend = rng.range(0.065, 0.20);
        bunch.add(branch(art, new THREE.Vector3(stemX, 0, stemZ), new THREE.Vector3(stemX + bend, height, stemZ),
          0.012, 0xa69361, false));
        const plume = art.facet(j % 3 ? 0xe2d4b0 : 0xc8b79a, stemX + bend + 0.08, height + 0.08, stemZ,
          rng.range(0.046, 0.073), rng.range(0.16, 0.26), 0.046);
        plume.rotation.z = rng.range(-0.66, -0.28);
        bunch.add(plume);
        const leaf = blade(art, j % 2 ? 0xa19063 : 0x777e52, stemX, 0.09, stemZ, 0.085, height * 0.49);
        leaf.rotation.set(0, rng.range(0, TAU), rng.range(-0.92, -0.38));
        bunch.add(leaf);
      }
      art.root.add(bunch);
      return { bunch, phase: i * 0.65 };
    });

  return (life, age) => {
    const gust = wind(age);
    for (const { bunch, phase } of bunches) {
      bunch.rotation.z = -life * (0.31 * gust + 0.07 * Math.sin(age * 3.8 - phase));
      bunch.rotation.x = life * 0.12 * Math.sin(age * 2.4 - phase);
    }
  };
};

function riverHouse(art: Scenery, x: number, z: number, scale: number, roofColor: number) {
  const house = new THREE.Group();
  house.position.set(x, 0.33, z);
  house.scale.setScalar(scale);
  const post = (dx: number, dz: number) => art.box(0.10, 0.63, 0.10, TIMBER, dx, 0.01, dz);
  for (const dx of [-0.56, 0.56]) for (const dz of [-0.38, 0.38]) house.add(post(dx, dz));
  house.add(art.box(1.44, 0.12, 1.09, TIMBER, 0, 0.34, 0));
  house.add(art.box(1.27, 0.72, 0.91, 0xc6ad88, 0, 0.73, -0.05));
  house.add(art.box(0.27, 0.51, 0.043, 0x724f3c, -0.30, 0.647, 0.423));
  house.add(art.box(0.36, 0.32, 0.04, 0x66473c, 0.27, 0.77, 0.42));
  house.add(art.box(0.27, 0.24, 0.038, 0xdfb27d, 0.27, 0.77, 0.444));
  house.add(art.box(0.033, 0.27, 0.05, TIMBER, 0.27, 0.77, 0.465));
  house.add(art.box(1.39, 0.12, 0.94, TIMBER, 0, 1.06, -0.05));
  for (const side of [-1, 1]) {
    const roof = art.box(1.61, 0.081, 0.72, roofColor, 0, 1.214, side * 0.303 - 0.05);
    roof.rotation.x = side * 0.41;
    roof.castShadow = true;
    house.add(roof);
    house.add(art.box(1.67, 0.071, 0.067, roofColor, 0, 1.08, side * 0.63 - 0.05));
  }
  house.add(art.box(1.70, 0.10, 0.09, roofColor, 0, 1.36, -0.05));
  art.root.add(house);
}

export const riverHouses: BuildScene = (art, rng) => {
  for (let i = 0; i < 13; i++) {
    const x = -2.02 + i * 0.34;
    const z = rng.range(-0.88, -0.51);
    const bank = art.facet(i % 3 ? 0x748276 : 0x8a8a76, x, 0.063, z, rng.range(0.45, 0.76), rng.range(0.12, 0.24), rng.range(0.53, 0.80));
    bank.rotation.y = rng.range(0, TAU);
  }
  riverHouse(art, -1.00, -0.61, 1, 0x465660);
  riverHouse(art, 0.85, -0.64, 0.84, 0x6b5751);
  const rain = Array.from({ length: 72 }, () => ({
    x: rng.range(-2.35, 2.1), z: rng.range(-1.5, 1.9), phase: rng.next(), speed: rng.range(0.95, 1.72),
  }));
  const streaks = new Float32Array(rain.length * 6);
  const streakGeometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(streaks, 3).setUsage(THREE.DynamicDrawUsage);
  streakGeometry.setAttribute("position", positions);
  const streakMaterial = new THREE.LineBasicMaterial({ color: 0xd9e7ee, transparent: true, depthWrite: false });
  const shower = new THREE.LineSegments(streakGeometry, streakMaterial);
  shower.frustumCulled = false;
  art.root.add(shower);

  const ring = new THREE.RingGeometry(0.92, 1, 20);
  const ripples = Array.from({ length: 8 }, () => {
    const mesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xe1f4ef, transparent: true, depthWrite: false }));
    mesh.position.set(rng.range(-2.0, 2.0), 0.10, rng.range(0.32, 1.92));
    mesh.rotation.x = -Math.PI / 2;
    art.root.add(mesh);
    return { mesh, phase: rng.next() };
  });
  return (life, age) => {
    shower.visible = life > 0.12;
    streakMaterial.opacity = life * 0.58;
    for (const [i, { x, z, phase, speed }] of rain.entries()) {
      const y = (1 - ((phase + age * speed) % 1)) * 3.5;
      const drift = 0.19 * y;
      positions.setXYZ(i * 2, x - drift, y, z);
      positions.setXYZ(i * 2 + 1, x - drift - 0.053, y + 0.28, z - 0.027);
    }
    positions.needsUpdate = true;
    for (const { mesh, phase } of ripples) {
      const t = (phase + age * 0.88) % 1;
      mesh.visible = life > phase;
      mesh.scale.setScalar(0.06 + t * 0.35);
      mesh.material.opacity = 0.51 * life * (1 - t);
    }
  };
};

export const daffodilSnow: BuildScene = (art, rng, ground) => {
  const flowers = [[-1.30, -0.49], [-1.38, 0.42], [-0.63, -0.15], [-0.31, -0.78], [0.19, 0.45],
    [0.53, -0.22], [0.91, 0.37], [1.33, -0.50], [1.50, 0.20]].map(([x, z], i) => {
    const plant = new THREE.Group();
    const y = ground(x, z);
    plant.position.set(x, y + 0.025, z);
    const h = rng.range(0.50, 0.93);
    const stem = art.cylinder(0.015, 0.022, h, 5, 0x528052, 0, h * 0.50, 0);
    plant.add(stem);
    const leaves = [-1, 1].map((side) => {
      const leaf = blade(art, side < 0 ? 0x668c63 : 0x487252, 0, h * 0.18, 0, 0.135, h * rng.range(0.55, 0.78));
      leaf.rotation.y = side * 1.20;
      plant.add(leaf);
      return { leaf, side };
    });
    const bloom = new THREE.Group();
    bloom.position.y = h;
    bloom.rotation.set(rng.range(-0.19, 0.36), rng.range(-0.86, 0.89), rng.range(-0.24, 0.28));
    for (let j = 0; j < 6; j++) {
      const angle = j * TAU / 6;
      const petal = art.facet(j % 2 ? 0xffe990 : 0xfff1b4, Math.cos(angle) * 0.121, Math.sin(angle) * 0.121, 0,
        0.116, 0.082, 0.039);
      petal.rotation.z = angle;
      bloom.add(petal);
    }
    const trumpet = art.cylinder(0.105, 0.058, 0.135, 9, 0xf3af35, 0, 0, 0.075);
    trumpet.rotation.x = Math.PI / 2;
    bloom.add(trumpet);
    const throat = art.cylinder(0.074, 0.074, 0.005, 9, 0xbb7832, 0, 0, 0.145);
    throat.rotation.x = Math.PI / 2;
    bloom.add(throat);
    plant.add(bloom);
    art.root.add(plant);
    const frost = art.facet(0xebf2f5, x - 0.12, y + 0.036, z - 0.075, 0.23, 0.074, 0.21);
    frost.rotation.y = i;
    return { plant, bloom, leaves, phase: i * 0.40 };
  });
  const flakes = Array.from({ length: 18 }, () => ({
    mesh: art.facet(0xf4f9ff, 0, 0, 0, 0.035, 0.036, 0.035),
    x: rng.range(-1.85, 1.85), z: rng.range(-1.0, 1.4), phase: rng.next(), speed: rng.range(0.12, 0.29),
  }));
  return (life, age) => {
    const open = THREE.MathUtils.smoothstep(life, 0.15, 0.83);
    for (const { plant, bloom, leaves, phase } of flowers) {
      plant.rotation.z = life * (Math.sin(age * 1.95 + phase) * 0.079 - 0.20 * wind(age));
      bloom.scale.setScalar(0.26 + open * 0.74);
      for (const { leaf, side } of leaves) {
        leaf.rotation.z = side * (0.25 + open * (0.34 + Math.sin(age * 1.1 + phase) * 0.16));
      }
    }
    for (const { mesh, x, z, phase, speed } of flakes) {
      const t = (phase + age * speed) % 1;
      mesh.visible = life > phase;
      mesh.position.set(x + 0.45 * t, ground(x, z) + (1 - t) * 1.94, z + 0.20 * Math.sin(t * TAU + phase * TAU));
    }
  };
};
