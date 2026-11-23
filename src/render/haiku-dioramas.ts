import * as THREE from "three";
import { blade, branch, TAU, TIMBER, type BuildScene, type Scenery } from "./haiku-scenery";

export const mogamiRapids: BuildScene = (art, rng) => {
  // The boulders frame two channels within the navigable water.
  const rocks = [[-1.12, -1.39], [0.79, -1.24], [1.23, -0.44], [-1.27, 0.62], [-0.13, 0.39], [0.87, 1.05], [-0.87, 1.52]];
  for (const [i, [x, z]] of rocks.entries()) {
    const size = rng.range(0.38, 0.64);
    const rock = art.facet(i % 2 ? 0x738e91 : 0x667a84, x, 0.10, z, size, rng.range(0.28, 0.58), size * 0.79);
    rock.rotation.set(rng.range(-0.31, 0.27), rng.range(0, TAU), rng.range(-0.28, 0.28));
    rock.castShadow = true;
    art.facet(0x89978b, x + 0.19, 0.10, z - 0.17, size * 0.50, 0.18, size * 0.49);
  }

  const foamGeometry = new THREE.BufferGeometry();
  foamGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, -0.50, -0.17, 0, -0.25, 0.09, 0, 0.13,
    -0.17, 0, -0.25, -0.50, 0, 0.50, 0.09, 0, 0.13,
    0, 0, -0.50, 0.20, 0, -0.28, 0.09, 0, 0.13,
    0.20, 0, -0.28, 0.50, 0, 0.50, 0.09, 0, 0.13,
  ], 3));
  const wakes = Array.from({ length: 34 }, (_, i) => {
    const mesh = new THREE.Mesh(foamGeometry, new THREE.MeshBasicMaterial({
      color: i % 3 ? 0xdbf7f1 : 0x99dacd, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    art.root.add(mesh);
    return { mesh, lane: i % 2 ? 0.50 : -0.54, drift: rng.range(-0.31, 0.33), phase: rng.next(),
      speed: rng.range(0.45, 0.76), width: rng.range(0.13, 0.38), length: rng.range(0.36, 0.95) };
  });

  return (life, age) => {
    for (const { mesh, lane, drift, phase, speed, width, length } of wakes) {
      const t = (phase + age * speed) % 1;
      const fade = Math.sin(t * Math.PI);
      const z = -2.23 + t * 4.60;
      const bend = (lane > 0 ? 0.19 : -0.22) * Math.sin(z * 1.64 + 0.35);
      mesh.visible = life > 0.10;
      mesh.position.set(lane + bend + drift, 0.09 + phase * 0.025, z);
      mesh.rotation.y = 0.10 + bend;
      mesh.scale.set(width * (0.78 + 0.30 * t), 1, length * (0.68 + 0.32 * fade));
      mesh.material.opacity = 0.75 * life * fade;
    }
  };
};

export const winterMacaque: BuildScene = (art, rng, ground) => {
  const perch = { x: 0.26, z: 0.34 };
  const perchY = ground(perch.x, perch.z);
  art.facet(0x808888, perch.x, perchY + 0.17, perch.z, 0.95, 0.44, 0.76).castShadow = true;
  for (const [x, z, size] of [[-1.45, -0.63, 0.60], [-0.60, -0.94, 0.78], [0.41, -0.95, 0.59], [1.24, -0.55, 0.43]]) {
    const stone = art.facet(0x8a8985, x, ground(x, z) + size * 0.35, z, size, size * 0.83, size * 0.69);
    stone.rotation.y = rng.range(0, TAU);
    stone.castShadow = true;
  }
  const pine = new THREE.Vector3(-1.16, ground(-1.16, -0.78), -0.78);
  const bend = pine.clone().add(new THREE.Vector3(0.44, 0.98, -0.09));
  branch(art, pine, bend, 0.11, TIMBER);
  for (const [x, y, z] of [[-0.36, 0.62, 0.11], [0.45, 0.52, 0.32], [0.88, 0.42, 0.04], [0.28, 0.71, -0.41]]) {
    const end = bend.clone().add(new THREE.Vector3(x, y, z));
    branch(art, bend, end, 0.051, TIMBER);
    const needles = art.facet(rng.pick([0x536d61, 0x698074, 0x456457]), end.x, end.y, end.z, 0.53, 0.23, 0.43);
    needles.rotation.y = rng.range(0, TAU);
    needles.castShadow = true;
  }

  const monkey = new THREE.Group();
  monkey.position.set(perch.x, perchY + 0.43, perch.z);
  monkey.rotation.y = 0.58;
  art.root.add(monkey);
  monkey.add(art.facet(0x8b7664, 0, 0.41, -0.044, 0.32, 0.44, 0.253));
  monkey.add(art.facet(0xaf9680, 0, 0.40, 0.103, 0.227, 0.29, 0.171));
  for (const side of [-1, 1]) {
    monkey.add(art.facet(0x9e8974, side * 0.22, 0.225, 0.118, 0.145, 0.176, 0.173));
    monkey.add(art.facet(0x736659, side * 0.155, 0.068, 0.251, 0.094, 0.063, 0.121));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.70, 0.01);
  monkey.add(head);
  head.add(art.facet(0xb7a087, 0, 0.032, 0, 0.243, 0.204, 0.209));
  head.add(art.facet(0xc67772, 0, 0.027, 0.146, 0.163, 0.132, 0.116));
  head.add(art.facet(0xc18c80, 0, -0.042, 0.214, 0.130, 0.065, 0.085));
  head.add(art.facet(0x7f514c, 0, -0.015, 0.268, 0.047, 0.031, 0.028));
  for (const side of [-1, 1]) {
    head.add(art.facet(0xa78b75, side * 0.224, 0.035, 0, 0.054, 0.065, 0.048));
    head.add(art.facet(0x4b3d3b, side * 0.066, 0.060, 0.234, 0.027, 0.021, 0.020));
  }
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.19, 0.49, 0.08);
    arm.add(art.facet(0x887568, side * 0.016, -0.127, 0.074, 0.091, 0.201, 0.094));
    arm.add(art.facet(0xa28b78, -side * 0.072, -0.214, 0.178, 0.123, 0.077, 0.099));
    arm.add(art.facet(0x776865, -side * 0.177, -0.195, 0.209, 0.074, 0.053, 0.082));
    monkey.add(arm);
    return arm;
  });

  const rain = Array.from({ length: 32 }, () => {
    const drop = art.facet(0xadbec3, 0, 0, 0, 0.017, rng.range(0.11, 0.20), 0.016);
    drop.rotation.z = -0.20;
    return { drop, phase: rng.next(), x: rng.range(-1.75, 1.73), z: rng.range(-1.1, 1.34), speed: rng.range(0.91, 1.53) };
  });
  return (life, age) => {
    monkey.visible = life > 0.30;
    const cycle = age % 7.6;
    const wipe = THREE.MathUtils.smoothstep(cycle, 3.22, 3.61) * (1 - THREE.MathUtils.smoothstep(cycle, 4.10, 4.61));
    const shiver = 0.016 * Math.sin(age * 31) * Math.sin(age * 1.7) ** 6;
    monkey.rotation.z = life * shiver;
    head.rotation.set(0.14 + 0.14 * wipe + 0.08 * Math.sin(age * 1.32), 0.30 * Math.sin(age * 0.68), -0.06 * wipe);
    arms[1].rotation.x = -0.15 - wipe * 1.45;
    arms[1].rotation.z = wipe * -0.36;
    for (const { drop, phase, x, z, speed } of rain) {
      const t = (phase + age * speed) % 1;
      drop.visible = life > phase && life > 0.12;
      drop.position.set(x + t * 0.40, ground(x, z) + (1 - t) * 2.66, z + t * 0.13);
    }
  };
};

