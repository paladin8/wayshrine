import * as THREE from "three";
import { lifeAt } from "../game";
import type { Obstacle } from "../world";
import { palette } from "./palette";

const DEAD_RED = new THREE.Color(0x77716e);
const DEAD_ROOF = new THREE.Color(0x4a4644);

export interface ShrineMesh {
  readonly group: THREE.Group;
  /** Restoration progress: 0 is dead and grey with the orb dark; 1 is restored and glowing. */
  setVitality(progress: number): void;
  /** Append colliders attached to the current model pose. */
  appendObstaclesNear?(x: number, z: number, reach: number, out: Obstacle[]): void;
  /** Animates the shrine or landmark. */
  tick(seconds: number): void;
}

/** A small torii-style shrine with a floating orb of energy. */
export function buildShrine(): ShrineMesh {
  const group = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: palette.red, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: palette.roof, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: palette.rock, flatShading: true });
  const orbMat = new THREE.MeshStandardMaterial({
    color: palette.cream,
    emissive: palette.glow,
    emissiveIntensity: 0,
    flatShading: true,
  });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  add(new THREE.CylinderGeometry(1.5, 1.7, 0.2, 8), stoneMat, 0, 0.1, 0);
  for (const x of [-0.9, 0.9]) add(new THREE.CylinderGeometry(0.14, 0.17, 2.4, 6), redMat, x, 1.4, 0);
  add(new THREE.BoxGeometry(2.4, 0.16, 0.2), redMat, 0, 2.1, 0);
  add(new THREE.BoxGeometry(3.0, 0.22, 0.4), roofMat, 0, 2.7, 0);
  const orb = add(new THREE.IcosahedronGeometry(0.32, 0), orbMat, 0, 1.4, 0);

  let vitality = 0;
  const alive = new THREE.Color(palette.red);
  const aliveRoof = new THREE.Color(palette.roof);

  const setVitality = (progress: number): void => {
    // The shrine sits at the centre of the field, so it wakes first.
    const v = lifeAt(progress, 0);
    vitality = v;
    redMat.color.copy(DEAD_RED).lerp(alive, v);
    roofMat.color.copy(DEAD_ROOF).lerp(aliveRoof, v);
    // While the energy is being released the orb flares, then settles.
    const flare = progress > 0 && progress < 0.35 ? Math.sin((progress / 0.35) * Math.PI) : 0;
    orbMat.emissiveIntensity = 1.2 * v + 3.2 * flare;
    orb.scale.setScalar(0.4 + 0.6 * v + 0.9 * flare);
  };
  setVitality(0);

  return {
    group,
    setVitality,
    tick: (seconds) => {
      orb.position.y = 1.4 + Math.sin(seconds * 2) * 0.08 * vitality;
      orb.rotation.y = seconds * 0.8;
    },
  };
}
