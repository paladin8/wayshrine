import * as THREE from "three";
import { buildBoat } from "./boat-mesh";
import { blade, branch, TAU, TIMBER, type BuildScene, type Scenery } from "./haiku-scenery";

export const sadoStarlight: BuildScene = (art, rng) => {
  for (const [x, z, width, height] of [[-1.64, -1.39, 0.52, 0.56], [-1.06, -1.64, 0.70, 0.79], [-0.31, -1.56, 0.69, 0.48], [0.31, -1.67, 0.36, 0.23]]) {
    const rock = art.facet(0x687d87, x, 0.058, z, width, height, 0.40);
    rock.rotation.set(rng.range(-0.22, 0.24), rng.range(0, TAU), rng.range(-0.14, 0.17));
    rock.castShadow = true;
  }

  // The stars are reflections on a patch of water, distorted by the passing crests.
  const material = new THREE.ShaderMaterial({
    uniforms: { life: { value: 0 }, time: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec2 surfaceCoord;
      void main() {
        surfaceCoord = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float life;
      uniform float time;
      varying vec2 surfaceCoord;

      vec2 hash(vec2 cell) {
        return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)), dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
      }

      void main() {
        float edge = 1.0 - smoothstep(0.64, 1.0, length(surfaceCoord));
        vec2 p = surfaceCoord;
        p.x += 0.045 * sin(p.y * 17.0 + time * 2.7);
        p.y += 0.031 * sin(p.x * 12.0 + time * 1.9);

        vec2 grid = p * vec2(12.0, 8.0);
        vec2 cell = floor(grid);
        vec2 seed = hash(cell);
        vec2 local = fract(grid) - mix(vec2(0.20), vec2(0.80), seed);
        float band = exp(-abs(p.x + p.y * 0.84 - 0.08) * 4.1);
        float stars = (1.0 - smoothstep(0.04, 0.175, length(local * vec2(0.70, 1.22))))
          * step(0.47 - 0.32 * band, seed.x) * (0.64 + 0.36 * sin(time * 3.0 + seed.y * 21.0));

        float swell = sin((p.y + 0.11 * sin(p.x * 8.0 + time)) * 21.0 + time * 4.3);
        float crest = smoothstep(0.81, 0.98, swell)
          * (0.28 + 0.72 * sin(p.x * 17.0 + p.y * 7.0 - time) * sin(p.x * 17.0 + p.y * 7.0 - time));
        vec3 sea = vec3(0.035, 0.105, 0.157) + vec3(0.051, 0.064, 0.105) * band;
        sea += vec3(0.72, 0.87, 1.00) * stars + vec3(0.29, 0.47, 0.50) * crest;
        gl_FragColor = vec4(sea, edge * life * 0.93);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 3.75), material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.105;
  art.root.add(water);
  return (life, age) => {
    water.visible = life > 0;
    material.uniforms.life.value = life;
    material.uniforms.time.value = age;
  };
};

export const winterRoadShelter: BuildScene = (art, rng, ground) => {
  const x = -0.43;
  const z = -0.50;
  const y = ground(x, z);
  for (const [dx, dz] of [[-0.83, -0.39], [0.83, -0.39], [-0.83, 0.39], [0.83, 0.39]]) {
    art.box(0.12, 1.57, 0.12, TIMBER, x + dx, y + 0.78, z + dz).castShadow = true;
    art.box(0.21, 0.12, 0.21, 0x8d887e, x + dx, y + 0.08, z + dz);
  }
  art.box(1.79, 0.16, 0.16, 0x836654, x, y + 1.49, z + 0.36);
  art.box(1.75, 0.16, 0.16, 0x836654, x, y + 1.49, z - 0.36);
  for (const side of [-1, 1]) {
    const roof = art.box(2.19, 0.093, 0.76, side > 0 ? 0x606469 : 0x55585e, x, y + 1.68, z + side * 0.34);
    roof.rotation.x = side * 0.39;
    roof.castShadow = true;
    art.box(2.23, 0.074, 0.075, 0x555456, x, y + 1.526, z + side * 0.69);
  }
  art.box(2.22, 0.084, 0.096, 0x4c4b50, x, y + 1.82, z);
  art.box(1.52, 0.085, 0.36, 0x94775b, x, y + 0.38, z - 0.27);
  for (const side of [-1, 1]) art.box(0.13, 0.37, 0.30, 0x796451, x + side * 0.56, y + 0.18, z - 0.27);
  const hat = art.cylinder(0.070, 0.24, 0.14, 10, 0xcbb17f, x - 0.77, y + 0.96, z + 0.47);
  hat.rotation.set(Math.PI * 0.40, 0, -0.26);
  art.facet(0x766453, x - 0.75, y + 1.06, z + 0.435, 0.035, 0.060, 0.030);

  const puddles = [[-1.42, 0.51], [-0.34, 0.92], [0.75, 0.83], [1.38, 0.41]].map(([px, pz], i) => {
    const groundY = ground(px, pz);
    const puddle = art.cylinder(0.27, 0.27, 0.021, 10, i % 2 ? 0x8096a2 : 0x92aab0, px, groundY + 0.002, pz);
    puddle.scale.set(rng.range(0.90, 1.48), 1, rng.range(0.62, 1.02));
    puddle.rotation.y = rng.range(0, TAU);
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 18), new THREE.MeshBasicMaterial({
      color: 0xd9eee9, transparent: true, depthWrite: false,
    }));
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(px, groundY + 0.018, pz);
    art.root.add(ripple);
    return { ripple, phase: i * 0.32 };
  });

  const showers = Array.from({ length: 37 }, (_, index) => {
    const roofDrip = index < 12;
    const px = roofDrip ? x + rng.range(-1.04, 1.04) : rng.range(-2, 2);
    const pz = roofDrip ? z + 0.76 : rng.range(0.56, 1.83);
    const drop = art.facet(roofDrip ? 0xb7cbd5 : 0xb0c2ca, 0, 0, 0, 0.018, rng.range(0.099, 0.185), 0.016);
    drop.rotation.z = roofDrip ? -0.02 : 0.32;
    return { drop, px, pz, roofDrip, phase: rng.next(), speed: rng.range(0.82, 1.52) };
  });
  return (life, age) => {
    for (const { drop, px, pz, roofDrip, phase, speed } of showers) {
      const t = (phase + age * speed) % 1;
      drop.visible = life > phase && life > 0.10;
      drop.position.set(px + (roofDrip ? 0.043 : 0.70) * t, ground(px, pz) + (1 - t) * (roofDrip ? 1.49 : 2.77), pz);
    }
    for (const { ripple, phase } of puddles) {
      const t = (phase + age * 1.54) % 1;
      ripple.visible = life > 0.3;
      ripple.scale.setScalar(0.045 + 0.21 * t);
      ripple.material.opacity = life * 0.57 * (1 - t);
    }
  };
};

