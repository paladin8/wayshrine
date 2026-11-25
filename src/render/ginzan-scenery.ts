import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRng } from "../core";
import { ginzanStream, ginzanWarmth, type Point, type Terrain } from "../world";
import { deadOf } from "./vitality-mesh";
import { Kind, ParticleLayer } from "./particles";

type Ginzan = NonNullable<ReturnType<typeof ginzanStream>>;
type Spring = Ginzan["springs"][number];
type Bridge = Ginzan["bridges"][number];

const STEAM = new THREE.Color(0xe2efed);
const MOTES = 23;
const STONE = [0x6d797c, 0x818581, 0x92968e] as const;
const SNOW = 0xe0e8e6;
const PLANKS = [0x956c4d, 0xa17c58, 0xb18a63] as const;
const POSTS = 0x614438;
const RAILS = 0x925a44;
const LANTERN = 0x473f38;

function detailBatch() {
  const materials = new Map<number, THREE.BufferGeometry[]>();
  const add = (geometry: THREE.BufferGeometry, color: number): void => {
    const parts = materials.get(color) ?? [];
    if (geometry.index) {
      parts.push(geometry.toNonIndexed());
      geometry.dispose();
    } else {
      parts.push(geometry);
    }
    materials.set(color, parts);
  };
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, yaw = 0): void => {
    add(new THREE.BoxGeometry(w, h, d).rotateY(yaw).translate(x, y, z), color);
  };
  const build = () => {
    const group = new THREE.Group();
    const tints = [...materials].map(([color, parts]) => {
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      const living = new THREE.Color(color);
      const dormant = deadOf(living);
      const material = new THREE.MeshStandardMaterial({ color: dormant, roughness: 1, flatShading: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return { material, dormant, living };
    });
    return { group, tint(life: number) {
      for (const { material, dormant, living } of tints) material.color.copy(dormant).lerp(living, life);
    } };
  };
  return { add, box, build };
}

function timberBridge(terrain: Terrain, bridge: Bridge) {
  const detail = detailBatch();
  const c = Math.cos(bridge.yaw), s = Math.sin(bridge.yaw);
  const h = (x: number): number => terrain.groundAt(bridge.x + x * c, bridge.z - x * s) + 0.04;
  const beam = (from: THREE.Vector3, to: THREE.Vector3, width: number, depth: number, color: number): void => {
    const direction = to.clone().sub(from);
    const center = from.clone().addScaledVector(direction, 0.5);
    const rotation = new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction.clone().normalize());
    const geometry = new THREE.BoxGeometry(width, direction.length() + 0.035, depth)
      .applyQuaternion(rotation).translate(center.x, center.y, center.z);
    detail.add(geometry, color);
  };
  const plankWidth = 0.28;
  for (let i = -10; i <= 10; i++) {
    const x = i * plankWidth;
    const left = h(x - plankWidth * 0.5), right = h(x + plankWidth * 0.5);
    const pitch = Math.atan2(right - left, plankWidth);
    const board = new THREE.BoxGeometry(Math.hypot(plankWidth, right - left) - 0.014, 0.11, 1.87)
      .rotateZ(pitch).translate(x, (right + left) * 0.5, 0);
    detail.add(board, PLANKS[(i + 12) % PLANKS.length]!);
  }
  const supports = [-2.66, -1.42, 0, 1.42, 2.66];
  for (const z of [-0.84, 0.84]) {
    for (const x of supports) {
      const floor = h(x);
      detail.box(0.15, 0.80, 0.15, POSTS, x, floor + 0.31, z);
      detail.box(0.19, 0.075, 0.19, RAILS, x, floor + 0.74, z);
    }
    for (let i = 1; i < supports.length; i++) {
      const x = supports[i - 1]!, next = supports[i]!;
      for (const height of [0.35, 0.67]) {
        beam(new THREE.Vector3(x, h(x) + height, z), new THREE.Vector3(next, h(next) + height, z),
          height < 0.5 ? 0.085 : 0.13, 0.10, RAILS);
      }
      beam(new THREE.Vector3(x, h(x) - 0.13, z), new THREE.Vector3(next, h(next) - 0.13, z), 0.19, 0.15, POSTS);
    }
  }
  const structure = detail.build();
  structure.group.position.set(bridge.x, 0, bridge.z);
  structure.group.rotation.y = bridge.yaw;
  return structure;
}