function butterfly(art: Scenery, color: number) {
  const body = new THREE.Group();
  body.add(art.facet(0x817656, 0, 0, 0, 0.024, 0.036, 0.097));
  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Group();
    wing.add(art.facet(color, side * 0.105, 0, 0.008, 0.13, 0.022, 0.12));
    wing.add(art.facet(0xc8b472, side * 0.058, 0, -0.064, 0.084, 0.020, 0.073));
    body.add(wing);
    return { wing, side };
  });
  art.root.add(body);
  return { body, wings };
}

export const rapeseedField: BuildScene = (art, rng, ground) => {
  const blooms = [0xe8c348, 0xf2d657, 0xf9de70, 0xf0cc4c];
  const plants = Array.from({ length: 37 }, (_, i) => {
    const angle = i * 2.39996;
    const radius = Math.sqrt((i + 1) / 37);
    const x = Math.cos(angle) * radius * 2.02 + rng.range(-0.12, 0.12);
    const z = Math.sin(angle) * radius * 1.60 + rng.range(-0.11, 0.11);
    const h = rng.range(0.33, 0.67);
    const plant = new THREE.Group();
    plant.position.set(x, ground(x, z) + 0.012, z);
    plant.add(art.cylinder(0.009, 0.018, h, 4, 0x6e8c4c, 0, h / 2, 0));
    if (i % 2 === 0) {
      const lower = blade(art, 0x77945a, 0, h * 0.19, 0, 0.112, h * 0.62);
      lower.rotation.y = angle;
      lower.rotation.z = rng.range(-0.70, -0.30);
      plant.add(lower);
    }
    for (const side of [-1, 1]) {
      plant.add(art.facet(rng.pick(blooms), side * 0.061, h + rng.range(-0.07, 0.09), rng.range(-0.051, 0.058),
        rng.range(0.080, 0.132), rng.range(0.067, 0.123), rng.range(0.071, 0.120)));
    }
    art.root.add(plant);
    return { plant, phase: rng.next(), lean: rng.range(-0.13, 0.13) };
  });
  const butterflies = [0xfff4bc, 0xf4e891, 0xe8eee0, 0xf9d978].map((color, i) => ({
    ...butterfly(art, color), phase: i * 1.81, home: ground((i - 1.5) * 0.68, 0),
  }));
  return (life, age) => {
    for (const { plant, phase, lean } of plants) {
      plant.rotation.z = lean + life * (0.10 + 0.19 * Math.sin(age * 2.6 - plant.position.x * 1.42 + phase));
      plant.scale.y = 0.69 + 0.31 * THREE.MathUtils.smoothstep(life, phase * 0.50, 0.97);
    }
    for (const { body, wings, phase, home } of butterflies) {
      const t = age * 0.86 + phase;
      body.visible = life > 0.41;
      body.position.set(1.69 * Math.cos(t) + 0.31 * Math.sin(t * 2.13 + phase), home + 1.03 + 0.35 * Math.sin(t * 3.26), 1.23 * Math.sin(t * 1.18));
      body.rotation.y = Math.atan2(-1.69 * Math.sin(t), 1.45 * Math.cos(t * 1.18));
      for (const { wing, side } of wings) wing.rotation.z = side * (0.32 + 0.83 * Math.sin(age * 24.5 + phase));
    }
  };
};

