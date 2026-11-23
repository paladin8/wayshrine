import * as THREE from "three";
import type { Rng } from "../core";
import { figure, mistBank, mistDrift, particles, ringOnWater, type LocalGround } from "./haiku-details";
import { blade, branch, TAU, TIMBER, type BuildScene, type Scenery } from "./haiku-scenery";

export const rainFoxfire: BuildScene = (art, rng, ground) => {
  const y = ground(0, 0);
  const rest = art.facet(0x747e73, 0, y + 0.16, 0, 0.86, 0.30, 0.72);
  rest.rotation.y = 0.17;
  const skull = new THREE.Group();
  skull.position.set(0, y + 0.40, 0);
  skull.rotation.y = 0.44;
  skull.add(art.facet(0xdaceb3, 0, 0.16, -0.11, 0.27, 0.23, 0.29));
  skull.add(art.facet(0xbeb9a3, 0, 0.055, 0.14, 0.207, 0.12, 0.225));
  for (const side of [-1, 1]) {
    skull.add(art.facet(0x514f49, side * 0.118, 0.175, 0.097, 0.082, 0.069, 0.035));
    skull.add(art.facet(0xe5d7b9, side * 0.075, 0.030, 0.248, 0.052, 0.036, 0.051));
  }
  art.root.add(skull);
  for (let i = 0; i < 14; i++) {
    const a = i * TAU / 14;
    const x = 1.39 * Math.cos(a), z = 1.10 * Math.sin(a);
    const fern = blade(art, i % 2 ? 0x647a55 : 0x788a5f, x, ground(x, z), z, 0.16, rng.range(0.24, 0.62));
    fern.rotation.y = a;
  }
  const flame = art.facet(0x91cfb9, 0, y + 0.91, 0.05, 0.075, 0.20, 0.068);
  flame.material.emissive.setHex(0x5de4bb);
  const halo = mistBank(art, 0x86edca);
  const rain = particles(art, rng, ground, { count: 28, color: 0x9fb9bb, radius: 0.016, height: 2.6, stretch: 7, speed: 1.3, wind: 0.45 });
  return (life, age) => {
    const flicker = 0.76 + 0.21 * Math.sin(age * 5.6) + 0.12 * Math.sin(age * 11.2);
    flame.visible = halo.visible = life > 0.32;
    flame.position.y = y + 0.84 + 0.12 * Math.sin(age * 1.8);
    flame.scale.set(0.075, 0.20 * flicker, 0.068);
    flame.material.emissiveIntensity = life * flicker;
    halo.position.copy(flame.position);
    halo.scale.set(1.06, 0.95, 1);
    halo.material.uniforms.strength.value = life * flicker * 0.43;
    rain(life, age);
  };
};

