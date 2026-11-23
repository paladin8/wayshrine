import * as THREE from "three";
import { blade, branch, TAU, TIMBER, type BuildScene } from "./haiku-scenery";

export const summerFord: BuildScene = (art, rng) => {
  const positions = [[-1.81, -1.06], [-1.22, -0.71], [-0.62, -0.47], [-0.02, -0.05], [0.62, 0.05], [1.22, 0.44], [1.80, 0.79]];
  for (const [i, [x, z]] of positions.entries()) {
    const wide = i === 0 || i === positions.length - 1;
    const stone = art.cylinder(wide ? 0.47 : 0.32, wide ? 0.50 : 0.36, wide ? 0.30 : 0.21, 6,
      i % 3 ? 0x839493 : 0x9ba8a0, x, wide ? 0.17 : 0.12, z);
    stone.rotation.y = rng.range(0, TAU);
    stone.scale.z = rng.range(0.77, 1.1);
    stone.castShadow = true;
    if (wide) art.facet(0x8b9a7d, x + 0.30, 0.12, z - 0.28, 0.19, 0.12, 0.21);
  }
  for (const side of [-1, 1]) {
    const x = 1.82 + side * 0.127;
    const z = 0.79 + side * 0.038;
    const sole = art.facet(0xd3b27c, x, 0.339, z, 0.095, 0.036, 0.193);
    sole.rotation.y = side * 0.10;
    for (const toe of [-1, 1]) {
      branch(art, new THREE.Vector3(x + toe * 0.062, 0.361, z - 0.021), new THREE.Vector3(x, 0.417, z + 0.066),
        0.016, 0x78614b, false);
    }
  }

  const wakeGeometry = new THREE.RingGeometry(0.918, 1, 28, 1, -Math.PI * 0.23, Math.PI * 1.47);
  const wakes = positions.flatMap(([x, z], i) => [0, 0.39].map((offset) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xe4f5ed, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const wake = new THREE.Mesh(wakeGeometry, material);
    wake.rotation.set(-Math.PI / 2, 0, -Math.PI / 3);
    art.root.add(wake);
    return { wake, x, z, phase: (i * 0.29 + offset) % 1 };
  }));
  return (life, age) => {
    for (const { wake, x, z, phase } of wakes) {
      const t = (phase + age * 0.78) % 1;
      wake.visible = life > 0.12;
      wake.position.set(x + 0.10 + t * 0.31, 0.10, z + t * 0.38);
      wake.scale.set(0.26 + 0.23 * t, 0.25 + 0.22 * t, 1);
      wake.material.opacity = 0.67 * life * Math.sin(Math.PI * t) * (1 - t * 0.31);
    }
  };
};

export const teaPath: BuildScene = (art, rng, ground) => {
  for (let i = 0; i < 10; i++) {
    const z = -1.88 + i * 0.42;
    const x = 0.67 + Math.sin(z * 0.99) * 0.35;
    const tread = art.facet(i % 3 ? 0xa49c88 : 0x8c9085, x, ground(x, z) + 0.025, z,
      rng.range(0.43, 0.53), 0.069, rng.range(0.26, 0.32));
    tread.rotation.y = rng.range(-0.14, 0.14);
  }
  const postX = 1.22;
  const postZ = -0.78;
  const postY = ground(postX, postZ);
  art.box(0.13, 0.95, 0.14, TIMBER, postX, postY + 0.47, postZ).castShadow = true;
  art.box(0.45, 0.23, 0.078, 0x9f805e, postX + 0.03, postY + 0.74, postZ + 0.09).rotation.y = -0.15;
  art.box(0.15, 0.022, 0.012, 0xa7916b, postX + 0.02, postY + 0.77, postZ + 0.133);
  const tea = [[-1.16, -1.30], [-1.15, -0.34], [-1.02, 0.64], [-0.20, 1.31]]
    .map(([x, z], index) => {
      const height = rng.range(0.59, 0.81);
      const group = new THREE.Group();
      group.position.set(x, ground(x, z), z);
      group.add(art.facet(index % 2 ? 0x56734e : 0x4b694c, 0, height * 0.46, 0, 0.59, height * 0.62, 0.56));
      for (let i = 0; i < 10; i++) {
        const a = i * TAU * 0.382;
        const r = Math.sqrt(i / 10) * 0.52;
        const bx = r * Math.cos(a);
        const bz = r * Math.sin(a);
        const by = height * (1 - r * 0.74) + rng.range(-0.04, 0.07);
        const leaf = art.facet(rng.pick([0x6e8b5e, 0x65835a, 0x527950]), bx, by - 0.038, bz, 0.16, 0.043, 0.117);
        leaf.rotation.set(rng.range(-0.37, 0.32), a, 0.12);
        group.add(leaf);
        if (i % 3 === 1) continue;
        const blossom = new THREE.Group();
        blossom.position.set(bx, by + 0.012, bz);
        for (let petal = 0; petal < 4; petal++) {
          const t = petal * TAU / 4;
          const piece = art.facet(petal % 2 ? 0xe9e3ce : 0xfff5e1, Math.cos(t) * 0.056, 0, Math.sin(t) * 0.056, 0.069, 0.027, 0.059);
          piece.rotation.y = t;
          blossom.add(piece);
        }
        blossom.add(art.facet(0xd9ad50, 0, 0.035, 0, 0.036, 0.033, 0.037));
        group.add(blossom);
      }
      art.root.add(group);
      return group;
    });
  return (life, age) => {
    for (const [i, shrub] of tea.entries()) {
      shrub.rotation.z = life * (0.035 * Math.sin(age * 2.6 + i) + 0.043 * Math.sin(age * 1.1 + i * 0.31));
      shrub.scale.y = 0.96 + 0.04 * life;
    }
  };
};

