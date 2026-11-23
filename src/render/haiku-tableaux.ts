import * as THREE from "three";
import { createAnimalModels } from "./animal-models";
import { blade, branch, TAU, type BuildScene } from "./haiku-scenery";

export const marshSnipe: BuildScene = (art, rng) => {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = side * (1.27 + Math.cos(i * 0.72) * 0.41);
      const z = -1.10 + i * 0.22 + rng.range(-0.16, 0.16);
      const mud = art.facet(i % 2 ? 0x8b9076 : 0x747e6e, x, 0.078, z, rng.range(0.22, 0.37), rng.range(0.09, 0.21), 0.34);
      mud.rotation.y = rng.range(0, TAU);
      if (i % 3 === 0) continue;
      for (let j = 0; j < 3; j++) {
        const reed = blade(art, j % 2 ? 0x9d995a : 0x73885b, x + rng.range(-0.14, 0.14), 0.093, z + rng.range(-0.14, 0.14),
          0.093, rng.range(0.37, 0.86));
        reed.rotation.set(0.08, rng.range(0, TAU), rng.range(-0.36, 0.31));
      }
    }
  }

  const bird = new THREE.Group();
  art.root.add(bird);
  bird.add(art.facet(0x8b7162, 0, 0.16, -0.07, 0.175, 0.155, 0.315));
  bird.add(art.facet(0xd5bc95, 0, 0.115, 0.099, 0.144, 0.110, 0.173));
  bird.add(art.facet(0xac987f, 0, 0.263, 0.198, 0.122, 0.115, 0.133));
  bird.add(art.facet(0x725744, 0, 0.129, -0.32, 0.095, 0.080, 0.135));
  bird.add(branch(art, new THREE.Vector3(0, 0.223, 0.269), new THREE.Vector3(0, 0.173, 0.589), 0.022, 0x524940, false));
  const wings = [-1, 1].map((side) => {
    bird.add(art.facet(0x373635, side * 0.088, 0.281, 0.250, 0.030, 0.026, 0.027));
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.10, 0.206, 0.049);
    shoulder.add(art.facet(0xa08672, side * 0.185, 0, -0.092, 0.24, 0.067, 0.17));
    const tip = art.facet(0x65574f, side * 0.39, 0, -0.192, 0.26, 0.033, 0.135);
    tip.rotation.y = side * 0.38;
    shoulder.add(tip);
    for (let i = 0; i < 3; i++) {
      shoulder.add(art.facet(0xd1b58c, side * (0.110 + i * 0.064), 0.044, -0.06 - i * 0.03, 0.052, 0.018, 0.090));
    }
    bird.add(shoulder);
    return { shoulder, side };
  });
  const legs = [-1, 1].map((side) => {
    const leg = branch(art, new THREE.Vector3(side * 0.064, 0.015, 0.051), new THREE.Vector3(side * 0.083, -0.174, -0.020), 0.018, 0x8f846c, false);
    bird.add(leg);
    return leg;
  });

  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.91, 1, 24), new THREE.MeshBasicMaterial({
    color: 0xd1ebe2, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }));
  ripple.rotation.x = -Math.PI / 2;
  art.root.add(ripple);

  return (life, age) => {
    // A short, erratic flight in alternating directions leaves time to spot the bird among the reeds.
    const half = Math.floor(age / 6.6);
    const direction = half % 2 ? -1 : 1;
    const time = age % 6.6;
    const t = THREE.MathUtils.clamp((time - 3.7) / 1.36, 0, 1);
    const glide = Math.sin(Math.PI * t);
    const x = direction * (-1.01 + t * 2.02);
    const z = -0.15 + glide * (1.09 + 0.22 * Math.sin(TAU * t * 2.3));
    const flap = Math.sin(age * 26.2) * 0.87;
    bird.visible = life > 0.28;
    bird.position.set(x, 0.28 + glide * 1.60, z);
    bird.rotation.set(0.08 * Math.sin(age * 1.71) - glide * 0.21, direction * (0.53 + 0.81 * glide), direction * Math.sin(t * TAU * 1.3) * glide * 0.34);
    for (const { shoulder, side } of wings) {
      shoulder.rotation.y = side * 1.14 * (1 - glide);
      shoulder.rotation.z = side * (0.10 + glide * flap);
    }
    for (const leg of legs) leg.visible = glide < 0.37;
    const ring = (time - 3.7) / 0.95;
    ripple.visible = life > 0.41 && ring > 0 && ring < 1;
    ripple.position.set(-direction * 1.01, 0.12, -0.15);
    ripple.scale.setScalar(0.12 + ring * 0.45);
    ripple.material.opacity = 0.53 * (1 - ring);
  };
};

