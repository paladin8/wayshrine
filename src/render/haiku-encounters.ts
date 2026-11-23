import * as THREE from "three";
import { blade, branch, TAU, TIMBER, type BuildScene, type Scenery } from "./haiku-scenery";

export function buildHorse(art: Scenery) {
  const chestnut = 0x9c6547;
  const mane = 0x52403a;
  const horse = new THREE.Group();
  const body = new THREE.Group();
  horse.add(body);
  body.add(art.facet(chestnut, 0, 0.99, -0.05, 0.31, 0.32, 0.70));
  body.add(art.facet(0xab7150, 0, 1.00, 0.36, 0.30, 0.37, 0.37));
  body.add(art.facet(0xa76e4e, 0, 1.00, -0.47, 0.29, 0.34, 0.35));
  const neck = new THREE.Group();
  neck.position.set(0, 1.12, 0.43);
  body.add(neck);
  neck.add(branch(art, new THREE.Vector3(0, -0.08, -0.13), new THREE.Vector3(0, 0.56, 0.24), 0.19, chestnut, false));
  neck.add(art.facet(chestnut, 0, 0.53, 0.30, 0.158, 0.169, 0.26));
  neck.add(art.facet(0x7c5748, 0, 0.40, 0.49, 0.124, 0.096, 0.14));
  neck.add(art.facet(0xead1aa, 0, 0.562, 0.481, 0.039, 0.076, 0.038));
  neck.add(branch(art, new THREE.Vector3(0, 0.03, -0.18), new THREE.Vector3(0, 0.62, 0.21), 0.102, mane, false));
  for (const side of [-1, 1]) {
    const ear = art.facet(chestnut, side * 0.090, 0.674, 0.21, 0.052, 0.111, 0.060);
    ear.rotation.z = -side * 0.20;
    neck.add(ear);
    neck.add(art.facet(0x413836, side * 0.111, 0.551, 0.394, 0.033, 0.031, 0.030));
  }
  const tail = new THREE.Group();
  tail.position.set(0, 1.13, -0.65);
  tail.add(branch(art, new THREE.Vector3(), new THREE.Vector3(0, -0.30, -0.39), 0.078, mane, false));
  tail.add(art.facet(mane, 0, -0.35, -0.38, 0.085, 0.23, 0.097));
  body.add(tail);
  const legs = [-1, 1].flatMap((side) => [-1, 1].map((front) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.21, 0.95, front * 0.42);
    body.add(hip);
    hip.add(branch(art, new THREE.Vector3(), new THREE.Vector3(0, -0.43, 0.04 * front), 0.086, chestnut, false));
    const knee = new THREE.Group();
    knee.position.set(0, -0.43, 0.04 * front);
    hip.add(knee);
    knee.add(branch(art, new THREE.Vector3(), new THREE.Vector3(0, -0.46, 0.020), 0.055, 0x715043, false));
    knee.add(art.box(0.126, 0.113, 0.163, mane, 0, -0.452, 0.04));
    return { hip, knee, opposite: side * front < 0 };
  }));
  horse.traverse((part) => {
    if (part instanceof THREE.Mesh) part.castShadow = true;
  });
  art.root.add(horse);

  return {
    horse,
    trot(phase: number) {
      body.position.y = 0.052 * Math.abs(Math.sin(phase));
      neck.rotation.x = 0.11 + 0.082 * Math.cos(phase * 2);
      tail.rotation.y = 0.22 * Math.sin(phase);
      for (const { hip, knee, opposite } of legs) {
        const stride = Math.sin(phase + (opposite ? Math.PI : 0));
        hip.rotation.x = stride * 0.62;
        knee.rotation.x = Math.max(0, -stride) * 0.90;
      }
    },
  };
}

