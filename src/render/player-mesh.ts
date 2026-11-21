import * as THREE from "three";
import { palette } from "./palette";

export interface PlayerMesh {
  readonly group: THREE.Group;
  setBoat(visible: boolean): void;
}

/** A small low-poly traveller, with a boat that appears on water. */
export function buildPlayer(): PlayerMesh {
  const group = new THREE.Group();
  const mat = (color: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, flatShading: true });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  add(new THREE.ConeGeometry(0.28, 0.75, 6), mat(palette.red), 0.4);
  add(new THREE.IcosahedronGeometry(0.2, 0), mat(palette.cream), 0.95);
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 6), mat(palette.roof), 1.12); // hat brim

  const boat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 1.5), mat(palette.wood));
  boat.position.y = 0.02;
  boat.castShadow = true;
  boat.visible = false;
  group.add(boat);

  return { group, setBoat: (visible) => (boat.visible = visible) };
}