export const riversidePalanquins: BuildScene = (art, rng) => {
  const dockY = 0.23;
  for (let i = 0; i < 13; i++) {
    const x = -1.9 + i * 0.29;
    art.box(0.285, 0.097, 1.17, i % 2 ? 0x9c8569 : 0x967c5f, x, dockY, -0.65);
  }
  for (const x of [-1.69, 1.60]) {
    art.box(0.18, 0.65, 0.20, TIMBER, x, 0.24, -0.18);
    const base = new THREE.Vector3(x, 0.09, -1.34);
    const fork = base.clone().add(new THREE.Vector3(0.20, 1.45, 0.04));
    art.facet(0x899284, x, 0.10, -1.34, 0.44, 0.16, 0.32);
    branch(art, base, fork, 0.09, 0x675951);
    for (const [a, b, c] of [[-0.51, 0.74, 0.09], [0.41, 0.84, -0.21], [0.60, 0.43, 0.27]]) {
      branch(art, fork, fork.clone().add(new THREE.Vector3(a, b, c)), 0.039, 0x675951);
    }
  }
  for (const [i, x] of [-0.70, 0.77].entries()) {
    const z = -0.66 + i * 0.15;
    art.box(0.66, 0.16, 0.56, 0x755e50, x, dockY + 0.15, z);
    art.box(0.59, 0.48, 0.47, i ? 0x947363 : 0x777982, x, dockY + 0.40, z);
    art.box(0.63, 0.11, 0.54, 0x544d59, x, dockY + 0.68, z);
    art.box(0.28, 0.34, 0.024, 0xc1b292, x, dockY + 0.39, z + 0.24);
    const poles = branch(art, new THREE.Vector3(x, dockY + 0.78, z - 0.79), new THREE.Vector3(x, dockY + 0.78, z + 0.82), 0.037, TIMBER, false);
    poles.castShadow = true;
  }
  const birds = Array.from({ length: 3 }, (_, i) => {
    const bird = new THREE.Group();
    bird.add(art.facet(i === 0 ? 0xdbcfc1 : 0xbec7c0, 0, 0.074, 0, 0.13, 0.084, 0.22));
    bird.add(art.facet(0xa9977e, 0, 0.15, 0.14, 0.073, 0.067, 0.069));
    bird.add(art.facet(0x77695b, 0, 0.13, 0.215, 0.044, 0.023, 0.077));
    art.root.add(bird);
    return { bird, ring: ringOnWater(art, 0xc6dddc), phase: i * 0.44 + rng.range(0, 0.2) };
  });
  return (life, age) => {
    for (const { bird, ring, phase } of birds) {
      const a = age * 0.52 - phase, x = 1.40 * Math.cos(a), z = 0.90 + 0.34 * Math.sin(a);
      bird.visible = life > 0.25;
      bird.position.set(x, 0.11 + 0.019 * Math.sin(a * 7), z);
      bird.rotation.y = Math.atan2(-1.4 * Math.sin(a), 0.34 * Math.cos(a));
      const t = (age * 0.77 + phase) % 1;
      ring.visible = bird.visible;
      ring.position.set(x, 0.10, z);
      ring.scale.setScalar(0.09 + 0.32 * t);
      ring.material.opacity = life * 0.31 * (1 - t);
    }
  };
};

export const washingFly: BuildScene = (art, rng, ground) => {
  const x = 0.17, z = 0.07, y = ground(x, z);
  const stone = art.facet(0xaca89a, x, y + 0.19, z, 0.75, 0.39, 0.63);
  stone.rotation.set(0.11, -0.31, -0.07);
  for (let i = 0; i < 8; i++) {
    const a = rng.range(0, TAU), dx = Math.cos(a) * 0.79, dz = Math.sin(a) * 0.58;
    const leaf = art.facet(i % 2 ? 0xc8a571 : 0xb58d60, x + dx, ground(x + dx, z + dz) + 0.055, z + dz,
      0.22, 0.025, 0.12);
    leaf.rotation.y = a;
  }
  const fly = new THREE.Group();
  fly.position.set(x, y + 0.54, z);
  fly.rotation.y = 0.51;
  fly.add(art.facet(0x455753, 0, 0.091, -0.119, 0.111, 0.078, 0.15));
  fly.add(art.facet(0x343e3b, 0, 0.100, 0.031, 0.106, 0.079, 0.099));
  const parts = [-1, 1].map((side) => {
    fly.add(art.facet(0x7a554c, side * 0.056, 0.133, 0.092, 0.044, 0.044, 0.047));
    const wing = art.facet(0xb3c3bb, side * 0.14, 0.150, -0.076, 0.103, 0.014, 0.137);
    fly.add(wing);
    const foot = new THREE.Group();
    foot.position.set(side * 0.055, 0.063, 0.059);
    foot.add(branch(art, new THREE.Vector3(), new THREE.Vector3(side * 0.031, -0.049, 0.137), 0.016, 0x4c5243, false));
    fly.add(foot);
    for (const dz of [-0.14, -0.044]) {
      fly.add(branch(art, new THREE.Vector3(side * 0.046, 0.055, dz), new THREE.Vector3(side * 0.102, -0.025, dz - 0.032), 0.014, 0x4c5243, false));
    }
    return { wing, foot, side };
  });
  art.root.add(fly);
  return (life, age) => {
    fly.visible = life > 0.25;
    fly.rotation.y = 0.51 + 0.34 * Math.sin(age * 0.57);
    const groom = Math.max(0, Math.sin(age * 1.12)) ** 5;
    const flutter = Math.max(0, Math.sin(age * 0.63 + 1.8)) ** 14;
    for (const { wing, foot, side } of parts) {
      foot.rotation.y = -side * (0.19 + groom * (0.41 + 0.31 * Math.sin(age * 23)));
      foot.rotation.x = -groom * 0.31;
      wing.rotation.z = side * (0.24 + flutter * 0.55 * Math.sin(age * 46));
    }
  };
};

