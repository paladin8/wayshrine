import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRng } from "../core";

type GroundPoint = readonly [x: number, z: number];

const LAND = 0x91ab69;
const WATER = 0x8cb9c5;
const FIELD_WATER = [0x7eaba0, 0x8cb8b3, 0x9ac0c5, 0x93b5a5];
const BANKS = [0x819b60, 0x769458, 0x91a765, 0x9aae72];
const RICE = [0x70954d, 0x83a858, 0x8caf5c, 0x57793d];
const ROOFS = [0x3b505d, 0x514b4a, 0x4e5653, 0x626b65];
const WALLS = [0xe4d9b9, 0xf0e5d3, 0xbfa883, 0xcab393];
const TREES = [0x527348, 0x67874e, 0x789658, 0x466747];

function geometryBatch() {
  const parts: THREE.BufferGeometry[] = [];

  function add(geometry: THREE.BufferGeometry, hex: number): void {
    geometry.deleteAttribute("uv");
    const count = geometry.getAttribute("position").count;
    if (!geometry.index) geometry.setIndex(Array.from({ length: count }, (_, index) => index));
    const color = new THREE.Color(hex);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
  }

  return {
    add,
    box(hex: number, x: number, y: number, z: number, width: number, height: number, depth: number): void {
      add(new THREE.BoxGeometry(width, height, depth).translate(x, y, z), hex);
    },
    surface(points: readonly [number, number, number][], triangles: number[], hex: number): void {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
      geometry.setIndex(triangles);
      geometry.computeVertexNormals();
      add(geometry, hex);
    },
    plane(hex: number, x0: number, x1: number, z0: number, z1: number, y: number): void {
      add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), hex);
    },
    mesh(material: THREE.Material) {
      const geometry = mergeGeometries(parts);
      parts.forEach((piece) => piece.dispose());
      if (!geometry) throw new Error("Could not merge the Fuji countryside geometry");
      return new THREE.Mesh(geometry, material);
    },
  };
}

type Batch = ReturnType<typeof geometryBatch>;

function riverCentre(z: number): number {
  return 15 + Math.sin(-z / 55) * 23 + Math.sin(-z / 136) * 33;
}

function riverWidth(z: number): number {
  return 7 + 4 * Math.exp(z / 210);
}

function riverStrip(
  batch: Batch, extra: number, y: number, color: number, centre = riverCentre, halfWidth = riverWidth,
): void {
  const points: [number, number, number][] = [];
  const indices: number[] = [];
  for (let index = 0; index <= 80; index++) {
    const z = 25 - index * 8;
    const center = centre(z), width = halfWidth(z) + extra;
    points.push([center - width, y, z], [center + width, y, z]);
    const i = index * 2;
    if (index) indices.push(i - 2, i - 1, i, i - 1, i + 1, i);
  }
  batch.surface(points, indices, color);
}

