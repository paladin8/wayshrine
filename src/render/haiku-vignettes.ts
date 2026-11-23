import * as THREE from "three";
import { blade, branch, TAU, TIMBER, type BuildScene, type Scenery } from "./haiku-scenery";

export const cicadaRocks: BuildScene = (art, rng, ground) => {
  const outcrop = [
    { x: -1.12, z: -0.30, w: 0.78, h: 1.40, d: 0.65 },
    { x: -0.26, z: -0.75, w: 0.91, h: 1.68, d: 0.77 },
    { x: 0.74, z: -0.49, w: 0.66, h: 1.03, d: 0.66 },
    { x: 1.33, z: -0.08, w: 0.52, h: 0.61, d: 0.50 },
    { x: -0.16, z: 0.24, w: 0.99, h: 0.61, d: 0.69 },
  ];
  const rocks = outcrop.map(({ x, z, w, h, d }, i) => {
    const y = ground(x, z) + h * 0.51;
    const rock = art.facet(i % 2 ? 0x8a8f93 : 0x777e83, x, y, z, w, h, d);
    rock.rotation.set(rng.range(-0.20, 0.17), rng.range(0, TAU), rng.range(-0.23, 0.23));
    rock.castShadow = true;
    for (let j = 0; j < 3; j++) {
      const dx = x + rng.range(-0.45, 0.45);
      const dz = z + rng.range(0.35, 0.58);
      art.facet(j % 2 ? 0x859568 : 0xa6a277, dx, ground(dx, dz) + 0.035, dz,
        rng.range(0.13, 0.30), 0.08, rng.range(0.12, 0.23));
    }
    return rock;
  });
  art.root.updateMatrixWorld(true);
  const probe = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);

  const insects = [[-0.22, 0.52], [0.78, -0.18], [-1.19, 0.08]].map(([x, z], i) => {
    const bug = new THREE.Group();
    const floor = ground(x, z);
    probe.set(new THREE.Vector3(x, floor + 4, z), down);
    const y = (probe.intersectObjects(rocks)[0]?.point.y ?? floor) + 0.018;
    bug.position.set(x, y, z);
    bug.rotation.y = rng.range(-1.0, 1.0);
    bug.add(art.facet(0x756044, 0, 0.10, 0, 0.10, 0.094, 0.22));
    bug.add(art.facet(0x575344, 0, 0.13, -0.13, 0.11, 0.09, 0.10));
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Group();
      wing.position.set(side * 0.035, 0.153, -0.059);
      const cover = art.facet(i % 2 ? 0xcdbb87 : 0xb1c0aa, side * 0.053, 0, 0.127, 0.077, 0.018, 0.18);
      cover.rotation.y = side * 0.31;
      wing.add(cover);
      wing.add(art.facet(0xe5d5a6, side * 0.053, 0.016, 0.12, 0.020, 0.010, 0.134));
      bug.add(wing);
      return { wing, side };
    });
    art.root.add(bug);
    return { bug, wings, phase: i * 2.5, y };
  });

  return (life, age) => {
    for (const { bug, wings, phase, y } of insects) {
      const tremor = Math.pow(0.5 + 0.5 * Math.sin(age * 2.6 + phase), 6);
      const flutter = life * tremor * (0.21 + 0.17 * Math.sin(age * 34));
      bug.visible = life > 0.20;
      bug.position.y = y + 0.07 * flutter;
      for (const { wing, side } of wings) wing.rotation.z = side * flutter;
    }
  };
};