export const mistFarewell: BuildScene = (art, rng, ground) => {
  const left = figure(art, 0x927e76, 0x6a5b54);
  const right = figure(art, 0x677f7e, 0x5f5248);
  left.person.position.set(-1.01, ground(-1.01, 0.31), 0.31);
  left.person.rotation.y = 1.62;
  const hat = art.cylinder(0.060, 0.24, 0.12, 7, 0xc2a578, 0.031, -0.31, 0.053);
  hat.rotation.z = Math.PI / 2;
  left.arms[1].add(hat);
  for (let i = 0; i < 11; i++) {
    const x = -1.95 + 0.36 * i;
    art.facet(0xb7a992, x, ground(x, 0.16) + 0.028, 0.16, 0.32, 0.032, 0.33);
  }
  const haze = mistDrift(art, rng, ground, 0xd5ded4, 9, 0.82);
  return (life, age) => {
    const t = (age * 0.11) % 1;
    const x = 0.09 + 1.87 * t, z = 0.11 - 0.27 * t;
    right.person.visible = life > 0.30;
    right.person.position.set(x, ground(x, z), z);
    right.person.rotation.y = 1.70;
    right.person.scale.setScalar(Math.min(1, (1 - t) * 8));
    for (let i = 0; i < 2; i++) {
      right.legs[i].rotation.x = (i ? -1 : 1) * 0.43 * Math.sin(age * 8.7);
      right.arms[i].rotation.x = -right.legs[i].rotation.x * 0.49;
    }
    left.arms[1].rotation.x = life * (-1.82 + 0.31 * Math.sin(age * 3.1));
    left.arms[1].rotation.z = -life * (0.80 + 0.30 * Math.sin(age * 3.1 + 1.6));
    haze(life, age);
  };
};

export function mountainCherry(art: Scenery, rng: Rng, ground: LocalGround, x: number, z: number, height: number) {
  const bottom = new THREE.Vector3(x, ground(x, z), z);
  const fork = bottom.clone().add(new THREE.Vector3(-0.19, height * 0.60, -0.06));
  branch(art, bottom, fork, height * 0.079, 0x68554f);
  for (const [dx, rise, dz] of [[-0.85, 0.27, 0.20], [-0.46, 0.40, -0.35], [0.12, 0.48, 0.13], [0.44, 0.37, -0.21], [0.85, 0.23, 0.30]]) {
    const tip = fork.clone().add(new THREE.Vector3(dx * height * 0.6, rise * height, dz));
    branch(art, fork, tip, 0.083, 0x765e55);
    for (let i = 0; i < 4; i++) {
      const size = rng.range(0.28, 0.46) * height / 2.6;
      art.facet(rng.pick([0xf4c7c3, 0xe6a5b0, 0xf7d7cf, 0xca889c]),
        tip.x + rng.range(-0.26, 0.27), tip.y + rng.range(-0.10, 0.23), tip.z + rng.range(-0.23, 0.25), size, size * 0.63, size * 0.77).castShadow = true;
    }
  }
}

export const doubleCherry: BuildScene = (art, rng, ground) => {
  mountainCherry(art, rng, ground, -0.52, -0.53, 3.05);
  for (const [x, z] of [[-1.08, 0.47], [0.26, -0.39], [0.94, 0.36]]) {
    art.facet(0x8b9192, x, ground(x, z) + 0.17, z, 0.48, 0.29, 0.39).castShadow = true;
  }
  for (let i = 0; i < 16; i++) {
    const x = rng.range(-1.6, 1.6), z = rng.range(-0.81, 1.1);
    art.facet(i % 2 ? 0xdc9ba6 : 0xeac0b9, x, ground(x, z) + 0.035, z, 0.061, 0.014, 0.045);
  }
  return particles(art, rng, ground, { count: 14, color: 0xf1bbb8, radius: 0.052, height: 2.4, speed: 0.22, wind: 0.60 });
};