function rock(detail: ReturnType<typeof detailBatch>, x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, color: number, snow: boolean) {
  detail.add(new THREE.IcosahedronGeometry(1, 0).scale(w, h, d).rotateY(yaw).translate(x, y + h * 0.14, z), color);
  if (snow) {
    detail.add(new THREE.IcosahedronGeometry(1, 0).scale(w * 0.77, h * 0.28, d * 0.82).rotateY(yaw)
      .translate(x, y + h * 0.87, z), SNOW);
  }
}

function stoneBath(terrain: Terrain, plan: Ginzan, spring: Spring) {
  const rng = createRng(terrain.world.seed).fork(`ginzan-bath:${spring.regionId}`);
  const detail = detailBatch();
  const previous = plan.path[spring.distance / 2 - 1]!;
  const next = plan.path[spring.distance / 2 + 1]!;
  const downstream = Math.atan2(next.z - previous.z, next.x - previous.x);
  const access = spring.entranceAngle;
  const ground = (x: number, z: number) => terrain.groundAt(spring.x + x, spring.z + z);
  for (let i = 0; i < 26; i++) {
    const angle = i * Math.PI / 13 + rng.range(-0.045, 0.045);
    // Leave the stream mouth and the approach to the bathing steps open.
    if (Math.abs(Math.sin(angle - downstream)) < 0.30 || Math.cos(angle - access) > 0.946) continue;
    const radius = spring.radius + rng.range(-0.24, 0.07);
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    rock(detail, x, ground(x, z), z, rng.range(0.45, 0.68), rng.range(0.20, 0.43), rng.range(0.35, 0.51),
      -angle + rng.range(0.2, 0.65), rng.pick(STONE), rng.chance(0.72));
  }
  const at = (distance: number, aside = 0): Point => ({
    x: Math.cos(access) * distance - Math.sin(access) * aside,
    z: Math.sin(access) * distance + Math.cos(access) * aside,
  });
  for (const [i, inset] of [-0.52, -0.09, 0.37].entries()) {
    const { x, z } = at(spring.radius + inset);
    detail.box(0.47, 0.10, 1.45 + i * 0.08, STONE[i]!, x, ground(x, z) + 0.025, z, -access);
  }
  for (const [i, inset] of [1.24, 2.09, 2.96].entries()) {
    const { x, z } = at(spring.radius + inset, i % 2 ? 0.20 : -0.18);
    if (terrain.world.regionAt(spring.x + x, spring.z + z).id !== spring.regionId) break;
    detail.add(new THREE.CylinderGeometry(0.45, 0.53, 0.13, 6).scale(0.77, 1, 1.15)
      .rotateY(-access + i * 0.3).translate(x, ground(x, z) + 0.03, z), STONE[i]!);
  }
  const glass = new THREE.MeshStandardMaterial({ color: 0xa7a29a, emissive: 0xffad48, emissiveIntensity: 0, roughness: 0.8 });
  const lights = [-1.14, 1.14].map((aside) => {
    const { x, z } = at(spring.radius + 0.52, aside);
    const y = ground(x, z);
    detail.box(0.49, 0.14, 0.49, STONE[1], x, y + 0.02, z, -access);
    detail.box(0.16, 0.46, 0.16, LANTERN, x, y + 0.28, z, -access);
    detail.box(0.36, 0.11, 0.36, POSTS, x, y + 0.51, z, -access);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.24, 0.25), glass);
    lamp.position.set(x, y + 0.66, z);
    lamp.rotation.y = -access;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const dx = Math.cos(access) * a * 0.13 - Math.sin(access) * b * 0.13;
      const dz = Math.sin(access) * a * 0.13 + Math.cos(access) * b * 0.13;
      detail.box(0.036, 0.28, 0.036, POSTS, x + dx, y + 0.66, z + dz, -access);
    }
    detail.add(new THREE.ConeGeometry(0.33, 0.20, 4).rotateY(Math.PI / 4 - access)
      .translate(x, y + 0.87, z), LANTERN);
    return lamp;
  });
  const structure = detail.build();
  structure.group.position.set(spring.x, 0, spring.z);
  structure.group.add(...lights);
  return { ...structure, glass };
}