function thatchRoof(art: Scenery, x: number, y: number, z: number) {
  const bottom = [[-1.35, 0, -0.91], [1.35, 0, -0.91], [1.35, 0, 0.91], [-1.35, 0, 0.91]];
  const upper = [[-0.94, 0.62, -0.10], [0.94, 0.62, -0.10], [0.94, 0.62, 0.10], [-0.94, 0.62, 0.10]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      ...bottom[i], ...upper[i], ...upper[j], ...bottom[i], ...upper[j], ...bottom[j],
    ], 3));
    geometry.computeVertexNormals();
    const panel = art.mesh(geometry, i % 2 ? 0xb19966 : 0xa79161, x, y, z);
    panel.material.side = THREE.DoubleSide;
    panel.castShadow = true;
  }
  art.box(2.14, 0.098, 0.27, 0x95815a, x, y + 0.634, z);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 13; i++) {
      const u = (i - 6) / 7;
      const nearRidge = new THREE.Vector3(x + u * 0.94, y + 0.588, z + side * 0.171);
      const nearEave = new THREE.Vector3(x + u * 1.30, y + 0.050, z + side * 0.872);
      branch(art, nearEave, nearRidge, 0.018, i % 3 ? 0xb2a071 : 0xa28d61, false);
    }
    art.box(2.71, 0.088, 0.073, 0xa58e61, x, y - 0.021, z + side * 0.895);
  }
}