export const summerBattlefield: BuildScene = (art, rng, ground) => {
  const stones = [
    [-1.48, -0.48, 0.29], [-0.92, -0.58, 0.36], [-0.34, -0.62, 0.34], [0.23, -0.66, 0.31],
    [0.80, -0.73, 0.27], [1.34, -0.83, 0.22], [-1.64, -0.01, 0.29], [-1.67, 0.51, 0.26],
  ];
  for (const [i, [x, z, height]] of stones.entries()) {
    const y = ground(x, z);
    const block = art.box(0.55, height, 0.58, i % 2 ? 0x8c8c75 : 0x9d9a80, x, y + height * 0.4, z);
    block.rotation.set(rng.range(-0.12, 0.12), rng.range(-0.24, 0.21), rng.range(-0.10, 0.10));
    block.castShadow = true;
    if (i < 3 || i === 6) {
      const fallen = art.facet(0x938e7b, x - 0.07, y + height, z + 0.025, 0.34, 0.27, 0.34);
      fallen.rotation.set(0.23, i * 0.85, -0.21);
      fallen.castShadow = true;
    }
    art.facet(0x77875b, x - 0.12, y + height * 0.64, z + 0.23, 0.26, 0.12, 0.13);
  }

  const tussocks = Array.from({ length: 26 }, (_, i) => {
    const x = rng.range(-1.85, 1.74);
    const z = rng.range(-1.30, 1.17);
    const base = new THREE.Group();
    base.position.set(x, ground(x, z), z);
    const height = rng.range(0.30, 0.99);
    for (let j = 0; j < 4; j++) {
      const leaf = blade(art, rng.pick([0x738e4c, 0x94a653, 0xafbb68]), 0, 0, 0, rng.range(0.10, 0.18), height * rng.range(0.63, 1.15));
      leaf.rotation.set(rng.range(-0.32, 0.26), j * TAU / 4 + i, rng.range(-0.38, 0.40));
      base.add(leaf);
    }
    art.root.add(base);
    return { base, phase: i * 0.91, x, lifeThreshold: rng.range(0.03, 0.31) };
  });

  return (life, age) => {
    for (const { base, phase, x, lifeThreshold } of tussocks) {
      base.scale.y = 0.27 + 0.73 * THREE.MathUtils.smoothstep(life, lifeThreshold, lifeThreshold + 0.48);
      base.rotation.z = life * (0.13 + 0.21 * Math.sin(age * 2.1 - x * 1.10) + 0.065 * Math.sin(age * 4.4 + phase));
      base.rotation.x = life * Math.sin(age * 2.8 + phase) * 0.13;
    }
  };
};

function glowTexture(): THREE.DataTexture {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
    const i = 4 * (y * size + x);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * Math.max(0, 1 - radius * radius) ** 3.4);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const foxfireGlow = glowTexture();

