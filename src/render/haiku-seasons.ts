import * as THREE from "three";
import { buildHorse } from "./haiku-encounters";
import { figure, mistBank, mistDrift, particles, ringOnWater } from "./haiku-details";
import { blade, branch, TAU, TIMBER, type BuildScene } from "./haiku-scenery";

export const duskDucks: BuildScene = (art, rng) => {
  for (let i = 0; i < 11; i++) {
    const x = -1.76 + i * 0.35, z = -1.36 + 0.40 * Math.sin(i * 0.39);
    art.facet(i % 2 ? 0x777c7d : 0x93998c, x, 0.057, z, rng.range(0.19, 0.43), rng.range(0.10, 0.26), 0.30);
    if (i % 2) {
      const reed = blade(art, 0xaa946c, x + 0.10, 0.09, z, 0.13, rng.range(0.34, 0.71));
      reed.rotation.y = rng.range(0, TAU);
    }
  }
  const flock = Array.from({ length: 4 }, (_, i) => {
    const duck = new THREE.Group();
    const neck = new THREE.Group();
    neck.position.set(0, 0.14, 0.14);
    duck.add(art.facet(i % 2 ? 0xc4c0ae : 0xdad6c6, 0, 0.08, 0, 0.15, 0.094, 0.26));
    duck.add(art.facet(0x958c87, 0, 0.128, -0.09, 0.12, 0.047, 0.18));
    neck.add(art.facet(i % 2 ? 0xa68f7f : 0xe7dcc5, 0, 0.066, 0.04, 0.084, 0.085, 0.093));
    neck.add(art.facet(0xb99a6f, 0, 0.044, 0.136, 0.062, 0.022, 0.070));
    duck.add(neck);
    art.root.add(duck);
    return { duck, neck, ring: ringOnWater(art, 0xc0d6da), phase: i * 0.47 };
  });
  return (life, age) => {
    for (const { duck, neck, ring, phase } of flock) {
      const a = age * 0.39 - phase;
      const x = 1.51 * Math.cos(a), z = 0.32 + 0.82 * Math.sin(a);
      duck.visible = life > 0.25;
      duck.position.set(x, 0.11 + 0.026 * Math.sin(age * 5 + phase), z);
      duck.rotation.y = Math.atan2(-1.51 * Math.sin(a), 0.82 * Math.cos(a));
      neck.rotation.x = 0.42 * Math.max(0, Math.sin(age * 2.4 - phase)) ** 5;
      const wake = (age * 0.87 + phase) % 1;
      ring.visible = duck.visible;
      ring.position.set(x + 0.18 * Math.sin(a), 0.10, z - 0.15 * Math.cos(a));
      ring.scale.set(0.15 + 0.36 * wake, 0.10 + 0.22 * wake, 1);
      ring.material.opacity = 0.45 * life * (1 - wake);
    }
  };
};

export const harvestMoon: BuildScene = (art, rng, ground) => {
  for (let i = 0; i < 12; i++) {
    const a = 0.22 + i * TAU / 12;
    const x = 1.56 * Math.cos(a), z = 1.08 * Math.sin(a);
    const rock = art.facet(i % 3 ? 0x94a4ad : 0xa4b1b6, x, ground(x, z) + 0.12, z, 0.23, 0.20 + 0.04 * (i % 3), 0.21);
    rock.rotation.y = a;
    art.facet(0xdce6e8, x, ground(x, z) + 0.25, z, 0.18, 0.08, 0.17);
  }
  const moonY = ground(-0.26, -0.29) + 2.75;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.385, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf8dfa7 }));
  moon.position.set(-0.26, moonY, -0.29);
  art.root.add(moon);
  const halo = mistBank(art, 0xf4ddb3);
  halo.position.set(-0.42, moonY - 0.13, -0.46);
  halo.scale.set(1.67, 1.47, 1);
  const cloud = mistBank(art, 0xabbfc8);
  cloud.scale.set(2.21, 0.61, 1);
  const snow = particles(art, rng, ground, { count: 26, color: 0xe4eff3, radius: 0.036, height: 2.0, speed: 0.3, wind: 0.75 });
  return (life, age) => {
    const phase = (age * 0.12) % 1;
    moon.visible = halo.visible = life > 0.1;
    halo.material.uniforms.strength.value = 0.55 * life;
    moon.scale.setScalar(THREE.MathUtils.smoothstep(life, 0.1, 0.8));
    cloud.visible = moon.visible;
    cloud.position.set(-1.8 + 3.2 * phase, moonY - 0.10 + 0.26 * Math.sin(TAU * phase), 0.47);
    cloud.material.uniforms.strength.value = 0.98 * life * Math.sin(phase * Math.PI);
    snow(life * (0.56 + 0.44 * Math.sin(phase * Math.PI)), age);
  };
};