export const newYearCrow: BuildScene = (art, rng, ground) => {
  const gx = 0.43;
  const gz = -0.11;
  const y = ground(gx, gz);
  for (const side of [-1, 1]) {
    art.box(0.24, 1.48, 0.23, 0x755346, gx + side * 0.56, y + 0.74, gz).castShadow = true;
    art.box(0.32, 0.13, 0.29, 0x8d8a7e, gx + side * 0.56, y + 0.078, gz);
    const eave = art.box(1.57, 0.093, 0.51, 0x514a4d, gx, y + 1.62, gz + side * 0.22);
    eave.rotation.x = side * 0.29;
    eave.castShadow = true;
  }
  art.box(1.52, 0.085, 0.077, 0x49444a, gx, y + 1.715, gz);
  art.box(1.37, 0.14, 0.20, 0x8a6250, gx, y + 1.46, gz);
  const ropeA = new THREE.Vector3(gx - 0.56, y + 1.30, gz + 0.139);
  const ropeB = new THREE.Vector3(gx + 0.56, y + 1.30, gz + 0.139);
  const sag = new THREE.Vector3(gx, y + 1.23, gz + 0.157);
  branch(art, ropeA, sag, 0.028, 0xae9268, false);
  branch(art, sag, ropeB, 0.028, 0xae9268, false);
  const paper = [-1, 0, 1].map((side) => {
    const streamer = art.box(0.097, 0.22, 0.023, 0xe4dcbe, gx + side * 0.24, y + 1.142 + Math.abs(side) * 0.032, gz + 0.158);
    streamer.rotation.z = side * 0.13;
    return { streamer, side };
  });

  const trunk = new THREE.Vector3(-1.20, ground(-1.20, -0.90), -0.90);
  const fork = trunk.clone().add(new THREE.Vector3(0.21, 1.30, -0.03));
  const perch = fork.clone().add(new THREE.Vector3(0.79, 0.31, 0.14));
  branch(art, trunk, fork, 0.13, 0x6e5b50);
  branch(art, fork, perch, 0.067, 0x6e5b50);
  for (const [dx, dy, dz] of [[-0.59, 0.81, 0.12], [-0.11, 0.98, -0.28], [0.32, 0.71, -0.45]]) {
    const end = fork.clone().add(new THREE.Vector3(dx, dy, dz));
    branch(art, fork, end, 0.051, 0x6e5b50);
    branch(art, fork.clone().lerp(end, 0.64), end.clone().add(new THREE.Vector3(-0.21, 0.035, 0.34)), 0.028, 0x746255, false);
  }

  const crow = new THREE.Group();
  crow.position.copy(perch).add(new THREE.Vector3(-0.08, 0.024, 0.01));
  crow.rotation.y = 0.81;
  crow.scale.setScalar(1.32);
  crow.add(art.facet(0x4a4a53, 0, 0.142, -0.11, 0.137, 0.137, 0.235));
  crow.add(art.facet(0x3d3f49, 0, 0.122, -0.302, 0.095, 0.047, 0.151));
  for (const side of [-1, 1]) {
    crow.add(art.facet(0x3d3f49, side * 0.082, 0.163, -0.087, 0.085, 0.055, 0.22));
    crow.add(art.facet(0x65616a, side * 0.055, 0.034, 0.01, 0.029, 0.039, 0.053));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.201, 0.069);
  crow.add(head);
  head.add(art.facet(0x41424b, 0, 0.045, 0.028, 0.097, 0.097, 0.112));
  for (const side of [-1, 1]) head.add(art.facet(0xa69a83, side * 0.079, 0.062, 0.073, 0.014, 0.014, 0.016));
  head.add(art.facet(0x585457, 0, 0.042, 0.141, 0.046, 0.031, 0.096));
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.022, 0.098);
  jaw.add(art.facet(0x494754, 0, -0.006, 0.047, 0.036, 0.020, 0.075));
  head.add(jaw);
  art.root.add(crow);

  const phase = rng.range(0, TAU);
  return (life, age) => {
    crow.visible = life > 0.30;
    const call = Math.sin(age * 10.5) ** 4 * THREE.MathUtils.smoothstep(Math.sin(age * 0.91), 0.78, 0.94);
    head.rotation.x = -0.09 - 0.22 * call;
    head.rotation.y = Math.sin(age * 1.28 + phase) * 0.29;
    jaw.rotation.x = call * 0.50;
    for (const { streamer, side } of paper) streamer.rotation.x = life * 0.34 * Math.sin(age * 2.6 + side);
  };
};

