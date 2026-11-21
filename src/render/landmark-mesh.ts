import * as THREE from "three";
import { lifeAt } from "../game";
import type { ShrineMesh } from "./shrine-mesh";
import { palette } from "./palette";

const DEAD_STONE = new THREE.Color(0x77736f);
const DEAD_RED = new THREE.Color(0x77716e);

/**
 * Stand-in for a hand-crafted landmark model: a stepped plinth, a spire and a
 * floating gem. Every landmark uses it until its real model is made, and it
 * is deliberately plain so it is never mistaken for one. It is the region's
 * shrine, so there is no torii; it is solid within LANDMARK_SOLID_RADIUS.
 */
export function buildLandmarkPlaceholder(): ShrineMesh {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: palette.rock, flatShading: true });
  const red = new THREE.MeshStandardMaterial({ color: palette.red, flatShading: true });
  const gem = new THREE.MeshStandardMaterial({
    color: palette.cream,
    emissive: palette.glow,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(3.0, 3.2, 0.5, 8), stone, 0.25);
  add(new THREE.CylinderGeometry(2.3, 2.5, 0.5, 8), stone, 0.75);
  add(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 8), stone, 1.25);
  add(new THREE.BoxGeometry(1.1, 5.2, 1.1), stone, 4.1);
  add(new THREE.ConeGeometry(0.95, 1.2, 4), stone, 7.3).rotation.y = Math.PI / 4;
  add(new THREE.BoxGeometry(1.3, 0.4, 1.3), red, 3.2);
  add(new THREE.BoxGeometry(1.3, 0.4, 1.3), red, 5.2);
  const orb = add(new THREE.IcosahedronGeometry(0.55, 0), gem, 8.7);

  const aliveStone = new THREE.Color(palette.rock);
  const aliveRed = new THREE.Color(palette.red);
  let life = 0;
  return {
    group,
    setVitality(progress) {
      const v = lifeAt(progress, 0);
      const flare = progress > 0 && progress < 0.35 ? Math.sin((progress / 0.35) * Math.PI) : 0;
      life = v;
      stone.color.copy(DEAD_STONE).lerp(aliveStone, v);
      red.color.copy(DEAD_RED).lerp(aliveRed, v);
      gem.emissiveIntensity = 1.4 * v + 3.5 * flare;
      orb.scale.setScalar(0.4 + 0.6 * v + 0.8 * flare);
    },
    tick(seconds) {
      orb.position.y = 8.7 + Math.sin(seconds * 1.6) * 0.15 * life;
      orb.rotation.y = seconds * 0.6;
    },
  };
}
