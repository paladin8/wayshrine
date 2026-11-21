import * as THREE from "three";

/** Small solid-geometry helpers shared by the prop and monument meshes. */
/** One solid piece of a prop, in the prop's local space (y up, base at 0). */
export interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly color: number;
  readonly matrix: THREE.Matrix4;
}

export const cone = (r: number, h: number, sides: number) => new THREE.ConeGeometry(r, h, sides);
export const cylinder = (rTop: number, rBottom: number, h: number, sides: number) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, sides);
export const ico = () => new THREE.IcosahedronGeometry(1, 0);
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

export function at(x: number, y: number, z: number, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
}
