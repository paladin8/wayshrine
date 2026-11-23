import * as THREE from "three";
import { mountainCherry } from "./haiku-closeups";
import { figure, mistBank, mistDrift, particles } from "./haiku-details";
import { blade, branch, TAU, TIMBER, type BuildScene } from "./haiku-scenery";

export const iseRenewal: BuildScene = (art, rng, ground) => {
  for (let i = 0; i < 13; i++) {
    const x = -2.02 + i * 0.34, z = 0.22 + 0.14 * Math.sin(x);
    art.facet(i % 3 ? 0xc2b49b : 0xb5a488, x, ground(x, z) + 0.031, z, 0.34, 0.029, 0.46);
  }
  const flags = [-1.48, 1.36].map((x, i) => {
    const z = -0.69 - i * 0.1, y = ground(x, z);
    art.cylinder(0.037, 0.054, 1.81, 5, TIMBER, x, y + 0.90, z);
    const flag = art.box(0.20, 0.56, 0.030, i ? 0xede4cc : 0xd8a68a, x + 0.14, y + 1.43, z);
    return flag;
  });
  const crowd = Array.from({ length: 7 }, (_, i) => {
    const actor = figure(art, [0xb89978, 0x7f9193, 0xb17d69, 0xd9d2b7, 0x838876][i % 5], 0x60564d);
    return { ...actor, phase: i / 7, lane: (i % 2 ? -0.29 : 0.58) + rng.range(-0.14, 0.15) };
  });
  return (life, age) => {
    for (const [i, flag] of flags.entries()) flag.rotation.y = life * 0.38 * Math.sin(age * 2.05 + i);
    for (const { person, arms, legs, phase, lane } of crowd) {
      const t = (phase + age * 0.14) % 1;
      const x = -2.24 + t * 4.48;
      const z = lane + 0.15 * Math.sin(t * Math.PI);
      const step = Math.sin(age * 8.4 + phase * TAU);
      person.visible = life > 0.28;
      person.position.set(x, ground(x, z) + 0.032 * Math.abs(step), z);
      person.scale.setScalar(0.81 * Math.min(1, t * 9, (1 - t) * 9));
      person.rotation.y = Math.PI / 2 - 0.08 * Math.sin(t * Math.PI);
      for (let i = 0; i < 2; i++) {
        legs[i].rotation.x = (i ? -1 : 1) * step * 0.38;
        arms[i].rotation.x = -legs[i].rotation.x * 0.58;
      }
    }
  };
};