export const sparrowAndHorse: BuildScene = (art, rng, ground) => {
  const roadZ = (x: number) => -0.15 + Math.sin(x * 1.24) * 0.18;
  for (let i = 0; i < 14; i++) {
    const x = -2.20 + i * 0.34;
    const z = roadZ(x);
    art.facet(i % 3 ? 0xb29972 : 0xa98e67, x, ground(x, z) + 0.016, z, 0.33, 0.015, 0.44);
    const edge = z + (i % 2 ? -0.63 : 0.66);
    art.facet(0x9b9883, x, ground(x, edge) + 0.037, edge, rng.range(0.08, 0.18), 0.10, 0.14);
  }

  const perchX = 0.46;
  const perchZ = -1.22;
  const chickHomeX = 0.08;
  const chickHomeZ = roadZ(chickHomeX) - 0.39;
  const perchY = ground(perchX, perchZ);
  art.box(0.12, 0.72, 0.15, TIMBER, perchX, perchY + 0.35, perchZ);
  art.box(0.12, 0.62, 0.14, TIMBER, 1.26, ground(1.26, -1.31) + 0.30, -1.31);
  branch(art, new THREE.Vector3(perchX, perchY + 0.55, perchZ), new THREE.Vector3(1.26, ground(1.26, -1.31) + 0.46, -1.31), 0.045, 0x9f8366, false);

  const { horse, trot } = buildHorse(art);
  const chick = new THREE.Group();
  chick.add(art.facet(0xb19372, 0, 0.095, -0.02, 0.103, 0.105, 0.148));
  chick.add(art.facet(0xd5bf9d, 0, 0.061, 0.041, 0.077, 0.055, 0.090));
  chick.add(art.facet(0x8e694f, 0, 0.154, 0.088, 0.082, 0.077, 0.081));
  chick.add(art.facet(0xc2a056, 0, 0.132, 0.171, 0.033, 0.028, 0.057));
  for (const side of [-1, 1]) chick.add(art.facet(0x493d31, side * 0.062, 0.158, 0.119, 0.017, 0.017, 0.017));
  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Group();
    wing.position.set(side * 0.07, 0.103, 0);
    wing.add(art.facet(0x967451, side * 0.068, 0, -0.056, 0.116, 0.033, 0.099));
    chick.add(wing);
    return { wing, side };
  });
  art.root.add(chick);

  return (life, age) => {
    const lap = Math.floor(age / 7.8);
    const time = age % 7.8;
    const direction = lap % 2 ? -1 : 1;
    const travel = THREE.MathUtils.clamp((time - 1.18) / 3.12, 0, 1);
    const x = direction * (-2.40 + travel * 4.8);
    const z = roadZ(x);
    const showing = THREE.MathUtils.smoothstep(travel, 0, 0.11) * (1 - THREE.MathUtils.smoothstep(travel, 0.90, 1));
    horse.visible = life > 0.42 && showing > 0;
    horse.scale.setScalar(showing * 0.94);
    horse.position.set(x, ground(x, z), z);
    horse.rotation.y = Math.atan2(direction, direction * 0.223 * Math.cos(x * 1.24));
    trot(travel * TAU * 5.25);

    const up = THREE.MathUtils.smoothstep(time, 2.42, 2.85);
    const down = THREE.MathUtils.smoothstep(time, 4.66, 5.26);
    const hop = up * (1 - down);
    const flapping = Math.sin(Math.PI * hop);
    const chickX = THREE.MathUtils.lerp(chickHomeX, perchX, hop);
    const chickZ = THREE.MathUtils.lerp(chickHomeZ, perchZ, hop);
    const chickY = THREE.MathUtils.lerp(ground(chickHomeX, chickHomeZ), perchY + 0.71, hop);
    chick.visible = life > 0.31;
    chick.position.set(chickX, chickY + flapping * 0.42 + Math.max(0, Math.sin(age * 9) - 0.86) * 0.093, chickZ);
    chick.rotation.y = -0.41 + hop * 1.8;
    for (const { wing, side } of wings) wing.rotation.z = side * flapping * 1.18 * Math.sin(age * 28);
  };
};