function createWaterMaterial(time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    emissive: 0x344b5d,
    emissiveIntensity: 0.28,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.vistaTime = time;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vPaddy;");
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPaddy = position.xz;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vPaddy;\nuniform float vistaTime;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float wave = sin(vPaddy.y * 2.5 + sin(vPaddy.x * .4) * 1.5 + vistaTime * 1.7);
      float glint = pow(max(0., wave), 9.) * (.5 + .5 * sin(vPaddy.x * 2.1 + vPaddy.y * .5));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.58, .74, .83), glint * .21);
    `);
  };
  return material;
}

function plantedRice(scene: THREE.Scene, points: readonly GroundPoint[]): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.07, 0, 0, 0.03, 0, 0.01, -0.20, 0.32, 0.05,
    0, 0, -0.04, 0.08, 0, 0.04, 0.22, 0.40, 0.03,
    -0.04, 0, 0.05, 0.07, 0, 0.05, 0.02, 0.43, -0.17,
  ], 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.91 });
  const rice = new THREE.InstancedMesh(geometry, material, points.length);
  const rng = createRng("fuji-scenery-rice");
  const transform = new THREE.Object3D(), color = new THREE.Color();
  points.forEach(([x, z], i) => {
    transform.position.set(x, 0.02, z);
    transform.rotation.y = rng.range(0, Math.PI * 2);
    transform.scale.setScalar(rng.range(0.74, 1.2));
    transform.updateMatrix();
    rice.setMatrixAt(i, transform.matrix);
    rice.setColorAt(i, color.setHex(rng.pick(RICE)));
  });
  scene.add(rice);
}

function paddies(
  land: Batch, water: Batch, houses: readonly GroundPoint[],
): GroundPoint[] {
  const plants: GroundPoint[] = [];
  const rng = createRng("fuji-scenery-fields");
  const rows = [-5.8, -18.5, -34, -51, -72, -95, -118, -149, -189, -232, -277, -333];
  for (let row = 0; row < rows.length - 1; row++) {
    const front = rows[row]!, back = rows[row + 1]!;
    const mid = (front + back) / 2;
    const depths = [front, mid, back];
    const banks = ([[riverCentre, riverWidth], [gorgeCentre, gorgeWidth]] as const).map(([centre, width]) => ({
      left: Math.min(...depths.map(z => centre(z) - width(z) - 3)),
      right: Math.max(...depths.map(z => centre(z) + width(z) + 3)),
    }));
    const setback = row === 2 || row === 5 ? 2.05 : 0.8;
    for (let west = -515 - rng.range(0, 19); west < 530;) {
      const east = west + rng.range(15, 31) * (1 + row * 0.075);
      const clearRiver = banks.every(({ left, right }) => east < left || west > right);
      const clearHouses = !houses.some(([x, z]) => x > west - 7 && x < east + 7 && z < front + 9 && z > back - 9);
      const clearGroves = row > 2 || east < 297 || west > 525;
      if (clearRiver && clearHouses && clearGroves) {
        const color = rng.pick(BANKS);
        land.plane(color, west, east - 0.35, back + 0.25, front - 0.25, -0.02);
        if (!rng.chance(0.14)) {
          water.plane(rng.pick(FIELD_WATER), west + 0.58, east - 1.02, back + 0.65, front - setback, 0.01);
          for (let z = back + 1.3; z < front - setback - 0.32; z += row < 6 ? 1.22 : 2.4) {
            if (row >= 6) {
              land.plane(0x83a071, west + 1.05, east - 1.35, z, z + 0.24, 0.045);
            } else {
              for (let x = west + 1.1; x < east - 1.35; x += row < 3 ? 1.14 : 1.75) {
                plants.push([x + rng.range(-0.08, 0.08), z + rng.range(-0.07, 0.07)]);
              }
            }
          }
        }
        land.box(color, (west + east) / 2, 0.07, front - 0.17, east - west - 0.35, 0.14, 0.34);
        land.box(color, west + 0.1, 0.05, mid, 0.22, 0.12, front - back - 0.45);
      }
      west = east + rng.range(0.32, 1.15);
    }
  }
  return plants;
}

function farmHouse(batch: Batch, x: number, z: number, size: number, roof: number, wall: number): void {
  const width = 7.8 * size, depth = 5.1 * size;
  const eave = 3.1 * size, ridge = 4.92 * size;
  const left = x - width / 2 - 0.56 * size, right = x + width / 2 + 0.56 * size;
  const front = z + depth / 2 + 0.55 * size, back = z - depth / 2 - 0.55 * size;
  batch.plane(0x7d935e, left - 1, right + 3, back - 2, front + 0.8, -0.04);
  batch.box(0x938a72, x, 0.15, z, width + 0.26, 0.32, depth + 0.2);
  batch.box(wall, x, eave / 2, z, width, eave, depth);
  batch.surface([[left,eave,front],[right,eave,front],[right,ridge,z],[left,ridge,z],
    [left,eave,back],[right,eave,back]], [0,1,2,0,2,3,3,2,5,3,5,4], roof);
  const half = depth / 2;
  const edge = width / 2;
  batch.surface([[x-edge,eave,z-half],[x-edge,eave,z+half],[x-edge,ridge,z],
    [x+edge,eave,z-half],[x+edge,eave,z+half],[x+edge,ridge,z]], [0,1,2,4,3,5], wall);
  batch.box(roof, x, ridge, z, right - left + 0.26, 0.17 * size, 0.32 * size);
  batch.box(roof, x, eave, front - 0.03, right - left, 0.16 * size, 0.11 * size);
  const rise = ridge - eave, run = front - z;
  const pitch = Math.atan2(rise, run);
  const slope = Math.hypot(rise, run);
  for (let rib = left + 0.29 * size; rib < right - 0.2 * size; rib += 0.32 * size) {
    for (const side of [-1, 1]) {
      batch.add(new THREE.BoxGeometry(0.062 * size, 0.044 * size, slope)
        .rotateX(pitch * side).translate(rib, (ridge + eave) / 2 + 0.018 * size, z + side * run / 2), roof);
    }
  }
  const facade = z + half;
  const timber = 0x776349;
  batch.box(timber, x, 2.65 * size, facade + 0.034, width, 0.15 * size, 0.13);
  batch.box(timber, x, 0.34 * size, facade + 0.032, width, 0.49 * size, 0.084);
  for (const offset of [-3.79, -0.62, 0.62, 3.79]) {
    batch.box(timber, x + offset * size, eave / 2, facade + 0.064, 0.11 * size, eave - 0.11, 0.15);
  }
  batch.box(0x584a3a, x, 0.90 * size, facade + 0.099, 1.14 * size, 1.81 * size, 0.13);
  batch.box(0x9d8b6d, x, 0.13 * size, facade + 0.25, 1.32 * size, 0.16 * size, 0.36);
  for (const offset of [-2.36, 2.36]) {
    batch.box(0x80715a, x + offset * size, 1.62 * size, z + half + 0.032, 1.47 * size, 0.98 * size, 0.09);
    batch.box(0x354f56, x + offset * size, 1.62 * size, z + half + 0.082, 1.22 * size, 0.72 * size, 0.05);
    batch.box(0xa29677, x + offset * size, 1.62 * size, z + half + 0.112, 0.08 * size, 0.72 * size, 0.03);
  }
  batch.box(0x746352, x + edge, 1.61 * size, z + size * 0.53, 0.12, 0.82 * size, 1.12 * size);
  batch.box(0x405761, x + edge + 0.064, 1.62 * size, z + size * 0.53, 0.026, 0.56 * size, 0.85 * size);
}

function tree(batch: Batch, x: number, z: number, height: number, color: number): void {
  batch.add(new THREE.CylinderGeometry(height * 0.029, height * 0.051, height * 0.64, 6).translate(x, height * 0.32, z), 0x675841);
  batch.add(new THREE.IcosahedronGeometry(1, 1).scale(height * 0.32, height * 0.39, height * 0.29)
    .rotateY(x * 0.13).translate(x, height * 0.71, z), color);
  batch.add(new THREE.IcosahedronGeometry(1, 0).scale(height * 0.23, height * 0.23, height * 0.2)
    .translate(x + height * 0.21, height * 0.64, z + height * 0.09), color);
}

function ridges(batch: Batch, depth: number, height: number, phase: number, color: number): void {
  const points: [number, number, number][] = [];
  const triangles: number[] = [];
  const columns = 99;
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < columns; i++) {
      const x = (i - (columns - 1) / 2) * 26;
      const peak = height * (0.43 + 0.28 * Math.sin(i * 0.27 + phase) + 0.11 * Math.sin(i * 0.78 + phase)
        + 0.15 * Math.sin(i * 0.53 - phase) + 0.03 * Math.cos(i * 1.91));
      const y = row === 0 || row === 3 ? -1.6 : peak * (row === 1 ? 0.48 : 1);
      const z = -depth - row * 47 + Math.sin(i * 0.41) * 14;
      points.push([x, y, z]);
      if (row && i) {
        const last = row * columns + i;
        triangles.push(last - columns - 1, last - columns, last - 1, last - columns, last, last - 1);
      }
    }
  }
  batch.surface(points, triangles, color);
}

const SAKURA = [0xf5c4d3, 0xf9d9df, 0xeaaabb, 0xf2bdcf];
const gorgeCentre = (z: number): number => -399 + 13 * Math.sin(-z / 45) + 19 * Math.sin(-z / 119);
const gorgeWidth = (z: number): number => 13.8 + 3.5 * Math.cos(-z / 84);

function riverGorge(land: Batch, water: Batch, details: Batch): void {
  riverStrip(land, 7, -0.065, 0x7f9769, gorgeCentre, gorgeWidth);
  riverStrip(water, 0, 0.09, 0x71a8b8, gorgeCentre, gorgeWidth);
  const rng = createRng("fuji-gorge");
  for (const side of [-1, 1]) {
    for (let z = -8; z >= -201; z -= 5) {
      const x = gorgeCentre(z) + side * (gorgeWidth(z) + rng.range(0.1, 3.8));
      const size = rng.range(1.0, 2.7);
      details.add(new THREE.IcosahedronGeometry(1, 0).scale(size * 1.56, size * 0.65, size)
        .rotateY(rng.range(0, Math.PI)).translate(x, size * 0.12, z), rng.pick([0x8f9284, 0x9e9e8f, 0x7a857b]));
    }
  }
  for (let i = 0; i < 45; i++) {
    const x = rng.range(-537, -449);
    const z = rng.range(-112, -13);
    tree(details, x, z, rng.range(4.1, 12.7), rng.pick(TREES));
  }
  const bridgeX = gorgeCentre(-2.7);
  details.box(0x9aa693, bridgeX, 0.53, -2.65, 37.6, 0.31, 0.25);
  for (let x = bridgeX - 18; x < bridgeX + 18; x += 4.5) {
    details.box(0xb8bead, x, 0.32, -2.65, 0.11, 0.64, 0.11);
  }
}

function cherryLane(land: Batch, details: Batch): void {
  const rng = createRng("fuji-cherry-lane");
  land.plane(0xa2b179, 299, 524, -50, -7.3, -0.075);
  land.plane(0xb7a992, 305, 518, -16, -13.1, -0.034);
  for (let x = 309; x < 520; x += rng.range(8.8, 15.6)) {
    for (const row of [0, 1]) {
      // The gaps give the mountain a chance to come back into view.
      if (row === 0 && x > 380 && x < 432) continue;
      const z = -9 - row * 17 + rng.range(-2.3, 2.1);
      const height = rng.range(4.5, 6.9);
      details.add(new THREE.CylinderGeometry(0.11, 0.28, height * 0.76, 6)
        .rotateZ(rng.range(-0.14, 0.14)).translate(x, height * 0.37, z), 0x765848);
      for (let bough = 0; bough < 6; bough++) {
        const dx = rng.range(-1.66, 1.62), dz = rng.range(-1.26, 1.21);
        const y = height * rng.range(0.70, 1);
        const radius = rng.range(0.96, 1.53) * height / 5;
        details.add(new THREE.IcosahedronGeometry(1, 1).scale(radius * 1.32, radius * 0.76, radius)
          .rotateY(rng.range(0, Math.PI)).translate(x + dx, y, z + dz), rng.pick(SAKURA));
      }
    }
  }
}

function cherryPetals(scene: THREE.Scene): (seconds: number, cameraX: number) => void {
  const rng = createRng("fuji-cherry-petals");
  const count = 100;
  const geometry = new THREE.CircleGeometry(0.115, 5).scale(1.02, 0.68, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xfac9d7, side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(geometry, material, count);
  petals.frustumCulled = false;
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(petals);
  const points = Array.from({ length: count }, () => ({
    x: rng.range(302, 523), z: rng.range(-13.7, -3.0), phase: rng.next(), scale: rng.range(0.42, 1),
  }));
  const transform = new THREE.Object3D();
  return (seconds, cameraX) => {
    petals.visible = cameraX >= 276 && cameraX <= 550;
    if (!petals.visible) return;
    points.forEach(({ x, z, phase, scale }, i) => {
      const cycle = phase + seconds * (0.2 + 0.04 * scale);
      const fall = cycle - Math.floor(cycle);
      transform.position.set(x + fall * 6 + Math.sin(cycle * 17), 5.1 * (1 - fall), z + Math.cos(cycle * 13) * 1.4);
      transform.rotation.set(cycle * 8, cycle * 6, cycle * 9);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      petals.setMatrixAt(i, transform.matrix);
    });
    petals.instanceMatrix.needsUpdate = true;
  };
}

/** A fixed countryside composition in metres. The authored travel axis runs along X. */
export function buildFujiCountryside(scene: THREE.Scene) {
  const land = geometryBatch();
  const water = geometryBatch();
  const details = geometryBatch();
  const rng = createRng("fuji-scenery-village");
  const houses: GroundPoint[] = [
    [-612, -15], [-587, -22], [-570, -30], [-552, -38], [-528, -29],
    [534, -16], [555, -28], [574, -18], [594, -24], [613, -15],
    [-246, -13], [-224, -19], [-206, -28], [-184, -34], [-174, -47],
    [174, -29], [197, -22], [218, -15], [242, -20],
    [-133, -103], [-103, -106], [-94, -110], [-76, -123], [-54, -128], [-39, -132],
    [76, -125], [91, -116], [105, -127], [125, -112], [137, -119],
    [-293, -146], [-263, -153], [259, -150], [277, -153], [309, -154],
  ];

  land.plane(LAND, -1240, 1240, -980, 65, -0.25);
  land.plane(0xa3a98a, -700, 700, -3.55, 2.9, -0.015);
  land.plane(0xb1aa91, -700, 700, -3.45, -2.25, 0.008);
  land.plane(0xb4ad96, -560, 570, -54.2, -51.3, -0.022);

  riverStrip(land, 2.15, -0.084, 0x809b71);
  riverStrip(water, 0, 0.07, WATER);
  riverGorge(land, water, details);
  cherryLane(land, details);
  for (const z of [-53, -121]) {
    const center = riverCentre(z), width = 2 * riverWidth(z) + 4.4;
    details.box(0xa6a093, center, 0.33, z, width, 0.36, 3.0);
    for (const side of [-1, 1]) {
      details.box(0xd7d8cc, center, 1.0, z + side * 1.45, width, 0.10, 0.1);
      for (let x = center - width / 2; x < center + width / 2; x += 2.45) {
        details.box(0xd1d5c9, x, 0.73, z + side * 1.45, 0.08, 0.59, 0.1);
      }
    }
  }

  // A small roadside gate gives the central field a human scale before the mountain.
  const gateX = -25, gateZ = -70.5;
  land.plane(0xbeb397, gateX - 2.7, gateX + 2.7, gateZ - 1.6, -54.0, 0.066);
  for (const side of [-1, 1]) details.box(0xb75640, gateX + side * 1.18, 1.48, gateZ, 0.21, 2.96, 0.23);
  details.box(0xc76549, gateX, 2.34, gateZ, 3.08, 0.18, 0.23);
  details.box(0xc76549, gateX, 2.94, gateZ, 3.42, 0.2, 0.33);
  details.box(0x594c43, gateX, 3.105, gateZ, 3.65, 0.12, 0.44);

  const rice = paddies(land, water, houses);
  for (const [x, z] of houses) {
    for (let i = 0; i < 30; i++) {
      const dx = rng.range(-12, 12);
      const dz = rng.range(2.6, 9.8);
      if (Math.abs(dx) > 4.8) rice.push([x + dx, z + dz]);
    }
  }
  for (let x = -292; x < 292; x += 0.9) {
    if (Math.abs(x - riverCentre(-4.7)) < riverWidth(-4.7) + 2) continue;
    if (Math.sin(x * 0.49) + Math.cos(x * 0.21) > -0.16) rice.push([x, rng.range(-5.4, -3.8)]);
  }
  houses.forEach(([x, z]) => {
    const size = rng.range(0.65, 1.1);
    farmHouse(details, x, z, size, rng.pick(ROOFS), rng.pick(WALLS));
    tree(details, x + rng.range(-4, 5), z - rng.range(4, 7), rng.range(4.2, 7.2), rng.pick(TREES));
    if (rng.chance(0.55)) tree(details, x + 5.5, z + 3.35, rng.range(2.5, 4.4), 0xacc08a);
  });
  for (let i = 0; i < 95; i++) {
    const x = rng.range(-590, 590);
    const z = rng.pick([-52, -96, -120, -150, -234, -279, -334]) + rng.range(-1.0, 1);
    const beyondRiver = Math.abs(x - riverCentre(z)) > riverWidth(z) + 3.5;
    const beyondGorge = Math.abs(x - gorgeCentre(z)) > gorgeWidth(z) + 4.0;
    if (beyondRiver && beyondGorge) tree(details, x, z, rng.range(2.0, 5.9), rng.pick(TREES));
  }

  for (let x = -280; x <= 280; x += 5) {
    if (Math.abs(x - riverCentre(-3)) > riverWidth(-3) + 1.5) {
      details.box(0xc4bf9e, x, 0.34, -3.35, 0.09, 0.74, 0.1);
      details.box(0xafac8e, x + 2.5, 0.52, -3.35, 4.92, 0.04, 0.045);
    }
  }
  for (const x of [-250, -202, -149, 151, 201, 247]) {
    details.box(0x666764, x, 2.45, -5.5, 0.16, 4.9, 0.15);
    details.box(0x585d5e, x, 4.71, -5.48, 0.10, 0.12, 1.55);
  }

  ridges(land, 415, 32, 5.2, 0x7e997a);
  // Let Fuji's lower flanks read above the near ridges through the train window.
  ridges(land, 590, 42, 0.9, 0x78938c);
  ridges(land, 780, 49, 2.5, 0x7896a2);
  ridges(land, 910, 58, 7.1, 0x839cae);

  const time = { value: 0 };
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  scene.add(land.mesh(flat), details.mesh(flat), water.mesh(createWaterMaterial(time)));
  plantedRice(scene, rice);
  const updatePetals = cherryPetals(scene);
  return (seconds: number, cameraX: number): void => {
    time.value = seconds;
    updatePetals(seconds, cameraX);
  };
}