export const pineRest: BuildScene = (art, rng, ground) => {
  for (const [x, z, height] of [[-1.24, -0.72, 2.75], [0.88, -1.25, 2.97]]) {
    const base = new THREE.Vector3(x, ground(x, z), z);
    const bend = base.clone().add(new THREE.Vector3(-0.17, height * 0.61, 0.19));
    branch(art, base, bend, 0.142, 0x736a5c);
    branch(art, bend, base.clone().add(new THREE.Vector3(0.13, height, 0.10)), 0.097, 0x766b5c);
    for (const [ox, t, oz, r] of [[-0.47, 0.60, 0.34, 0.72], [0.49, 0.72, 0.58, 0.78], [-0.08, 0.83, -0.14, 0.57], [0.20, 0.98, 0.08, 0.44]]) {
      const end = base.clone().add(new THREE.Vector3(ox, height * t, oz));
      branch(art, bend, end, 0.042, 0x786e61, false);
      const fan = art.facet(0x526b65, end.x, end.y, end.z, r, r * 0.32, r * 0.83);
      fan.rotation.y = rng.range(0, TAU);
      fan.castShadow = true;
      art.facet(0xd1e0e0, end.x + 0.02, end.y + r * 0.22, end.z - 0.02, r * 0.72, r * 0.17, r * 0.62);
    }
  }

  const matX = 0.41;
  const matZ = 0.42;
  const matY = ground(matX, matZ);
  art.box(1.25, 0.081, 0.83, 0xa48d64, matX, matY + 0.092, matZ);
  for (let i = 0; i < 12; i++) {
    art.box(0.085, 0.016, 0.807, i % 2 ? 0xad986c : 0xc1a875, matX + (i - 5.5) * 0.098, matY + 0.137, matZ);
  }
  for (const side of [-1, 1]) {
    art.box(1.25, 0.020, 0.054, 0x7c6550, matX, matY + 0.143, matZ + side * 0.39);
  }
  art.facet(0x8d655b, matX - 0.35, matY + 0.29, matZ - 0.17, 0.26, 0.17, 0.21);
  art.box(0.33, 0.035, 0.26, 0x8a7868, matX + 0.29, matY + 0.157, matZ + 0.03);
  art.cylinder(0.079, 0.059, 0.105, 8, 0x92938e, matX + 0.34, matY + 0.226, matZ + 0.02);
  const food = art.facet(0xeae4cc, matX + 0.18, matY + 0.215, matZ + 0.06, 0.076, 0.063, 0.065);
  food.rotation.z = 0.37;

  const powder = Array.from({ length: 21 }, (_, i) => {
    const side = i % 2 ? -1 : 1;
    const snow = art.facet(0xe4edf1, 0, 0, 0, 0.034, 0.045, 0.042);
    return { snow, x: side * rng.range(0.45, 1.37), z: rng.range(-1.09, -0.39), height: rng.range(1.66, 2.27),
      start: rng.range(0.10, 1.04) + (side > 0 ? 0 : 3.48), duration: rng.range(1.20, 2.01) };
  });
  return (life, age) => {
    const t = age % 9.7;
    for (const { snow, x, z, height, start, duration } of powder) {
      const drift = (t - start) / duration;
      snow.visible = life > 0.21 && drift > 0 && drift < 1;
      if (snow.visible) snow.position.set(x + drift * 0.59, ground(x, z) + height * (1 - drift), z + drift * 0.48);
    }
  };
};