export const springSea: BuildScene = (art, rng) => {
  for (let i = 0; i < 12; i++) {
    const x = -1.93 + 0.35 * i;
    const z = -1.43 + 0.52 * Math.sin(i * 0.41) + rng.range(-0.16, 0.14);
    const rock = art.facet(i % 3 ? 0x8a9c96 : 0xb5b5a0, x, 0.064, z, rng.range(0.22, 0.48), rng.range(0.10, 0.29), 0.33);
    rock.rotation.y = rng.range(0, TAU);
    if (i % 3 === 1) {
      art.facet(0xa2af9d, x + 0.15, 0.091, z + 0.31, rng.range(0.14, 0.26), 0.10, 0.19);
    }
  }
  const strip = new THREE.BufferGeometry();
  const vertices: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = -1 + i * 0.1;
    const b = a + 0.1;
    const near = (x: number) => 0.18 * x * x + 0.055 * Math.sin(x * 8.5);
    const far = (x: number) => near(x) + 0.046 * (1 - x * x) + 0.006;
    vertices.push(a, 0, near(a), b, 0, near(b), b, 0, far(b), a, 0, near(a), b, 0, far(b), a, 0, far(a));
  }
  strip.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const rolls = Array.from({ length: 8 }, (_, i) => {
    const mesh = new THREE.Mesh(strip, new THREE.MeshBasicMaterial({
      color: i % 3 ? 0xbcdfd8 : 0xe1eee1, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    art.root.add(mesh);
    return { mesh, phase: i / 8, dx: rng.range(-0.40, 0.45), width: rng.range(0.59, 1.22) };
  });
  return (life, age) => {
    for (const { mesh, phase, dx, width } of rolls) {
      const cycle = (phase + age * 0.18) % 1;
      mesh.visible = life > 0.10;
      mesh.position.set(dx + 0.17 * Math.sin(cycle * TAU), 0.10 + 0.026 * Math.sin(cycle * Math.PI), 1.69 - cycle * 3.13);
      mesh.scale.set(width * (0.78 + cycle * 0.73), 1, 0.78 + cycle * 0.24);
      mesh.material.opacity = 0.63 * life * Math.sin(cycle * Math.PI) ** 0.73;
    }
  };
};

export const winterRiverLeek: BuildScene = (art, rng) => {
  for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
    const z = -1.67 + i * 0.32;
    const x = side * (1.14 + 0.29 * Math.sin(z * 1.49 + side) + rng.range(-0.16, 0.16));
    const ice = art.facet(i % 4 ? 0xceeaef : 0xa1c3cb, x, 0.090, z, rng.range(0.22, 0.56), rng.range(0.055, 0.105), rng.range(0.23, 0.36));
    ice.rotation.y = rng.range(0, TAU);
    if (i % 3 === 0) {
      const stone = art.facet(0x89989e, x + side * 0.34, 0.13, z, 0.34, 0.22, 0.27);
      stone.rotation.y = rng.range(0, TAU);
    }
  }
  const leek = new THREE.Group();
  leek.add(branch(art, new THREE.Vector3(0, 0, -0.39), new THREE.Vector3(0, 0.02, 0.08), 0.079, 0xf4eac8, false));
  leek.add(art.facet(0xe9ddbb, 0, 0, -0.37, 0.074, 0.061, 0.12));
  for (let i = 0; i < 5; i++) {
    const tip = new THREE.Vector3((i - 2) * 0.14, 0.09 + (i % 2) * 0.046, 0.51 - Math.abs(i - 2) * 0.075);
    const leaf = blade(art, i % 2 ? 0x7c9e5d : 0x527d56, tip.x * 0.36, 0.047, 0.04, 0.14, tip.distanceTo(new THREE.Vector3(0, 0, 0.02)));
    leaf.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, tip.clone().normalize());
    leek.add(leaf);
  }
  art.root.add(leek);
  const ringGeometry = new THREE.RingGeometry(0.92, 1, 24);
  const ripples = Array.from({ length: 5 }, (_, i) => {
    const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      color: 0xc6e5ec, side: THREE.DoubleSide, depthWrite: false, transparent: true,
    }));
    mesh.rotation.x = -Math.PI / 2;
    art.root.add(mesh);
    return { mesh, offset: i * 0.24 };
  });
  return (life, age) => {
    const cycle = (age * 0.15) % 1;
    const z = -2.02 + cycle * 4.10;
    const x = 0.34 * Math.sin(cycle * TAU + 0.8);
    const f = THREE.MathUtils.smoothstep(cycle, 0, 0.12) * (1 - THREE.MathUtils.smoothstep(cycle, 0.88, 1));
    leek.visible = life > 0.22;
    leek.scale.setScalar(f * 1.34);
    leek.position.set(x, 0.13 + 0.026 * Math.sin(age * 4.5), z);
    leek.rotation.set(0.12 * Math.sin(age * 2.8), 0.53 * Math.cos(cycle * TAU + 0.8), 0.13 * Math.cos(age * 3));
    for (const { mesh, offset } of ripples) {
      const t = (age * 0.88 + offset) % 1;
      mesh.visible = life > 0.25;
      mesh.position.set(x, 0.107, z - 0.16 - t * 0.52);
      mesh.scale.set(0.09 + t * 0.33, 0.10 + t * 0.21, 1);
      mesh.material.opacity = life * f * (1 - t) * 0.50;
    }
  };
};