export const eveningVillage: BuildScene = (art, rng, ground) => {
  const x = -0.33;
  const z = -0.49;
  const floor = ground(x, z);
  art.box(2.32, 0.19, 1.60, 0x847d6e, x, floor + 0.04, z);
  art.box(2.19, 1.10, 1.43, 0xc2b69b, x, floor + 0.63, z).castShadow = true;
  art.box(2.25, 0.13, 1.46, TIMBER, x, floor + 1.15, z);
  thatchRoof(art, x, floor + 1.21, z);
  for (const side of [-1, 1]) {
    art.box(0.10, 1.08, 0.12, TIMBER, x + side * 1.02, floor + 0.63, z + 0.71);
    art.box(0.55, 0.07, 0.085, TIMBER, x + side * 0.55, floor + 0.35, z + 0.74);
  }
  art.box(0.62, 0.82, 0.06, 0x7a6153, x - 0.46, floor + 0.53, z + 0.731);
  art.box(0.71, 0.57, 0.058, 0x665447, x + 0.49, floor + 0.67, z + 0.731);
  const window = art.box(0.59, 0.46, 0.048, 0xcdb07d, x + 0.49, floor + 0.67, z + 0.760);
  window.material.emissive.setHex(0xffb85b);
  for (const offset of [-0.18, 0, 0.18]) {
    art.box(0.025, 0.47, 0.029, TIMBER, x + 0.49 + offset, floor + 0.67, z + 0.793);
  }
  art.box(0.60, 0.024, 0.030, TIMBER, x + 0.49, floor + 0.67, z + 0.793);
  art.box(0.68, 0.10, 0.38, 0x928a78, x - 0.46, floor + 0.074, z + 0.91);
  art.box(0.23, 0.29, 0.24, 0x777670, x + 0.65, floor + 1.78, z - 0.12);
  art.box(0.30, 0.072, 0.29, 0x777670, x + 0.65, floor + 1.95, z - 0.12);

  for (let i = 0; i < 5; i++) {
    const px = 1.12 + i * 0.25;
    const pz = 0.43 + i * 0.085;
    const py = ground(px, pz);
    art.box(0.074, 0.55, 0.072, TIMBER, px, py + 0.26, pz);
    if (i < 4) {
      branch(art, new THREE.Vector3(px, py + 0.37, pz), new THREE.Vector3(px + 0.25, ground(px + 0.25, pz + 0.085) + 0.37, pz + 0.085),
        0.032, 0x8d7456, false);
    }
  }
  const smokeGeometry = new THREE.IcosahedronGeometry(1);
  const smoke = Array.from({ length: 11 }, () => {
    const mesh = new THREE.Mesh(smokeGeometry, new THREE.MeshBasicMaterial({
      color: rng.pick([0xd6d7d3, 0xc7c9c6, 0xe0ded2]), transparent: true, depthWrite: false,
    }));
    art.root.add(mesh);
    return { mesh, phase: rng.next(), drift: rng.range(-0.25, 0.25), speed: rng.range(0.18, 0.25) };
  });
  return (life, age) => {
    window.material.emissiveIntensity = life * (0.38 + 0.042 * Math.sin(age * 5.1));
    for (const { mesh, phase, drift, speed } of smoke) {
      const p = (phase + age * speed) % 1;
      mesh.visible = life > 0.21;
      mesh.position.set(x + 0.65 + p * (1.31 + drift), floor + 1.98 + p * 1.33, z - 0.12 + Math.sin(p * 6 + phase) * p * 0.37);
      const size = 0.065 + p * 0.39;
      mesh.scale.set(size * 1.43, size * 0.75, size);
      mesh.rotation.y = age * 0.22 + phase * TAU;
      mesh.material.opacity = 0.34 * life * Math.sin(p * Math.PI) * (1 - p * 0.55);
    }
  };
};

export const softSnow: BuildScene = (art, rng, ground) => {
  const pathX = (z: number): number => Math.sin(z * 1.1) * 0.66;
  for (let i = -6; i <= 6; i++) {
    const z = i * 0.36;
    const x = pathX(z);
    art.facet(i % 4 ? 0xc7d5d9 : 0xbacbd3, x, ground(x, z) + 0.025, z, 0.68, 0.047, 0.32);
    for (const side of [-1, 1]) {
      if (i % 3 === 0 && side < 0) continue;
      const px = x + side * rng.range(0.59, 0.93);
      const y = ground(px, z);
      const width = rng.range(0.28, 0.53);
      const h = rng.range(0.10, 0.23);
      art.facet(0x909eaa, px, y + h * 0.40, z, width, h, 0.33);
      art.facet(0xe0e9ea, px + 0.027, y + h * 1.03, z, width * 0.85, h * 0.43, 0.30);
    }
  }

  for (const [x, z, scale] of [[-1.22, 0.59, 1], [1.12, -0.93, 0.85]]) {
    const y = ground(x, z);
    for (let i = 0; i < 4; i++) {
      const rock = art.facet(i === 3 ? 0xdce6e9 : 0x8d9ba5, x + i * 0.061, y + (0.12 + i * 0.15) * scale, z,
        (0.31 - i * 0.054) * scale, 0.134 * scale, (0.28 - i * 0.043) * scale);
      rock.rotation.y = i;
      rock.castShadow = true;
    }
  }

  const tracks = Array.from({ length: 13 }, (_, i) => {
    const z = -2.13 + i * 0.345;
    const side = i % 2 ? 1 : -1;
    const x = pathX(z) + side * 0.135;
    const print = art.facet(0x899fac, x, ground(x, z) + 0.071, z, 0.069, 0.010, 0.122);
    print.rotation.y = 0.44 * Math.cos(z * 1.1) + side * 0.22;
    return { print, age: i * 0.22 };
  });
  const powder = Array.from({ length: 23 }, () => {
    const flake = art.facet(0xf1f7f8, 0, 0, 0, 0.038, 0.031, 0.029);
    return { flake, phase: rng.next(), x: rng.range(-1.7, 1.7), z: rng.range(-2.31, 2.31), speed: rng.range(0.23, 0.44) };
  });
  return (life, age) => {
    for (const { print, age: step } of tracks) print.visible = life > 0.42 && age > step;
    for (const { flake, phase, x, z, speed } of powder) {
      const t = (phase + age * speed) % 1;
      const px = x + t * 0.93;
      flake.visible = life > phase && life > 0.20;
      flake.position.set(px, ground(px, z) + (1 - t) * 0.71 + 0.08, z + 0.11 * Math.sin(t * TAU + phase));
    }
  };
};