export const riceHedge: BuildScene = (art, rng, ground) => {
  const edge = (x: number) => -0.54 + 0.19 * Math.cos(x * 1.77);
  for (let i = 0; i < 12; i++) {
    const x = -1.92 + i * 0.34;
    const z = edge(x);
    const y = ground(x, z);
    const height = rng.range(0.53, 0.76);
    const stick = art.cylinder(0.034, 0.042, height, 5, i % 2 ? 0xa18d63 : 0x8c8055, x, y + height / 2, z);
    stick.rotation.z = rng.range(-0.16, 0.16);
    for (const row of [0.28, 0.49]) {
      if (i === 11) continue;
      const nx = x + 0.34;
      const nz = edge(nx);
      branch(art, new THREE.Vector3(x, y + row, z + 0.039 * Math.cos(i * Math.PI)), new THREE.Vector3(nx, ground(nx, nz) + row, nz - 0.039 * Math.cos(i * Math.PI)),
        0.027, row < 0.4 ? 0x9a8960 : 0xb39a69, false);
    }
    if (i % 3 !== 2) {
      const leaf = art.facet(rng.pick([0x658559, 0x768c5b, 0x708652]), x, y + rng.range(0.18, 0.51), z - 0.17,
        rng.range(0.19, 0.32), rng.range(0.15, 0.34), 0.25);
      leaf.rotation.y = rng.range(0, TAU);
    }
  }

  const rice = new THREE.Group();
  const x = 0.37;
  const z = edge(x) + 0.13;
  rice.position.set(x, ground(x, z) + 0.45, z);
  rice.rotation.z = -0.29;
  for (const side of [-1, 1]) {
    rice.add(branch(art, new THREE.Vector3(side * 0.058, -0.24, 0), new THREE.Vector3(side * 0.19, 0.58, 0.17), 0.025, 0xc4a464, false));
    for (let j = 0; j < 6; j++) {
      const progress = j / 5;
      const wx = side * (0.11 + progress * 0.10);
      const y = 0.20 + 0.079 * j;
      const wz = 0.15 + 0.12 * Math.sin(progress * Math.PI / 2);
      const grain = art.facet(j % 2 ? 0xe4c571 : 0xeed28a, wx - side * 0.048, y, wz, 0.053, 0.075, 0.083);
      grain.rotation.set(0.54, side * 0.23, side * 0.33);
      rice.add(grain);
    }
  }
  art.root.add(rice);

  const fallen = Array.from({ length: 7 }, (_, i) => {
    const px = 0.22 + rng.range(-0.29, 0.55);
    const pz = z + rng.range(0.17, 0.60);
    const grain = art.facet(0xd9b673, px, ground(px, pz) + 0.037, pz, 0.041, 0.023, 0.069);
    grain.rotation.y = rng.range(0, TAU);
    return { grain, phase: 0.23 + i * 0.086 };
  });
  return (life, age) => {
    rice.rotation.z = -0.29 + life * (0.043 * Math.sin(age * 2.1) + 0.082 * Math.sin(age * 0.73));
    rice.rotation.x = life * 0.12 * Math.sin(age * 1.85);
    for (const { grain, phase } of fallen) grain.visible = life > phase;
  };
};

