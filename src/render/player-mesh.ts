import * as THREE from "three";
import { buildBoat, buildScullingOar, buildWake } from "./boat-mesh";
import { palette } from "./palette";

export interface PlayerMesh {
  readonly group: THREE.Group;
  readonly hull: THREE.Group;
  setPose(seated: number, lift: number): void;
  setBoat(visible: boolean, wake: number, seconds: number): void;
}

/** A small low-poly traveller, with a boat that appears on water. */
export function buildPlayer(): PlayerMesh {
  const group = new THREE.Group();
  const rider = new THREE.Group();
  group.add(rider);
  const mat = (color: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, flatShading: true });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    mesh.castShadow = true;
    rider.add(mesh);
    return mesh;
  };

  add(new THREE.ConeGeometry(0.28, 0.75, 6), mat(palette.red), 0.4);
  add(new THREE.IcosahedronGeometry(0.2, 0), mat(palette.cream), 0.95);
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 6), mat(palette.roof), 1.12); // hat brim

  const hull = new THREE.Group();
  const boat = buildBoat();
  const oar = buildScullingOar();
  const wake = buildWake();
  boat.add(oar);
  hull.add(boat, wake.group);
  hull.visible = false;

  return {
    group,
    hull,
    setPose(seated, lift) {
      rider.scale.y = 1 - 0.25 * seated;
      rider.position.y = lift + 0.13 * seated;
      rider.rotation.x = -0.16 * seated;
    },
    setBoat(visible, strength, seconds) {
      hull.visible = visible;
      if (!visible) return;
      boat.rotation.z = Math.sin(seconds * 2.7) * 0.035;
      oar.position.set(0.23, 0.445, -0.82);
      oar.rotation.set(-0.27, -0.18 + Math.sin(seconds * 5.2) * strength * 0.32, -0.12);
      wake.update(strength, seconds);
    },
  };
}