export const naraHallSnow: BuildScene = (art, rng, ground) => {
  // The poem imagines the hall before its pillars are raised.
  const y = ground(0, -0.37);
  for (const dx of [-1.12, 0, 1.12]) {
    for (const dz of [-1.04, 0.24]) {
      const py = ground(dx, dz);
      art.cylinder(0.21, 0.25, 0.14, 7, 0xa19e97, dx, py + 0.07, dz);
      art.cylinder(0.183, 0.183, 0.025, 7, 0xd9e2e3, dx, py + 0.148, dz);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = -1.25 + i * 0.25, z = -0.40 + (i % 2) * 0.11;
    const sill = art.box(0.185, 0.16, 1.5, i % 2 ? 0x8d745d : 0xad9272, x, ground(x, z) + 0.11, z);
    sill.rotation.y = 0.17 + i * 0.025;
    const snow = art.box(0.134, 0.041, 0.91, 0xd8e3e7, x, ground(x, z) + 0.21, z);
    snow.rotation.y = sill.rotation.y;
  }
  const rope = branch(art, new THREE.Vector3(0.68, y + 0.18, 0.92), new THREE.Vector3(1.57, y + 0.23, 0.97), 0.040, 0xb29e7f, false);
  rope.rotation.z += 0.11;
  return particles(art, rng, ground, { count: 36, color: 0xe9f2f3, radius: 0.037, height: 2.1, speed: 0.25, wind: 0.28 });
};

export const nikkoYoungLeaves: BuildScene = (art, rng, ground) => {
  const boughs: THREE.Group[] = [];
  for (const [x, z, height] of [[-1.07, -0.67, 2.53], [1.13, -0.88, 1.99]]) {
    const foot = new THREE.Vector3(x, ground(x, z), z);
    const fork = foot.clone().add(new THREE.Vector3(0.16, height * 0.58, 0));
    branch(art, foot, fork, 0.145, 0x6e6254);
    for (const [dx, dy, dz] of [[-0.43, 0.78, 0.27], [0.31, 1.0, 0.08], [0.67, 0.62, -0.36]]) {
      const tip = fork.clone().add(new THREE.Vector3(dx, dy, dz));
      branch(art, fork, tip, 0.059, 0x756851);
      const cluster = new THREE.Group();
      cluster.position.copy(tip);
      for (let i = 0; i < 6; i++) {
        cluster.add(art.facet(rng.pick([0x93b366, 0xa7bd70, 0x7da260, 0x6e955e]), rng.range(-0.33, 0.33),
          rng.range(-0.11, 0.21), rng.range(-0.31, 0.30), 0.33, 0.17, 0.28));
      }
      art.root.add(cluster);
      boughs.push(cluster);
    }
  }
  const shafts = Array.from({ length: 3 }, (_, i) => {
    const light = mistBank(art, 0xf0d497);
    const x = -0.67 + i * 0.52, z = 0.04 + i * 0.13;
    light.position.set(x, ground(x, z) + 1.08 + (i % 2) * 0.16, z);
    light.rotation.set(-0.13, 0.59, -0.49);
    light.scale.set(0.52, 2.25, 1);
    return light;
  });
  return (life, age) => {
    for (const [i, cluster] of boughs.entries()) cluster.rotation.z = life * 0.11 * Math.sin(age * 1.92 + i);
    for (const [i, light] of shafts.entries()) {
      light.visible = life > 0.07;
      light.material.uniforms.strength.value = life * (0.17 + 0.25 * Math.sin(age * 0.77 + i * 0.85) ** 2);
    }
  };
};

export const hiddenFuji: BuildScene = (art, rng, ground) => {
  for (const [x, z, width, height] of [[-1.54, -0.63, 0.47, 0.47], [-0.94, -1.24, 0.72, 1.30], [-0.20, -1.43, 0.80, 1.74], [0.68, -1.13, 0.71, 0.98], [1.51, -0.58, 0.44, 0.54]]) {
    const rock = art.facet(0x78868e, x, ground(x, z) + height * 0.43, z, width, height * 0.79, 0.43);
    rock.rotation.set(rng.range(-0.26, 0.22), rng.range(0, TAU), rng.range(-0.21, 0.21));
    rock.castShadow = true;
  }
  for (let i = 0; i < 12; i++) {
    const x = -1.88 + i * 0.35, z = 0.45 + 0.21 * Math.sin(x * 1.3);
    art.facet(i % 3 ? 0xa1a7a5 : 0x8f9b9d, x, ground(x, z) + 0.039, z, 0.25, 0.043, 0.31);
  }
  const mist = mistDrift(art, rng, ground, 0xd3dee1, 10, 0.83);
  const drizzle = particles(art, rng, ground, { count: 30, color: 0xb9cdd4, radius: 0.014, height: 2.5, stretch: 7, speed: 0.91, wind: 0.58 });
  return (life, age) => {
    mist(life, age);
    drizzle(life, age);
  };
};

export const yoshinoHat: BuildScene = (art, rng, ground) => {
  mountainCherry(art, rng, ground, -0.83, -0.59, 2.51);
  const person = figure(art, 0x798b83, 0x584e45);
  person.person.position.set(0.74, ground(0.74, 0.42), 0.42);
  person.person.rotation.y = 0.15;
  const hat = art.cylinder(0.09, 0.33, 0.14, 9, 0xc3a975, 0.082, -0.29, 0.12);
  hat.rotation.x = 0.42;
  person.arms[1].add(hat);
  for (let i = 0; i < 6; i++) {
    const x = -1.05 + i * 0.35, z = 0.95 - Math.sin(i * 0.27) * 0.34;
    art.facet(0x9c9a87, x, ground(x, z) + 0.036, z, 0.22, 0.055, 0.25);
  }
  const petals = particles(art, rng, ground, { count: 18, color: 0xedbdbb, radius: 0.047, height: 2.25, speed: 0.21, wind: 0.95 });
  return (life, age) => {
    const presenting = Math.max(0, Math.sin(age * 0.78)) ** 2;
    person.arms[1].rotation.x = life * (-1.02 - 1.04 * presenting);
    person.arms[1].rotation.z = life * (0.44 + 0.31 * presenting);
    person.person.rotation.y = 0.15 + life * 0.26 * Math.sin(age * 0.7);
    petals(life, age);
  };
};

export const koyasanPheasant: BuildScene = (art, rng, ground) => {
  for (const [x, z] of [[-1.47, -0.37], [-0.87, -1.01], [0.58, -0.93], [1.38, -0.32]]) {
    art.facet(rng.pick([0x909587, 0x778d86, 0x8f9a93]), x, ground(x, z) + 0.08, z, 0.42, 0.18, 0.34);
    const fern = blade(art, 0x64855c, x - 0.14, ground(x - 0.14, z), z, 0.16, rng.range(0.41, 0.69));
    fern.rotation.y = rng.range(0, TAU);
  }
  const pheasant = new THREE.Group();
  pheasant.add(art.facet(0x726455, 0, 0.30, -0.038, 0.17, 0.14, 0.28));
  pheasant.add(art.facet(0x526c62, 0, 0.27, 0.105, 0.15, 0.128, 0.17));
  const head = new THREE.Group();
  head.position.set(0, 0.31, 0.16);
  head.add(art.facet(0x405f54, 0, 0.065, 0.052, 0.081, 0.110, 0.095));
  head.add(art.facet(0x507669, 0, 0.148, 0.096, 0.082, 0.074, 0.089));
  for (const side of [-1, 1]) head.add(art.facet(0xad604e, side * 0.070, 0.162, 0.139, 0.035, 0.039, 0.04));
  head.add(art.facet(0xb09a6e, 0, 0.141, 0.186, 0.037, 0.022, 0.056));
  pheasant.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.33, -0.18);
  for (const [x, length] of [[-0.052, 0.67], [0, 0.87], [0.052, 0.72]]) {
    tail.add(art.facet(0x856e56, x, 0.032, -length * 0.46, 0.049, 0.033, length * 0.53));
    for (let i = 0; i < 4; i++) tail.add(art.facet(0x5d574d, x, 0.053, -(0.16 + i * 0.106), 0.047, 0.017, 0.018));
  }
  pheasant.add(tail);
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.073, 0.21, 0.02);
    leg.add(branch(art, new THREE.Vector3(), new THREE.Vector3(0, -0.185, 0.046), 0.020, 0x9c8465, false));
    pheasant.add(leg);
    return leg;
  });
  art.root.add(pheasant);
  return (life, age) => {
    const t = age % 9.2;
    const walk = THREE.MathUtils.smoothstep(t, 0.63, 2.68) - THREE.MathUtils.smoothstep(t, 6.34, 8.25);
    const stride = Math.sin(walk * TAU * 2.25) * 0.51;
    const x = -0.76 + walk * 1.39, z = 0.32 + 0.23 * Math.sin(walk * Math.PI);
    pheasant.visible = life > 0.32;
    pheasant.position.set(x, ground(x, z) + 0.03 + 0.045 * Math.abs(stride), z);
    pheasant.rotation.y = t > 5.66 ? -1.06 : 1.09;
    legs[0].rotation.x = stride;
    legs[1].rotation.x = -stride;
    const call = Math.max(0, Math.sin((t - 3.0) * 7.5)) ** 2 * Number(t > 3.0 && t < 4.45);
    head.rotation.x = -0.39 * call + 0.11 * Math.sin(age * 2.6);
    tail.rotation.x = 0.21 * call + 0.09 * Math.sin(age * 2.2);
  };
};

