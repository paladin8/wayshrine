import * as THREE from "three";
import { ginzanStream, ginzanWarmth, type Point, type Terrain } from "../world";
import { deadOf } from "./vitality-mesh";
import { Kind, ParticleLayer } from "./particles";

const STEAM = new THREE.Color(0xdceae9);
const MOTES = 19;

export function createGinzanScenery(
  scene: THREE.Scene,
  terrain: Terrain,
  progressOf: (id: string) => number,
  localLife: (x: number, z: number) => number,
) {
  const plan = ginzanStream(terrain.world);
  if (!plan) return (_clock: number, _pixelScale: number, _focus: Point): void => {};
  const source = terrain.world.regionById(plan.sourceId);
  const outlet = { x: source.site.x, z: source.site.z + 14, regionId: source.id, radius: 1.2, bath: false };
  const baths = plan.springs.map((spring) => ({ ...spring, bath: true }));
  const vents = terrain.tileAtPoint(outlet.x, outlet.z).ginzanSurface === "stream" ? [outlet, ...baths] : baths;
  const height = vents.map(({ x, z }) => terrain.groundAt(x, z));
  const layer = new ParticleLayer(vents.length * MOTES, false);
  // Draw steam after the transparent water while still depth-testing against the terrain.
  layer.points.renderOrder = 1;
  const structures = new THREE.Group();
  const timber = new THREE.Color(0x927356), timberDead = deadOf(timber);
  const railings = plan.bridges.map((bridge) => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: timberDead, flatShading: true });
    group.position.set(bridge.x, terrain.groundAt(bridge.x, bridge.z), bridge.z);
    group.rotation.y = bridge.yaw;
    for (const z of [-0.78, 0.78]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.12, 0.13), material);
      bar.position.set(0, 0.5, z);
      group.add(bar);
      for (const x of [-2.62, 0, 2.62]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), material);
        post.position.set(x, 0.26, z);
        group.add(post);
      }
    }
    structures.add(group);
    return { bridge, material };
  });
  const lamps = plan.springs.map((spring) => {
    const x = spring.x + spring.radius + 0.25, z = spring.z;
    const y = terrain.groundAt(x, z);
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.65, 5), new THREE.MeshStandardMaterial({ color: 0x6e675a }));
    frame.position.set(x, y + 0.32, z);
    const glass = new THREE.MeshStandardMaterial({ color: 0xa4a097, emissive: 0xffb862, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), glass);
    lamp.position.set(x, y + 0.71, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.21, 4).rotateY(Math.PI / 4), frame.material);
    cap.position.set(x, y + 0.91, z);
    structures.add(frame, lamp, cap);
    return { spring, glass };
  });
  scene.add(layer.points, structures);

  return (clock: number, pixelScale: number, focus: Point): void => {
    structures.visible = Math.hypot(focus.x - source.site.x, focus.z - source.site.z) < 190;
    if (structures.visible) {
      for (const { bridge, material } of railings) material.color.copy(timberDead).lerp(timber, localLife(bridge.x, bridge.z));
      for (const { spring, glass } of lamps) glass.emissiveIntensity = ginzanWarmth(plan, spring.regionId, progressOf) * 1.6;
    }
    layer.points.visible = vents.some(({ x, z }) => Math.hypot(focus.x - x, focus.z - z) < 55);
    if (!layer.points.visible) return;
    for (const [ventIndex, vent] of vents.entries()) {
      const heat = ginzanWarmth(plan, vent.regionId, progressOf);
      for (let i = 0; i < MOTES; i++) {
        const p = layer.particles[ventIndex * MOTES + i]!;
        p.active = heat > 0.05;
        if (!p.active) continue;
        const rise = (clock * (0.26 + (i % 4) * 0.015) + i / MOTES) % 1;
        p.kind = Kind.Mist;
        p.age = rise;
        const angle = i * 2.39996;
        const spread = vent.radius * (0.12 + (i % 5) * 0.1);
        p.x = vent.x + Math.cos(angle) * spread + Math.sin(clock * 0.7 + angle) * rise * 0.39;
        p.z = vent.z + Math.sin(angle) * spread - rise * 0.8;
        p.y = height[ventIndex]! + 0.16 + rise * (vent.bath ? 3.0 : 2.35);
        p.size = vent.bath ? 42 + rise * 62 : 22 + rise * 37;
        [p.r, p.g, p.b] = [STEAM.r, STEAM.g, STEAM.b];
        p.alpha = (vent.bath ? 0.55 : 0.43) * Math.sin(Math.PI * rise) * heat;
      }
    }
    layer.flush(pixelScale);
  };
}
