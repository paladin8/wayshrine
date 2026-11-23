import * as THREE from "three";
import type { Rng } from "../core";
import { deadOf } from "./vitality-mesh";

export const TAU = 2 * Math.PI;
const FACET = new THREE.IcosahedronGeometry(1);
export const TIMBER = 0x64473b;

export function scenery() {
  const root = new THREE.Group();
  const materials = new Map<number, { material: THREE.MeshStandardMaterial; live: THREE.Color; dead: THREE.Color }>();
  let lastLife = -1;

  function mesh(geometry: THREE.BufferGeometry, hex: number, x: number, y: number, z: number) {
    let colors = materials.get(hex);
    if (!colors) {
      const live = new THREE.Color(hex);
      colors = { material: new THREE.MeshStandardMaterial({ flatShading: true }), live, dead: deadOf(live) };
      materials.set(hex, colors);
    }
    const piece = new THREE.Mesh(geometry, colors.material);
    piece.position.set(x, y, z);
    root.add(piece);
    return piece;
  }

  return {
    root,
    mesh,
    box(w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
      return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
    },
    cylinder(top: number, base: number, height: number, sides: number, color: number, x: number, y: number, z: number) {
      return mesh(new THREE.CylinderGeometry(top, base, height, sides), color, x, y, z);
    },
    facet(color: number, x: number, y: number, z: number, w: number, h: number, d: number) {
      const piece = mesh(FACET, color, x, y, z);
      piece.scale.set(w, h, d);
      return piece;
    },
    tint(life: number) {
      if (life === lastLife) return;
      lastLife = life;
      for (const { material, live, dead } of materials.values()) material.color.copy(dead).lerp(live, life);
    },
  };
}

export type Scenery = ReturnType<typeof scenery>;
type SceneFrame = (life: number, age: number, bellAge: number) => void;
export type BuildScene = (art: Scenery, rng: Rng, ground: (x: number, z: number) => number) => SceneFrame;

export function branch(art: Scenery, from: THREE.Vector3, to: THREE.Vector3, radius: number, color: number, castShadow = true) {
  const direction = to.clone().sub(from);
  const mid = from.clone().lerp(to, 0.5);
  const beam = art.cylinder(radius * 0.65, radius, direction.length(), 6, color, mid.x, mid.y, mid.z);
  beam.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction.normalize());
  beam.castShadow = castShadow;
  return beam;
}

const bladeGeometry = new THREE.BufferGeometry();
bladeGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
  0, 0, 0, -0.25, 0.40, 0, 0.35, 0.71, 0.09,
  -0.25, 0.40, 0, 0.71, 1, -0.05, 0.35, 0.71, 0.09,
  0, 0, 0, 0.35, 0.71, 0.09, 0.50, 0.44, 0,
  0.50, 0.44, 0, 0.35, 0.71, 0.09, 0.71, 1, -0.05,
], 3));
bladeGeometry.computeVertexNormals();

export function blade(art: Scenery, color: number, x: number, y: number, z: number, width: number, height: number) {
  const front = art.mesh(bladeGeometry, color, x, y, z);
  front.material.side = THREE.DoubleSide;
  front.scale.set(width, height, width);
  return front;
}