export const witheredField: BuildScene = (art, rng, ground) => {
  const colors = [0x907c59, 0xab9568, 0xb3a071, 0x746d50, 0xa58b5b];
  const clumps = Array.from({ length: 26 }, (_, i) => {
    const angle = i * 2.39996;
    const r = Math.sqrt((i + 1) / 26);
    const z = Math.sin(angle) * r * 1.57;
    const x = Math.cos(angle) * r * 1.87 + 0.26 * Math.sin(z * 2.0);
    const y = ground(x, z);
    if (i % 3 === 0) {
      const earth = art.facet(i % 2 ? 0x9b8b68 : 0xa0926d, x - 0.08, y + 0.021, z, 0.34, 0.019, 0.25);
      earth.rotation.y = angle;
    }
    const tuft = new THREE.Group();
    tuft.position.set(x, y, z);
    const height = rng.range(0.26, 0.76);
    for (let j = 0; j < 3; j++) {
      const dry = blade(art, rng.pick(colors), 0, 0, 0, rng.range(0.10, 0.18), height * rng.range(0.58, 1.0));
      dry.rotation.set(rng.range(-0.30, 0.36), angle + j * 2.12, rng.range(-0.64, 0.20));
      tuft.add(dry);
    }
    art.root.add(tuft);
    const litter = art.facet(rng.pick(colors), x + 0.17, y + 0.028, z + 0.14, 0.20, 0.024, 0.13);
    litter.rotation.y = angle;
    return { tuft, lean: rng.range(-0.22, 0.17), phase: i * 0.68 };
  });

  const guideX = -1.48;
  const guideZ = -0.77;
  const guide = art.box(0.12, 0.74, 0.14, 0x8d775f, guideX, ground(guideX, guideZ) + 0.35, guideZ);
  guide.rotation.z = 0.20;
  const board = art.box(0.37, 0.12, 0.052, 0xa58e70, guideX - 0.05, ground(guideX, guideZ) + 0.61, guideZ + 0.06);
  board.rotation.z = -0.23;

  const motes = Array.from({ length: 12 }, (_, i) => ({
    seed: art.facet(i % 2 ? 0xd6c39c : 0xbaa476, 0, 0, 0, 0.071, 0.021, 0.036),
    offset: rng.next(), z: rng.range(-1.13, 1.02), speed: rng.range(0.24, 0.39),
  }));
  return (life, age) => {
    const gust = (0.5 + 0.5 * Math.sin(age * 0.94)) ** 4;
    for (const { tuft, lean, phase } of clumps) {
      tuft.rotation.z = lean - life * (0.38 * gust + 0.12 * Math.sin(age * 3.05 + phase));
      tuft.rotation.x = life * 0.14 * Math.sin(age * 2.82 + phase);
    }
    for (const { seed, offset, z, speed } of motes) {
      const t = (offset + age * speed) % 1;
      const x = -1.68 + t * 3.58;
      seed.visible = life > 0.23 && gust > 0.31;
      seed.position.set(x, ground(x, z) + 0.13 + Math.sin(t * Math.PI) * 0.51, z + 0.23 * Math.sin(offset + t * TAU));
      seed.rotation.set(age * 2.2, offset * TAU, t * 4.6);
      seed.scale.x = 0.071 * Math.sin(t * Math.PI);
    }
  };
};