export const foxfireWheat: BuildScene = (art, rng, ground) => {
  const rows = [-1.15, -0.39, 0.43, 1.03].map((z, row) => {
    const stems = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const x = (i - 6.5) * 0.29 + rng.range(-0.07, 0.07);
      const dz = z + Math.sin(x * 1.4 + row) * 0.20 + rng.range(-0.10, 0.10);
      const y = ground(x, dz);
      const h = rng.range(0.48, 0.88);
      const bend = rng.range(0.07, 0.18);
      const soil = art.facet(row % 2 ? 0x776851 : 0x837555, x, y + 0.020, dz, 0.25, 0.056, 0.17);
      soil.rotation.y = -0.28;
      stems.add(branch(art, new THREE.Vector3(x, y, dz), new THREE.Vector3(x + bend, y + h, dz), 0.013, 0xb39b5e, false));
      const ear = art.facet(rng.pick([0xe0bd6a, 0xf4d584, 0xbfa266]), x + bend + 0.035, y + h + 0.065, dz, 0.052, 0.14, 0.052);
      ear.rotation.z = -0.46;
      stems.add(ear);
      if (i % 2 === 0) {
        const leaf = blade(art, 0x849364, x + bend * 0.34, y + h * 0.29, dz, 0.082, h * 0.45);
        leaf.rotation.z = -0.69;
        stems.add(leaf);
      }
    }
    art.root.add(stems);
    return stems;
  });
  const wisps = [[-1.35, 0.42], [-0.49, -0.85], [0.02, 0.89], [0.86, -0.56], [1.34, 0.64]].map(([x, z], i) => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: foxfireGlow, color: i % 2 ? 0x44bcff : 0x6dfcca, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const ember = new THREE.Sprite(new THREE.SpriteMaterial({
      map: foxfireGlow, color: 0xc5fff1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.add(ember);
    art.root.add(halo);
    return { halo, ember, x, z, y: ground(x, z) + rng.range(0.78, 1.37), phase: rng.range(0, TAU) };
  });

  return (life, age) => {
    for (const [i, row] of rows.entries()) row.rotation.z = life * (0.035 + 0.078 * Math.sin(age * 1.6 - i * 0.53));
    for (const { halo, ember, x, z, y, phase } of wisps) {
      const drift = age * 1.12 + phase;
      const flicker = 0.52 + 0.33 * Math.sin(drift) + 0.13 * Math.sin(age * 4.0 + phase);
      halo.visible = life > 0.13;
      halo.position.set(x + 0.32 * Math.cos(drift * 0.89), y + 0.21 * Math.sin(drift * 1.16), z + 0.27 * Math.sin(drift));
      const size = 0.49 + 0.29 * flicker;
      halo.scale.set(size, size * 1.24, 1);
      halo.material.opacity = life * (0.19 + 0.70 * flicker);
      ember.scale.set(0.34, 0.33, 1);
      ember.material.opacity = life * (0.36 + 0.43 * flicker);
    }
  };
};

export const autumnRoad: BuildScene = (art, rng, ground) => {
  const reds = [0xa64134, 0xca5838, 0xde743b, 0xc9894c, 0x8f4638];
  for (let i = -5; i <= 5; i++) {
    const z = i * 0.41;
    const x = 0.78 + 0.53 * Math.sin(z * 0.88 + 0.71);
    const paver = art.facet(i % 2 ? 0xa09a87 : 0xb3aa91, x, ground(x, z) + 0.02, z,
      rng.range(0.52, 0.68), rng.range(0.064, 0.115), rng.range(0.22, 0.31));
    paver.rotation.y = rng.range(-0.21, 0.21);
    if (i % 3 !== 0) {
      const verge = x - rng.range(0.67, 0.88);
      art.facet(0x8a8a76, verge, ground(verge, z) + 0.04, z, 0.20, 0.13, 0.16);
    }
  }
  const trunk = new THREE.Vector3(-1.14, ground(-1.14, -0.48) - 0.07, -0.48);
  const fork = trunk.clone().add(new THREE.Vector3(0.33, 1.29, 0.04));
  branch(art, trunk, fork, 0.19, TIMBER);
  for (const [x, y, z] of [[-0.76, 0.85, 0.25], [-0.61, 1.16, -0.43], [0.18, 1.13, 0.34], [0.85, 0.92, -0.17], [0.41, 1.44, -0.52], [0.67, 0.67, 0.64]]) {
    const tip = fork.clone().add(new THREE.Vector3(x, y, z));
    branch(art, fork, tip, 0.075, TIMBER);
    for (let j = 0; j < 4; j++) {
      const size = rng.range(0.29, 0.60);
      const crown = art.facet(rng.pick(reds), tip.x + rng.range(-0.33, 0.33), tip.y + rng.range(-0.08, 0.28),
        tip.z + rng.range(-0.30, 0.32), size, size * 0.61, size * 0.80);
      crown.rotation.y = rng.range(0, TAU);
      crown.castShadow = true;
    }
  }
  for (let i = 0; i < 25; i++) {
    const x = rng.range(-1.61, 1.63);
    const z = rng.range(-1.83, 1.81);
    const leaf = art.facet(rng.pick(reds), x, ground(x, z) + 0.045, z, rng.range(0.045, 0.095), 0.018, 0.063);
    leaf.rotation.y = rng.range(0, TAU);
  }
  const leaves = Array.from({ length: 19 }, () => ({
    mesh: art.facet(rng.pick(reds), 0, 0, 0, rng.range(0.051, 0.101), 0.022, 0.068),
    x: rng.range(-1.40, 0.66), z: rng.range(-1.09, 0.70), phase: rng.next(), speed: rng.range(0.15, 0.29),
  }));
  return (life, age) => {
    for (const { mesh, x, z, phase, speed } of leaves) {
      const t = (phase + age * speed) % 1;
      const drift = 0.28 * Math.sin(t * TAU + phase * 11);
      mesh.visible = life > phase;
      mesh.position.set(x + 1.41 * t + drift, ground(x, z) + 0.10 + (1 - t) * 2.69, z + 0.58 * t);
      mesh.rotation.set(age * 2.2 + phase * TAU, t * TAU, age * 1.7);
    }
  };
};

function goose(art: Scenery, scale: number) {
  const body = new THREE.Group();
  body.scale.setScalar(scale);
  body.add(art.facet(0x8c8179, 0, 0, 0, 0.19, 0.16, 0.36));
  body.add(art.facet(0xcac1ad, 0, -0.064, 0.021, 0.17, 0.106, 0.30));
  body.add(art.facet(0x5f5b58, 0, 0.010, -0.29, 0.14, 0.066, 0.18));
  body.add(branch(art, new THREE.Vector3(0, 0.04, 0.18), new THREE.Vector3(0, 0.17, 0.48), 0.082, 0x685d53, false));
  body.add(art.facet(0x72675b, 0, 0.185, 0.488, 0.085, 0.083, 0.11));
  body.add(art.facet(0xe2d6c0, 0, 0.186, 0.554, 0.071, 0.071, 0.046));
  body.add(art.facet(0xd99758, 0, 0.169, 0.619, 0.052, 0.032, 0.082));
  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Group();
    wing.position.set(side * 0.09, 0.068, 0.066);
    wing.add(art.facet(0x8e8177, side * 0.25, 0, -0.04, 0.34, 0.071, 0.22));
    const tip = art.facet(0x645c5b, side * 0.57, -0.005, -0.16, 0.33, 0.048, 0.18);
    tip.rotation.y = side * 0.40;
    wing.add(tip);
    body.add(wing);
    return { wing, side };
  });
  return { body, wings };
}