export const restingDeer: BuildScene = (art, rng, ground) => {
  for (const [i, [x, z]] of [[-1.57, -0.44], [-0.89, -1.17], [-0.13, -1.37], [0.71, -1.14], [1.49, -0.83]].entries()) {
    const h = rng.range(0.31, 0.68);
    art.facet(i % 2 ? 0x9a9985 : 0x777f80, x, ground(x, z) + h * 0.43, z, rng.range(0.37, 0.64), h, 0.54).castShadow = true;
  }
  for (let i = 0; i < 15; i++) {
    const t = i * TAU / 15;
    const x = 1.43 * Math.cos(t);
    const z = 1.05 * Math.sin(t);
    const tuft = blade(art, i % 3 ? 0x9a9c67 : 0x7e905e, x, ground(x, z), z, 0.11, rng.range(0.18, 0.49));
    tuft.rotation.y = rng.range(0, TAU);
  }
  const models = createAnimalModels();
  const pair = [[-0.64, 0.26, 0.96, 0.96], [0.67, -0.32, -1.18, 0.85]].map(([x, z, facing, scale], i) => {
    const deer = models.buildRestingDeer();
    deer.group.position.set(x, ground(x, z) + 0.01, z);
    deer.group.rotation.y = facing;
    deer.group.scale.setScalar(scale);
    art.root.add(deer.group);
    return { deer, phase: i * 1.79 };
  });
  return (life, age) => {
    for (const { deer, phase } of pair) {
      deer.group.visible = life > 0.36;
      deer.pose(age, 0, phase);
    }
  };
};