export const nightClover: BuildScene = (art, rng, ground) => {
  for (const [i, [x, z]] of [[-1.38, -0.31], [-0.46, -0.87], [0.43, -0.61], [1.20, 0.09], [-0.53, 0.56]].entries()) {
    const y = ground(x, z);
    art.facet(i % 2 ? 0x58745e : 0x657963, x, y + 0.18, z, 0.42, 0.23, 0.39);
    for (let j = 0; j < 5; j++) {
      const a = rng.range(0, TAU), r = rng.range(0.21, 0.47);
      const dx = r * Math.cos(a), dz = r * Math.sin(a), h = rng.range(0.43, 0.90);
      branch(art, new THREE.Vector3(x, y + 0.18, z), new THREE.Vector3(x + dx, y + h, z + dz), 0.017, 0x637b5d, false);
      for (let k = 0; k < 4; k++) {
        const t = 0.56 + k * 0.11;
        art.facet(k % 2 ? 0xb378a6 : 0xc898bb, x + dx * t + (k % 2 ? -0.035 : 0.035), y + h * t, z + dz * t, 0.048, 0.049, 0.046);
      }
    }
  }
  const specks = Array.from({ length: 8 }, () => {
    const light = art.facet(0xb3ce97, 0, 0, 0, 0.029, 0.030, 0.029);
    light.material.emissive.setHex(0xabc189);
    return { light, a: rng.range(0, TAU), r: rng.range(0.44, 1.58), y: rng.range(0.31, 0.96) };
  });
  const fall = particles(art, rng, ground, { count: 9, color: 0xd4a1c3, radius: 0.037, height: 0.87, speed: 0.28, wind: 0.28 });
  return (life, age) => {
    for (const { light, a, r, y } of specks) {
      const t = a + age * 0.61;
      const x = r * Math.cos(t), z = 0.69 * r * Math.sin(t);
      light.visible = life > 0.45 && Math.sin(t * 3.5) > -0.21;
      light.position.set(x, ground(x, z) + y + 0.11 * Math.sin(age * 2 + a), z);
      light.material.emissiveIntensity = life * 0.82;
    }
    fall(life, age);
  };
};

export const futamiOfferings: BuildScene = (art, rng, ground) => {
  const y = ground(0, -0.37);
  art.facet(0x8a9290, 0, y + 0.07, -0.37, 1.15, 0.25, 0.78).castShadow = true;
  for (const x of [-0.83, 0.83]) {
    const base = ground(x, -0.65);
    art.cylinder(0.078, 0.096, 0.84, 5, TIMBER, x, base + 0.42, -0.65);
    art.facet(0x9a9885, x, base + 0.12, -0.65, 0.23, 0.19, 0.32);
  }
  const left = new THREE.Vector3(-0.83, ground(-0.83, -0.65) + 0.77, -0.65);
  const right = new THREE.Vector3(0.83, ground(0.83, -0.65) + 0.77, -0.65);
  const mid = left.clone().lerp(right, 0.5).add(new THREE.Vector3(0, -0.13, 0.02));
  branch(art, left, mid, 0.046, 0xc3a77d, false);
  branch(art, mid, right, 0.046, 0xc3a77d, false);
  const streamers = [-1, 0, 1].map(side => art.box(0.078, 0.20, 0.023, 0xe2dac9, side * 0.29, mid.y - 0.071, -0.61));
  art.box(0.75, 0.093, 0.47, 0xab8967, 0.06, y + 0.34, -0.26);
  for (let i = 0; i < 4; i++) {
    const x = 0.06 + rng.range(-0.20, 0.21);
    art.facet(i % 2 ? 0xcfab62 : 0xe0cb9a, x, y + 0.43, -0.27 + rng.range(-0.13, 0.13), 0.075, 0.063, 0.075);
  }
  return (life, age) => {
    for (const [i, flag] of streamers.entries()) flag.rotation.x = life * (0.28 + 0.33 * Math.sin(age * 3.0 + i * 0.63));
  };
};