export const blossomHaze: BuildScene = (art, rng, ground) => {
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, radius = Math.sqrt((i + 1) / 16);
    const x = Math.cos(a) * 1.8 * radius, z = Math.sin(a) * 1.35 * radius;
    const y = ground(x, z);
    art.facet(i % 2 ? 0x738563 : 0x677c59, x, y + 0.14, z, 0.31, 0.18, 0.26);
    for (let j = 0; j < 5; j++) {
      const dx = rng.range(-0.24, 0.24), dz = rng.range(-0.22, 0.22);
      art.facet(rng.pick([0xd59ca6, 0xf2bfbd, 0xe2b3ba, 0xf2d4c8]), x + dx, y + rng.range(0.25, 0.67), z + dz,
        rng.range(0.12, 0.19), 0.086, rng.range(0.10, 0.16));
    }
  }
  return mistDrift(art, rng, ground, 0xf1d9ce, 9, 0.82);
};

export const coolBell: BuildScene = (art, _rng, ground) => {
  const y = ground(0, -0.4);
  const post = new THREE.Vector3(-0.83, y, -0.48);
  const fork = new THREE.Vector3(-0.72, y + 1.75, -0.45);
  const hook = new THREE.Vector3(0.32, y + 2.02, -0.44);
  branch(art, post, fork, 0.14, TIMBER);
  branch(art, fork, hook, 0.095, TIMBER);
  const bell = new THREE.Group();
  bell.position.copy(hook);
  bell.add(art.cylinder(0.17, 0.27, 0.43, 10, 0x627c78, 0, -0.28, 0));
  bell.add(art.cylinder(0.28, 0.29, 0.06, 12, 0x979882, 0, -0.51, 0));
  bell.add(art.facet(0x595b52, 0, -0.59, 0, 0.066, 0.084, 0.059));
  art.root.add(bell);
  for (const [x, z, size] of [[-1.1, 0.7, 0.41], [-0.49, 0.93, 0.31], [0.13, 1.05, 0.28], [0.90, 0.79, 0.38]]) {
    art.facet(0x909a99, x, ground(x, z) + 0.06, z, size, 0.13, size * 0.78);
  }
  const waves = [0, 0.37, 0.74].map(wait => ({ ring: ringOnWater(art, 0xb8d4d6), wait }));
  return (life, _age, bellAge) => {
    bell.rotation.x = 0.31 * Math.sin(bellAge * 8.6) * Math.exp(-bellAge * 1.55);
    for (const { ring, wait } of waves) {
      const t = (bellAge - wait) / 1.42;
      ring.visible = life > 0.35 && t > 0 && t < 1;
      if (ring.visible) {
        ring.position.set(hook.x, y + 0.28 + t * 0.12, hook.z);
        ring.scale.setScalar(0.18 + t * 1.42);
        ring.material.opacity = 0.56 * life * (1 - t);
      }
    }
  };
};