export const geeseHome: BuildScene = (art, rng) => {
  for (let i = 0; i < 12; i++) {
    const angle = Math.PI * (0.80 + i * 0.068);
    const x = 1.86 * Math.cos(angle);
    const z = 1.15 * Math.sin(angle) - 0.39;
    const shoal = art.facet(i % 3 ? 0x83917d : 0xa09f87, x, 0.068, z,
      rng.range(0.23, 0.41), rng.range(0.12, 0.23), rng.range(0.26, 0.38));
    shoal.rotation.y = rng.range(0, TAU);
    if (i % 2 === 0) for (let j = 0; j < 4; j++) {
      const reed = blade(art, j % 2 ? 0x959854 : 0x75865b, x + rng.range(-0.12, 0.12), 0.11,
        z + rng.range(-0.14, 0.14), 0.09, rng.range(0.40, 0.83));
      reed.rotation.y = rng.range(0, TAU);
    }
  }
  const flight = new THREE.Group();
  art.root.add(flight);
  const formation = [[0, 0], [-0.91, -0.82], [0.88, -0.72], [-1.67, -1.65], [1.61, -1.50]];
  const flock = formation.map(([x, z], index) => {
    const { body, wings } = goose(art, rng.range(0.78, 0.96));
    flight.add(body);
    return { body, wings, x, z, phase: index * 0.77 };
  });
  return (life, age) => {
    const time = age % 10.4;
    const takeoff = THREE.MathUtils.smoothstep(time, 1.45, 3.67);
    const landing = THREE.MathUtils.smoothstep(time, 8.0, 10.39);
    const flying = takeoff * (1 - landing);
    // A broad turn brings the flock back around, with the V tightening once airborne.
    const lap = (time / 10.4) * TAU;
    const trackX = 1.21 * (1 - Math.cos(lap));
    const trackZ = 2.48 * Math.sin(lap);
    flight.position.set(trackX, 0.19 + 2.9 * flying, trackZ);
    flight.rotation.y = Math.atan2(1.21 * Math.sin(lap), 2.48 * Math.cos(lap));
    flight.visible = life > 0.29;
    for (const { body, wings, x, z, phase } of flock) {
      body.position.set(x * (1 - flying * 0.11), Math.sin(age * 3.1 + phase) * (0.032 + flying * 0.082), z);
      body.rotation.x = (landing - takeoff) * 0.10 * (1 - flying);
      const beat = Math.sin(age * 12.8 - phase) * (0.46 + 0.37 * Math.sin(time * 0.62) ** 2);
      for (const { wing, side } of wings) wing.rotation.z = side * (0.80 * (1 - flying) + flying * beat);
    }
  };
};
