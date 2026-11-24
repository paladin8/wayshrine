import * as THREE from "three";

/**
 * Steam and smoke are modelled as clusters of separate blobs in one mesh, named for their material (`..._steam`,
 * `..._plume`). Once a landmark is restored each blob drifts along the cluster's own direction, swelling and
 * thinning as it goes, and is replaced from below by the next, so the cluster reads as a rising column.
 */
const PUFF_MATERIAL = /(?:^|_)(steam|plume|smoke)$/;

/** Splits a mesh into its disconnected pieces; vertices at the same place count as connected. */
export function splitComponents(geometry: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (!position) return [];
  const index = geometry.index;
  const triangles = index ? index.count / 3 : position.count / 3;
  const corner = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);

  const parent = new Map<string, string>();
  const key = (i: number): string =>
    `${Math.round(position.getX(i) * 1000)},${Math.round(position.getY(i) * 1000)},${Math.round(position.getZ(i) * 1000)}`;
  const find = (k: string): string => {
    let root = k;
    while ((parent.get(root) ?? root) !== root) root = parent.get(root)!;
    parent.set(k, root);
    return root;
  };
  const join = (a: string, b: string): void => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let t = 0; t < triangles; t++) {
    const a = key(corner(t, 0));
    parent.set(a, parent.get(a) ?? a);
    for (const k of [1, 2]) {
      const b = key(corner(t, k));
      parent.set(b, parent.get(b) ?? b);
      join(a, b);
    }
  }

  const groups = new Map<string, number[]>();
  for (let t = 0; t < triangles; t++) {
    const root = find(key(corner(t, 0)));
    const list = groups.get(root);
    if (list) list.push(t);
    else groups.set(root, [t]);
  }

  return [...groups.values()].map((tris) => {
    const positions: number[] = [];
    const normals: number[] = [];
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const i = corner(t, k);
        positions.push(position.getX(i), position.getY(i), position.getZ(i));
        if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      }
    }
    const piece = new THREE.BufferGeometry();
    piece.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (normal) piece.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    else piece.computeVertexNormals();
    return piece;
  });
}

interface Puff {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly home: THREE.Vector3;
  readonly phase: number;
  readonly period: number;
}

export interface Puffs {
  /** Drifts the blobs to `time` (seconds). `life` in [0, 1] is the landmark's vitality: dormant places are still. */
  update(time: number, life: number): void;
}

const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Replaces every steam/smoke mesh under `root` with separately animated blobs. Returns null when there is none.
 * Call before the model's materials are collected: the originals are removed.
 */
export function extractPuffs(root: THREE.Object3D): Puffs | null {
  const sources: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && PUFF_MATERIAL.test((o.material as THREE.Material).name)) sources.push(o);
  });
  if (!sources.length) return null;

  const puffs: Puff[] = [];
  const clusters: { readonly puffs: Puff[]; readonly dir: THREE.Vector3; readonly travel: number; readonly smoke: boolean }[] = [];
  for (const source of sources) {
    const base = source.material as THREE.MeshStandardMaterial;
    const smoke = /plume|smoke/.test(base.name);
    const holder = new THREE.Group();
    holder.position.copy(source.position);
    holder.quaternion.copy(source.quaternion);
    holder.scale.copy(source.scale);
    const members: Puff[] = [];
    const centres: THREE.Vector3[] = [];
    for (const geometry of splitComponents(source.geometry)) {
      geometry.computeBoundingBox();
      const centre = geometry.boundingBox!.getCenter(new THREE.Vector3());
      geometry.translate(-centre.x, -centre.y, -centre.z);
      const material = base.clone();
      material.transparent = true;
      material.depthWrite = false;
      material.flatShading = true;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(centre);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      holder.add(mesh);
      const n = puffs.length;
      const puff: Puff = {
        mesh, material, home: centre,
        phase: hash(n + 1),
        period: (smoke ? 9 : 5) + hash(n + 40) * (smoke ? 4 : 3),
      };
      puffs.push(puff);
      members.push(puff);
      centres.push(centre);
    }
    source.parent?.add(holder);
    source.parent?.remove(source);
    source.geometry.dispose();
    if (!members.length) continue;

    // A plume leans away along the line its blobs already take; steam goes straight up.
    const dir = new THREE.Vector3(0, 1, 0);
    let travel = 0.9;
    if (smoke) {
      const lowest = centres.reduce((a, b) => (b.y < a.y ? b : a));
      const highest = centres.reduce((a, b) => (b.y > a.y ? b : a));
      const line = highest.clone().sub(lowest);
      if (line.length() > 0.3) dir.copy(line.normalize());
      travel = Math.min(3.2, Math.max(1.2, highest.y - lowest.y));
    } else {
      const lowest = Math.min(...centres.map((c) => c.y));
      const highest = Math.max(...centres.map((c) => c.y));
      travel = Math.min(1.8, Math.max(0.7, (highest - lowest) * 0.7));
    }
    clusters.push({ puffs: members, dir, travel, smoke });
  }

  return {
    update(time, life) {
      for (const { puffs: members, dir, travel, smoke } of clusters) {
        for (const puff of members) {
          const visible = life > 0.01;
          puff.mesh.visible = visible;
          if (!visible) continue;
          const u = (time / puff.period + puff.phase) % 1;
          const fade = Math.sin(Math.PI * u) ** 0.8;
          const swell = 0.6 + 0.8 * u;
          puff.mesh.position.copy(puff.home).addScaledVector(dir, (u - 0.5) * travel);
          puff.mesh.position.x += Math.sin(time * 0.6 + puff.phase * 6.28) * 0.07;
          puff.mesh.scale.setScalar(swell * (0.5 + 0.5 * life));
          puff.material.opacity = (smoke ? 0.85 : 0.8) * fade * life;
        }
      }
    },
  };
}