export const emptyBench: BuildScene = (art, rng, ground) => {
  const x = -0.15, z = -0.40, y = ground(x, z);
  art.box(1.71, 0.091, 0.42, 0x8e6853, x, y + 0.47, z).castShadow = true;
  for (const side of [-1, 1]) art.box(0.14, 0.46, 0.37, TIMBER, x + side * 0.62, y + 0.23, z);
  const lanternY = ground(1.13, -0.63);
  art.box(0.15, 0.80, 0.15, TIMBER, 1.13, lanternY + 0.40, -0.63);
  const paper = art.box(0.22, 0.24, 0.19, 0xa98667, 1.13, lanternY + 0.89, -0.63);
  paper.material.emissive.setHex(0xf48042);
  art.box(0.31, 0.061, 0.27, 0x60504b, 1.13, lanternY + 1.04, -0.63);
  for (let i = 0; i < 24; i++) {
    const px = rng.range(-1.9, 1.65), pz = rng.range(-0.88, 1.20);
    const leaf = art.facet(rng.pick([0xc08359, 0xb46046, 0x97674c, 0xd2975e]), px, ground(px, pz) + 0.029, pz,
      rng.range(0.065, 0.120), 0.020, 0.079);
    leaf.rotation.y = rng.range(0, TAU);
  }
  const wind = particles(art, rng, ground, { count: 7, color: 0xc28c61, radius: 0.07, height: 1.1, speed: 0.21, wind: 0.80 });
  return (life, age) => {
    paper.material.emissiveIntensity = life * (0.29 + 0.12 * Math.sin(age * 1.8) ** 2);
    wind(life, age);
  };
};

export const warriorPoetry: BuildScene = (art, _rng, ground) => {
  const center = ground(0, -0.27);
  art.box(1.58, 0.048, 1.03, 0xab946c, 0, center + 0.06, -0.27);
  for (let i = 0; i < 7; i++) art.box(0.052, 0.014, 0.99, 0xa58b64, -0.71 + i * 0.23, center + 0.088, -0.27);
  const left = figure(art, 0x667784, 0x514945, true);
  const right = figure(art, 0xaa7a65, 0x4c4442, true);
  left.person.position.set(-0.48, center + 0.11, -0.29);
  right.person.position.set(0.47, center + 0.11, -0.22);
  left.person.rotation.y = 1.26;
  right.person.rotation.y = -1.10;
  const paper = art.box(0.32, 0.019, 0.22, 0xe8dcc1, 0, center + 0.102, -0.10);
  paper.rotation.y = 0.32;
  const leaning = art.box(0.07, 0.91, 0.068, 0x8d725d, 0.92, center + 0.47, -0.64);
  leaning.rotation.z = -0.35;
  return (life, age) => {
    left.arms[1].rotation.x = -0.50 - 0.74 * life * Math.max(0, Math.sin(age * 1.02)) ** 3;
    right.arms[0].rotation.x = -0.37 - 0.62 * life * Math.max(0, Math.sin(age * 1.02 - 1.42)) ** 3;
    right.person.rotation.z = 0.055 * life * Math.sin(age * 1.5);
  };
};

export const galeRiders: BuildScene = (art, rng, ground) => {
  for (let i = 0; i < 16; i++) {
    const x = -2.4 + i * 0.32;
    art.facet(i % 2 ? 0xb2a180 : 0xa79676, x, ground(x, 0.28) + 0.018, 0.28, 0.31, 0.023, 0.43);
  }
  const riders = Array.from({ length: 5 }, (_, i) => {
    const horse = buildHorse(art);
    const rider = figure(art, [0x8f6253, 0x6b7780, 0xa88664][i % 3], 0x61544a, true);
    rider.person.position.set(0, 1.05, -0.13);
    horse.horse.add(rider.person);
    rider.person.rotation.x = 0.24;
    rider.arms[0].rotation.x = rider.arms[1].rotation.x = -0.92;
    return { ...horse, rider: rider.person, delay: i * 0.73, lane: (i % 2 ? -0.41 : 0.38) + rng.range(-0.13, 0.13) };
  });
  const dust = particles(art, rng, ground, { count: 15, color: 0xb2a381, radius: 0.040, height: 0.7, speed: 0.57, wind: 1.09 });
  return (life, age) => {
    const time = age % 9;
    for (const { horse, trot, rider, delay, lane } of riders) {
      const t = THREE.MathUtils.clamp((time - delay) / 2.55, 0, 1);
      const x = -2.5 + t * 5;
      const visible = life > 0.31 && t > 0 && t < 1;
      horse.visible = visible;
      if (!visible) continue;
      horse.position.set(x, ground(x, lane), lane);
      horse.rotation.y = Math.PI / 2;
      horse.scale.setScalar(0.70 * Math.min(1, t * 9, (1 - t) * 9));
      trot(t * TAU * 5);
      rider.position.y = 1.05 + 0.058 * Math.abs(Math.sin(t * TAU * 5));
    }
    dust(life, age);
  };
};