function makeDuck(art: Scenery, green: boolean) {
  const duck = new THREE.Group();
  duck.add(art.facet(0x9d8771, 0, 0.087, -0.05, 0.13, 0.11, 0.22));
  duck.add(art.facet(green ? 0x4b6f63 : 0xa58b69, 0, 0.19, 0.102, 0.086, 0.078, 0.084));
  if (green) duck.add(art.facet(0xddd9be, 0, 0.142, 0.094, 0.073, 0.026, 0.080));
  duck.add(art.facet(0xbaa069, 0, 0.172, 0.184, 0.046, 0.026, 0.078));
  duck.add(art.facet(0x71665c, 0, 0.109, -0.211, 0.078, 0.045, 0.092));
  art.root.add(duck);
  return duck;
}

export const washingGreens: BuildScene = (art, rng) => {
  const vessel = new THREE.Group();
  vessel.position.set(-0.43, 0.005, -0.46);
  vessel.rotation.y = -0.88;
  const hull = buildBoat();
  hull.scale.set(0.91, 0.94, 0.79);
  vessel.add(hull);
  art.root.add(vessel);

  const person = new THREE.Group();
  person.position.set(0.03, 0.27, -0.20);
  person.rotation.y = 0.92;
  vessel.add(person);
  person.add(art.facet(0x6e7486, 0, 0.11, 0.115, 0.24, 0.15, 0.25));
  person.add(art.facet(0xb57f83, 0, 0.37, 0, 0.207, 0.246, 0.151));
  person.add(art.facet(0xe5bb9b, 0, 0.65, 0.033, 0.104, 0.118, 0.098));
  person.add(art.facet(0x4e443d, 0, 0.707, -0.026, 0.113, 0.087, 0.097));
  person.add(art.facet(0x4e443d, 0, 0.697, -0.113, 0.069, 0.064, 0.071));
  const hands = new THREE.Group();
  hands.position.set(0.04, 0.402, 0.029);
  person.add(hands);
  for (const side of [-1, 1]) {
    hands.add(branch(art, new THREE.Vector3(side * 0.122, 0.005, 0.015), new THREE.Vector3(side * 0.085, -0.12, 0.21), 0.058, 0xa87880, false));
    hands.add(art.facet(0xe5bb9b, side * 0.080, -0.126, 0.229, 0.050, 0.044, 0.057));
    const leaf = blade(art, side > 0 ? 0x789c5e : 0x5e8f5c, side * 0.040, -0.149, 0.27, 0.14, 0.31);
    leaf.rotation.x = -0.64;
    leaf.rotation.z = side * -0.42;
    hands.add(leaf);
  }
  vessel.add(art.cylinder(0.155, 0.122, 0.125, 8, 0xb79c71, 0.18, 0.235, -0.58));

  const ducks = [true, false, false].map((drake, i) => ({ duck: makeDuck(art, drake), phase: i * 0.59, scale: rng.range(0.80, 1) }));
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 28), new THREE.MeshBasicMaterial({
    color: 0xd6eee8, transparent: true, depthWrite: false,
  }));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(-0.20, 0.106, -0.28);
  art.root.add(ripple);

  return (life, age) => {
    vessel.rotation.z = life * 0.032 * Math.sin(age * 2.12);
    const t = age % 4.92;
    const dip = THREE.MathUtils.smoothstep(t, 0.93, 1.91) * (1 - THREE.MathUtils.smoothstep(t, 2.54, 3.26));
    person.rotation.x = 0.10 + life * dip * 0.39;
    person.position.y = 0.27 - life * dip * 0.056;
    hands.position.y = 0.402 - life * dip * 0.10;
    hands.position.z = 0.029 + life * dip * 0.18;
    hands.rotation.x = life * (dip * 0.73 + Math.sin(age * 7.2) * dip * 0.08);
    const spread = (t - 1.76) / 1.25;
    ripple.visible = life > 0.29 && spread > 0 && spread < 1;
    ripple.scale.setScalar(0.12 + spread * 0.75);
    ripple.material.opacity = life * 0.53 * (1 - spread);
    for (const { duck, phase, scale } of ducks) {
      const a = age * 0.58 - phase;
      duck.visible = life > 0.18;
      duck.position.set(0.85 + 0.79 * Math.cos(a), 0.103 + 0.018 * Math.sin(age * 4.1 + phase), 0.40 + 0.89 * Math.sin(a));
      duck.rotation.y = Math.atan2(-0.79 * Math.sin(a), 0.89 * Math.cos(a));
      duck.scale.setScalar(scale);
    }
  };
};