function stoneOutlet(terrain: Terrain, source: Point) {
  const detail = detailBatch();
  const y = terrain.groundAt(source.x, source.z);
  const opening = new THREE.Shape().moveTo(-1.0, -0.10).lineTo(1.0, -0.10).lineTo(1.0, 0.11)
    .quadraticCurveTo(0.75, 0.67, 0, 0.67).quadraticCurveTo(-0.75, 0.67, -1.0, 0.11).closePath();
  detail.add(new THREE.ShapeGeometry(opening).translate(0, y, 0.27), 0x282e34);
  for (let i = 0; i < 7; i++) {
    const angle = (i + 0.5) * Math.PI / 7;
    const x = Math.cos(angle) * 1.15;
    const top = y + Math.sin(angle) * 0.70 + 0.11;
    const lean = Math.atan2(0.70 * Math.cos(angle), -1.15 * Math.sin(angle));
    detail.add(new THREE.BoxGeometry(0.49, 0.24, 0.63).rotateZ(lean).translate(x, top, 0), STONE[i % STONE.length]!);
  }
  for (const x of [-1.63, 1.63]) {
    detail.box(0.82, 0.44, 0.75, STONE[0], x, y + 0.16, 0.14);
    detail.box(0.87, 0.09, 0.77, SNOW, x, y + 0.41, 0.14);
  }
  const structure = detail.build();
  structure.group.position.set(source.x, 0, source.z);
  return structure;
}

export function createGinzanScenery(
  scene: THREE.Scene,
  terrain: Terrain,
  progressOf: (id: string) => number,
  localLife: (x: number, z: number) => number,
) {
  const plan = ginzanStream(terrain.world);
  if (!plan) return (_clock: number, _pixelScale: number, _focus: Point): void => {};
  const source = terrain.world.regionById(plan.sourceId);
  const openChannel = plan.path.find(({ x, z }) => terrain.tileAtPoint(x, z).ginzanSurface === "stream");
  const baths = plan.springs.map((spring) => ({ ...spring, bath: true }));
  const vents = openChannel ? [{ ...openChannel, radius: 1, bath: false }, ...baths] : baths;
  const outlet = plan.path.length > 1 ? stoneOutlet(terrain, plan.path[0]!) : null;
  const height = vents.map(({ x, z }) => terrain.groundAt(x, z));
  const layer = new ParticleLayer(vents.length * MOTES, false);
  // Draw steam after the transparent water while still depth-testing against the terrain.
  layer.points.renderOrder = 1;
  const bridges = plan.bridges.map((point) => ({ point, ...timberBridge(terrain, point) }));
  const springs = plan.springs.map((point) => ({ point, ...stoneBath(terrain, plan, point) }));
  const structures = new THREE.Group();
  structures.add(...bridges.map(({ group }) => group), ...springs.map(({ group }) => group));
  if (outlet) structures.add(outlet.group);
  scene.add(layer.points, structures);

  return (clock: number, pixelScale: number, focus: Point): void => {
    structures.visible = Math.hypot(focus.x - source.site.x, focus.z - source.site.z) < 190;
    if (structures.visible) {
      if (outlet) outlet.tint(localLife(outlet.group.position.x, outlet.group.position.z));
      for (const { point, tint } of bridges) tint(localLife(point.x, point.z));
      for (const { point, tint, glass } of springs) {
        const heat = ginzanWarmth(plan, point.regionId, progressOf);
        tint(localLife(point.x, point.z));
        glass.emissiveIntensity = heat * 1.25;
      }
    }
    layer.points.visible = vents.some(({ x, z }) => Math.hypot(focus.x - x, focus.z - z) < 55);
    if (!layer.points.visible) return;
    for (const [ventIndex, vent] of vents.entries()) {
      const heat = ginzanWarmth(plan, vent.regionId, progressOf);
      for (let i = 0; i < MOTES; i++) {
        const p = layer.particles[ventIndex * MOTES + i]!;
        p.active = heat > 0.05;
        if (!p.active) continue;
        const rise = (clock * (0.19 + (i % 4) * 0.019) + i / MOTES) % 1;
        p.kind = Kind.Mist;
        p.age = rise;
        const angle = i * 2.39996;
        const spread = vent.radius * (0.18 + (i % 5) * 0.12);
        p.x = vent.x + Math.cos(angle) * spread + (0.55 + Math.sin(clock * 0.7 + angle) * 0.34) * rise;
        p.z = vent.z + Math.sin(angle) * spread - rise * 0.93;
        p.y = height[ventIndex]! + 0.12 + rise * (vent.bath ? 1.95 : 1.45);
        p.size = vent.bath ? 34 + rise * 73 : 22 + rise * 47;
        [p.r, p.g, p.b] = [STEAM.r, STEAM.g, STEAM.b];
        p.alpha = (vent.bath ? 0.47 : 0.38) * Math.sin(Math.PI * rise) * heat;
      }
    }
    layer.flush(pixelScale);
  };
}