export const moonViewing: BuildScene = (art, rng, ground) => {
  const radius = 1.20;
  const y = ground(0, -0.36);
  // A basin gives the sky reflection a definite edge in the overhead camera.
  const bed = art.cylinder(radius, radius * 0.94, 0.14, 16, 0x565f65, 0, y + 0.04, -0.36);
  bed.scale.z = 0.79;
  for (let i = 0; i < 13; i++) {
    const t = i * TAU / 13;
    const x = radius * Math.cos(t);
    const z = -0.36 + radius * 0.81 * Math.sin(t);
    const stone = art.facet(i % 2 ? 0x8b928c : 0xa0a397, x, Math.max(y + 0.11, ground(x, z) + 0.07), z,
      rng.range(0.22, 0.33), rng.range(0.13, 0.22), 0.23);
    stone.rotation.y = rng.range(0, TAU);
  }
  for (let i = 0; i < 7; i++) {
    const z = 0.63 + i * 0.13;
    const x = 0.18;
    art.box(1.02, 0.075, 0.12, i % 2 ? 0x927862 : 0x7d6859, x, ground(x, z) + 0.065, z);
  }
  const water = new THREE.ShaderMaterial({
    uniforms: { age: { value: 0 }, life: { value: 0 } },
    vertexShader: `
      varying vec2 surface;
      void main() {
        surface = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float age;
      uniform float life;
      varying vec2 surface;
      void main() {
        vec2 p = surface;
        float ripple = sin(28.0 * p.y - 2.8 * age) * sin(17.0 * p.x + age);
        vec2 image = p + vec2(ripple * 0.014 * life, 0.0);
        vec2 moonAt = image - vec2(0.03, 0.10);
        float rim = 1.0 - smoothstep(0.28, 0.313, length(moonAt * vec2(1.0, 0.79)));
        float halo = 0.24 * exp(-13.5 * dot(moonAt, moonAt));
        float passing = (fract(age * 0.143) - 0.5) * 3.0;
        float cloudBand = abs(image.x - passing - 0.36 * image.y + 0.11 * sin(image.y * 14.0));
        float cloud = (1.0 - smoothstep(0.20, 0.42, cloudBand)) * (0.86 + 0.13 * cos(image.y * 15.0));
        vec3 pond = mix(vec3(0.13, 0.145, 0.15), vec3(0.055, 0.13, 0.19), life);
        vec3 glow = vec3(1.0, 0.88, 0.62) * (rim + halo) * life;
        gl_FragColor = vec4(pond + glow * (1.0 - cloud * 0.94) + vec3(0.12, 0.16, 0.19) * cloud * life, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const reflection = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.97, 40), water);
  reflection.rotation.x = -Math.PI / 2;
  reflection.scale.y = 0.79;
  reflection.position.set(0, y + 0.116, -0.36);
  art.root.add(reflection);
  return (life, age) => {
    water.uniforms.age.value = age;
    water.uniforms.life.value = life;
  };
};

export const fallingPeony: BuildScene = (art, rng, ground) => {
  const pinks = [0xf3a3ae, 0xda7889, 0xf7bfba, 0xad526d, 0xec91a2];
  const plants = [[-1.03, -0.38, 0.86], [-0.17, -0.51, 1.17], [0.80, -0.29, 0.99], [0.44, 0.49, 0.68], [-0.74, 0.49, 0.72]]
    .map(([x, z, h], index) => {
      const y = ground(x, z);
      const plant = new THREE.Group();
      plant.position.set(x, y, z);
      const sway = index % 2 ? -0.13 : 0.15;
      plant.add(branch(art, new THREE.Vector3(), new THREE.Vector3(sway, h, 0), 0.039, 0x667d54, false));
      for (let j = 0; j < 5; j++) {
        const leaf = blade(art, j % 2 ? 0x779359 : 0x577b55, sway * 0.5, h * rng.range(0.20, 0.51), 0, 0.27, 0.46);
        leaf.rotation.set(0.34, j * TAU / 5 + index * 0.64, -0.95);
        plant.add(leaf);
      }
      const flower = new THREE.Group();
      flower.position.set(sway, h, 0);
      flower.rotation.set(0.26 * Math.sin(index), 0, 0.22 * Math.cos(index));
      for (let ring = 0; ring < 3; ring++) {
        const count = 7 - ring;
        for (let j = 0; j < count; j++) {
          const a = j * TAU / count + ring * 0.46;
          const radius = 0.28 - ring * 0.086;
          const petal = art.facet(rng.pick(pinks), radius * Math.cos(a), ring * 0.048, radius * Math.sin(a), 0.107, 0.075, 0.155);
          petal.rotation.set(0.43 + ring * 0.26, Math.PI / 2 - a, 0.12);
          flower.add(petal);
        }
      }
      flower.add(art.facet(0xe7b96b, 0, 0.112, 0, 0.078, 0.062, 0.085));
      plant.add(flower);
      art.root.add(plant);
      return { plant, flower, phase: rng.range(0, TAU) };
    });

  const shed = Array.from({ length: 6 }, (_, i) => ({
    mesh: art.facet(rng.pick(pinks), 0, 0, 0, 0.109, 0.019, 0.081),
    start: i * 0.64,
    home: plants[i % plants.length].plant.position,
    height: plants[i % plants.length].flower.position.y,
    x: rng.range(-0.59, 0.59), z: rng.range(0.34, 0.73),
  }));
  return (life, age) => {
    for (const { plant, flower, phase } of plants) {
      plant.rotation.z = life * (0.07 * Math.sin(age * 2.0 + phase) + 0.04 * Math.sin(age * 3.7));
      flower.scale.setScalar(0.72 + 0.28 * life);
    }
    for (const { mesh, start, home, height, x, z } of shed) {
      const elapsed = (age + 9 - start) % 9;
      const t = Math.min(1, elapsed / 2.45);
      const px = home.x + x * t + 0.18 * Math.sin(t * TAU + start) * Math.sin(t * Math.PI);
      const pz = home.z + z * t;
      mesh.visible = life > 0.40;
      mesh.position.set(px, THREE.MathUtils.lerp(home.y + height, ground(px, pz) + 0.046, t), pz);
      mesh.rotation.set((1 - t) * Math.sin(elapsed * 4.0 + start) * 0.92, start * 1.93 + elapsed * 0.13, (1 - t) * 0.75);
      mesh.scale.x = 0.109 * Math.min(1, elapsed / 0.19, (9 - elapsed) / 0.55);
    }
  };
};

export const winterGrove: BuildScene = (art, rng, ground) => {
  for (const [x, z, h] of [[-1.48, -0.82, 2.64], [-0.63, -1.25, 3.14], [0.34, -1.56, 2.75], [1.21, -0.91, 2.06]]) {
    const y = ground(x, z);
    art.cylinder(0.057, 0.14, h, 6, 0x71695f, x, y + h / 2, z).castShadow = true;
    for (let tier = 0; tier < 3; tier++) {
      const r = (0.51 - tier * 0.10) * (h / 2.58);
      const py = y + h * (0.59 + tier * 0.13);
      const cone = art.cylinder(0.036, r, h * 0.34, 6, tier % 2 ? 0x566b61 : 0x4a6156, x, py, z);
      cone.rotation.y = rng.range(0, TAU);
      cone.castShadow = true;
      art.facet(0xb5c4bc, x + r * 0.18, py + h * 0.069, z - r * 0.10, r * 0.50, 0.082, r * 0.46);
    }
  }
  const x = -0.37;
  const z = 0.54;
  const y = ground(x, z);
  const stump = art.cylinder(0.30, 0.41, 0.51, 8, 0x785d49, x, y + 0.25, z);
  stump.castShadow = true;
  for (let i = 0; i < 4; i++) {
    const radii = [0.28, 0.22, 0.14, 0.062];
    const radius = radii[i];
    art.cylinder(radius, radius, 0.02, 9, i % 2 ? 0xaf9165 : 0xd8bb85, x, y + 0.51 + i * 0.006, z);
  }
  const handleStart = new THREE.Vector3(x + 0.021, y + 0.63, z + 0.02);
  const handleEnd = new THREE.Vector3(x + 0.38, y + 1.08, z + 0.23);
  branch(art, handleStart, handleEnd, 0.038, 0x846044);
  const axe = art.box(0.28, 0.17, 0.113, 0x677479, x + 0.023, y + 0.58, z + 0.02);
  axe.rotation.z = -0.45;
  axe.castShadow = true;
  for (let i = 0; i < 2; i++) {
    const px = 0.82 + i * 0.43;
    const pz = 0.27 + i * 0.31;
    const py = ground(px, pz) + 0.18;
    const log = art.cylinder(0.192, 0.21, 0.57, 8, 0x785e4a, px, py, pz);
    const end = art.cylinder(0.179, 0.179, 0.023, 8, 0xddbd87, px, py, pz + 0.281);
    log.rotation.x = end.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 19; i++) {
    const px = x + rng.range(-0.62, 0.78);
    const pz = z + rng.range(-0.44, 0.52);
    const chip = art.facet(i % 3 ? 0xc7a579 : 0xae8760, px, ground(px, pz) + 0.044, pz, rng.range(0.044, 0.088), 0.021, 0.054);
    chip.rotation.y = rng.range(0, TAU);
  }

  const hazeGeometry = new THREE.IcosahedronGeometry(1);
  const haze = Array.from({ length: 8 }, () => {
    const mesh = new THREE.Mesh(hazeGeometry, new THREE.MeshBasicMaterial({
      color: 0xc3d3d4, transparent: true, depthWrite: false,
    }));
    art.root.add(mesh);
    return { mesh, phase: rng.next(), z: rng.range(-0.54, 0.23), speed: rng.range(0.16, 0.27) };
  });
  return (life, age) => {
    for (const { mesh, phase, z: depth, speed } of haze) {
      const t = (phase + age * speed) % 1;
      const px = -1.45 + 3.06 * t;
      mesh.visible = life > 0.25;
      mesh.position.set(px, ground(px, depth) + 0.24 + 0.18 * t, depth + 0.27 * Math.sin(t * TAU + phase));
      mesh.scale.set(0.25 + t * 0.41, 0.054 + t * 0.095, 0.13 + t * 0.22);
      mesh.material.opacity = 0.27 * life * Math.sin(t * Math.PI);
    }
  };
};