export const morningHaze: BuildScene = (art, rng, ground) => {
  const silhouettes = [
    [-1.55, -0.56, 1.08], [-0.87, -0.87, 1.71], [-0.29, -1.09, 2.63],
    [0.42, -0.94, 1.99], [0.94, -0.43, 1.44], [1.42, -0.09, 0.68],
  ];
  for (const [i, [x, z, h]] of silhouettes.entries()) {
    const peak = art.facet(i % 3 ? 0x7d8790 : 0x90969b, x, ground(x, z) + h * 0.48, z, 0.56 + h * 0.13, h * 0.72, 0.58);
    peak.rotation.set(-0.11, 0.29 + i * 0.72, rng.range(-0.25, 0.20));
    peak.castShadow = true;
    art.facet(i % 2 ? 0x98a182 : 0x859883, x - 0.21, ground(x - 0.21, z + 0.49) + 0.072, z + 0.49, 0.41, 0.17, 0.29);
  }
  const veil = new THREE.PlaneGeometry(1, 1);
  const banks = Array.from({ length: 7 }, (_, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { density: { value: 0 }, phase: { value: i * 0.73 } },
      vertexShader: `
        varying vec2 plume;
        void main() {
          plume = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float density;
        uniform float phase;
        varying vec2 plume;
        void main() {
          float shape = length(plume + vec2(0.0, 0.13 * sin(plume.x * 10.0 + phase)));
          float edge = 1.0 - smoothstep(0.18, 0.98, shape);
          gl_FragColor = vec4(0.69, 0.75, 0.77, density * edge * edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(veil, material);
    mesh.rotation.set(-0.33, 0.57, -0.05 + (i % 3) * 0.10);
    art.root.add(mesh);
    return { mesh, phase: i / 7, z: rng.range(-0.75, 0.72), height: rng.range(0.37, 1.24), w: rng.range(1.18, 2.41) };
  });
  return (life, age) => {
    for (const { mesh, phase, z, height, w } of banks) {
      const t = (phase + age * 0.088) % 1;
      mesh.visible = life > 0.14;
      const x = -2.25 + t * 4.66;
      mesh.position.set(x, ground(x, z) + height + 0.23 * Math.sin(t * TAU), z + 0.14 * t);
      mesh.scale.set(w + t * 0.74, 0.62 + t * 0.46, 1);
      mesh.material.uniforms.density.value = 0.62 * life * Math.sin(Math.PI * t);
      mesh.material.uniforms.phase.value = age * 0.29 + phase * TAU;
    }
  };
};

export const moonlitAlley: BuildScene = (art, rng, ground) => {
  const windows = [-1.04, 0.41, 1.70].map((x, i) => {
    const z = -0.77 - 0.10 * i;
    const y = ground(x, z);
    const w = i === 1 ? 1.32 : 1.09;
    const h = [1.26, 1.65, 1.11][i];
    const wall = [0xaaa99a, 0x96948c, 0xad9f91][i];
    const roof = [0x585965, 0x515763, 0x676370][i];
    art.box(w, h, 0.94, wall, x, y + h / 2, z).castShadow = true;
    art.box(w + 0.10, 0.17, 0.99, 0x6b6761, x, y + 0.022, z);
    for (const side of [-1, 1]) {
      art.box(0.069, h + 0.09, 0.068, TIMBER, x + side * (w * 0.45), y + h / 2, z + 0.475);
      const slope = art.box(w + 0.20, 0.083, 0.64, roof, x, y + h + 0.112, z + side * 0.27);
      slope.rotation.x = side * 0.35;
      slope.castShadow = true;
    }
    art.box(w + 0.24, 0.078, 0.103, 0x535362, x, y + h + 0.229, z);
    art.box(w + 0.18, 0.054, 0.067, roof, x, y + h + 0.013, z + 0.58);
    art.box(w - 0.33, 0.57, 0.055, 0x6a5d53, x, y + 0.48, z + 0.482);
    const paper = art.box(w - 0.43, 0.445, 0.039, [0xb9ad93, 0xb9ad92, 0xb9ad91][i], x, y + 0.501, z + 0.517);
    paper.material.emissive.setHex(i === 1 ? 0xf2cf98 : 0xaac6df);
    for (let j = -2; j <= 2; j++) {
      art.box(0.024, 0.46, 0.03, TIMBER, x + j * w * 0.115, y + 0.502, z + 0.539);
    }
    art.box(w - 0.44, 0.032, 0.032, TIMBER, x, y + 0.51, z + 0.539);
    return paper;
  });

  const paving = new Set<THREE.MeshStandardMaterial>();
  for (let i = 0; i < 14; i++) {
    const x = -2.24 + i * 0.323;
    const z = 0.44 + 0.16 * Math.sin(x * 1.34);
    const stone = art.facet(i % 2 ? 0xadb3b1 : 0x969f9e, x, ground(x, z) + 0.018, z, 0.29, 0.041, 0.36);
    stone.rotation.y = rng.range(-0.25, 0.25);
    stone.material.emissive.setHex(0xa3bfd7);
    paving.add(stone.material);
    if (i % 4 !== 1) continue;
    const jar = art.cylinder(0.141, 0.126, 0.25, 7, 0x7e6c60, x, ground(x, z + 0.47) + 0.10, z + 0.47);
    jar.scale.z = 0.87;
    art.cylinder(0.15, 0.15, 0.035, 7, 0x9a8b70, x, ground(x, z + 0.47) + 0.228, z + 0.47);
  }

  return (life, age) => {
    for (const [i, pane] of windows.entries()) {
      pane.material.emissiveIntensity = life * (i === 1 ? 0.43 + 0.025 * Math.sin(age * 4.2) : 0.18);
    }
    for (const material of paving) material.emissiveIntensity = life * 0.12;
  };
};