export const plumSunrise: BuildScene = (art, rng, ground) => {
  for (let i = 0; i < 11; i++) {
    const z = -1.85 + i * 0.36;
    const x = 0.61 + 0.56 * Math.sin(z + 0.38);
    const tread = art.facet(i % 3 ? 0xb4a18b : 0xa39480, x, ground(x, z) + 0.025, z, rng.range(0.44, 0.61), 0.064, 0.27);
    tread.rotation.y = rng.range(-0.32, 0.27);
  }
  const blossoms = [0xf4d6c7, 0xebadac, 0xf1c3b5, 0xf8e9d3];
  for (const [x, z, height] of [[-1.16, -0.73, 2.63], [0.94, -1.10, 1.79]]) {
    const foot = new THREE.Vector3(x, ground(x, z), z);
    const fork = foot.clone().add(new THREE.Vector3(-0.22, height * 0.55, 0.13));
    branch(art, foot, fork, height * 0.064, 0x68544c);
    for (const [dx, dy, dz] of [[-0.48, 0.29, 0.16], [-0.06, 0.44, -0.29], [0.37, 0.30, 0.27], [0.61, 0.19, -0.14]]) {
      const tip = fork.clone().add(new THREE.Vector3(dx * height * 0.64, dy * height, dz));
      branch(art, fork, tip, 0.051, 0x766056);
      for (let i = 0; i < 6; i++) {
        const bx = tip.x + rng.range(-0.24, 0.25);
        const by = tip.y + rng.range(-0.16, 0.15);
        const bz = tip.z + rng.range(-0.19, 0.19);
        const w = rng.range(0.082, 0.14);
        for (let j = 0; j < 3; j++) {
          const a = j * TAU / 3 + i;
          art.facet(rng.pick(blossoms), bx + w * 0.47 * Math.cos(a), by, bz + w * 0.47 * Math.sin(a), w, w * 0.47, w * 0.78);
        }
      }
    }
  }

  // A low, warm band glides along the stones with the first light.
  const sunlight = Array.from({ length: 9 }, (_, i) => {
    const z = -1.80 + i * 0.42;
    const x = 0.61 + 0.56 * Math.sin(z + 0.38);
    const material = new THREE.MeshBasicMaterial({
      color: 0xeeb987, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ray = new THREE.Mesh(new THREE.CircleGeometry(1, 14), material);
    ray.rotation.x = -Math.PI / 2;
    ray.scale.set(0.41, 0.20, 1);
    ray.position.set(x, ground(x, z) + 0.081, z);
    art.root.add(ray);
    return { ray, offset: i * 0.51 };
  });
  return (life, age) => {
    for (const { ray, offset } of sunlight) {
      ray.visible = life > 0.16;
      ray.material.opacity = life * (0.11 + Math.max(0, Math.sin(age * 0.74 - offset)) ** 3 * 0.31);
    }
  };
};