export const hakoneFlurries: BuildScene = (art, rng, ground) => {
  const pathX = (z: number) => 0.63 * Math.sin(z * 0.94);
  for (let i = 0; i < 13; i++) {
    const z = -2.01 + i * 0.34, x = pathX(z);
    art.facet(i % 2 ? 0x90918e : 0xa0a09e, x, ground(x, z) + 0.024, z, 0.47, 0.044, 0.29);
    if (i % 2 === 0) {
      const dx = x + (i % 4 ? 0.68 : -0.64);
      art.facet(0xc3c9c9, dx, ground(dx, z) + 0.046, z, 0.20, 0.044, 0.22);
    }
  }
  for (const [x, z] of [[-1.14, -0.54], [1.21, 0.82]]) {
    const y = ground(x, z);
    for (let i = 0; i < 4; i++) {
      const width = 0.31 - i * 0.054;
      art.facet(i === 3 ? 0xbfc9cb : 0x7a8386, x - i * 0.034, y + 0.075 + i * 0.116, z, width, 0.10, width * 0.85);
    }
  }
  const trail = Array.from({ length: 10 }, (_, i) => {
    const z = -1.85 + i * 0.41;
    const x = pathX(z) + (i % 2 ? -0.13 : 0.13);
    const dust = art.facet(0xc4cccb, x, ground(x, z) + 0.057, z, 0.16, 0.023, 0.13);
    const print = art.facet(0x8c999e, x, ground(x, z) + 0.080, z, 0.038, 0.010, 0.077);
    dust.rotation.y = print.rotation.y = 0.42 * Math.cos(z);
    return { dust, print, wait: i * 0.23 };
  });
  const snow = particles(art, rng, ground, { count: 31, color: 0xe2eaeb, radius: 0.034, height: 2.1, speed: 0.35, wind: 1.13 });
  return (life, age) => {
    for (const { dust, print, wait } of trail) {
      dust.visible = life > 0.12;
      print.visible = life > 0.37 && age > wait;
    }
    snow(life, age);
  };
};
