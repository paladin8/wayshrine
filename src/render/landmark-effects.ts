import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Moving vapour and water on a restored landmark. The models keep each of these as clusters of separate pieces in
 * one mesh per material, and this module pulls the pieces apart and animates them:
 *
 * - steam and smoke (`steam`, `plume`, `smoke`): each blob drifts along its cluster's own direction, swelling and
 *   thinning, and is replaced from below by the next, so the cluster reads as a rising column;
 * - waterfalls (`FALLS`): tall thin pieces of foam are the streaks of the fall and slide down it, flat ones (the
 *   lip of a cascade) glint in place, and the low pieces at its foot boil up as spray;
 * - whirlpools (`VORTEX`): each dark eye turns together with the white arms around it.
 *
 * Dormant places stay still and hidden or unmoving, so the motion arrives with the restoration.
 */
const PUFF_MATERIAL = /(?:^|_)(steam|plume|smoke)$/;

/** Waterfall landmarks: the material that holds the fall's white pieces, and whether only pieces at ground level count. */
const FALLS: Readonly<Record<string, { readonly material: string; readonly baseOnly?: boolean }>> = {
  "kegon-falls": { material: "foam" },
  takachiho: { material: "foam" },
  "shiratani-unsuikyo": { material: "foam" },
  "nachi-falls": { material: "white", baseOnly: true },
};
const VORTEX = { id: "naruto", eye: "deep", arms: "foam" } as const;

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


type Mode = "rise" | "flow" | "spray";

interface Puff {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly home: THREE.Vector3;
  readonly phase: number;
  readonly period: number;
  /** Height of a streak, which is how far it slides. */
  readonly height: number;
}

interface Cluster {
  readonly mode: Mode;
  readonly puffs: Puff[];
  readonly dir: THREE.Vector3;
  readonly travel: number;
  readonly alpha: number;
}

export interface Puffs {
  /** Moves everything to `time` (seconds). `life` in [0, 1] is the landmark's vitality: dormant places are still. */
  update(time: number, life: number): void;
}

const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function holderFor(source: THREE.Mesh): THREE.Group {
  const holder = new THREE.Group();
  holder.position.copy(source.position);
  holder.quaternion.copy(source.quaternion);
  holder.scale.copy(source.scale);
  return holder;
}

function swap(source: THREE.Mesh, holder: THREE.Object3D): void {
  source.parent?.add(holder);
  source.parent?.remove(source);
  source.geometry.dispose();
}

function fadingMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const material = base.clone();
  material.transparent = true;
  material.depthWrite = false;
  material.flatShading = true;
  return material;
}

function boxOf(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

/** The pieces nobody animates go back into one plain mesh with the original material. */
function addStill(holder: THREE.Object3D, pieces: THREE.BufferGeometry[], material: THREE.Material): void {
  if (!pieces.length) return;
  const merged = mergeGeometries(pieces);
  if (!merged) return;
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  holder.add(mesh);
}

/**
 * Replaces the steam, smoke, waterfall and whirlpool meshes of landmark `id` under `root` with separately animated
 * pieces. Returns null when the model has none. Call before the model's materials are collected: the originals
 * are removed.
 */
export function extractPuffs(root: THREE.Object3D, id = ""): Puffs | null {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
  const named = (m: THREE.Mesh): string => (m.material as THREE.Material).name;

  const clusters: Cluster[] = [];
  const whirls: { readonly pivot: THREE.Group; readonly rate: number }[] = [];
  let count = 0;

  const addPuff = (holder: THREE.Object3D, geometry: THREE.BufferGeometry, base: THREE.MeshStandardMaterial, period: number): Puff => {
    const box = boxOf(geometry);
    const centre = box.getCenter(new THREE.Vector3());
    const height = box.max.y - box.min.y;
    geometry.translate(-centre.x, -centre.y, -centre.z);
    const material = fadingMaterial(base);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(centre);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    holder.add(mesh);
    const n = count++;
    return { mesh, material, home: centre, phase: hash(n + 1), period: period * (0.8 + 0.4 * hash(n + 40)), height };
  };

  // Steam and smoke.
  for (const source of meshes.filter((m) => PUFF_MATERIAL.test(named(m)))) {
    const base = source.material as THREE.MeshStandardMaterial;
    const smoke = /plume|smoke/.test(base.name);
    const holder = holderFor(source);
    const members = splitComponents(source.geometry).map((g) => addPuff(holder, g, base, smoke ? 11 : 6.5));
    swap(source, holder);
    if (!members.length) continue;

    // A plume leans away along the line its blobs already take; steam goes straight up.
    const dir = new THREE.Vector3(0, 1, 0);
    const lowest = members.reduce((a, b) => (b.home.y < a.home.y ? b : a)).home;
    const highest = members.reduce((a, b) => (b.home.y > a.home.y ? b : a)).home;
    let travel = Math.min(1.8, Math.max(0.7, (highest.y - lowest.y) * 0.7));
    if (smoke) {
      const line = highest.clone().sub(lowest);
      if (line.length() > 0.3) dir.copy(line.normalize());
      travel = Math.min(3.2, Math.max(1.2, highest.y - lowest.y));
    }
    clusters.push({ mode: "rise", puffs: members, dir, travel, alpha: smoke ? 0.85 : 0.8 });
  }

  // A waterfall: tall thin pieces are the streaks of the fall, low ones at its foot are the spray.
  const fall = FALLS[id];
  for (const source of fall ? meshes.filter((m) => named(m) === fall.material) : []) {
    const base = source.material as THREE.MeshStandardMaterial;
    const holder = holderFor(source);
    const streaks: Puff[] = [];
    const spray: Puff[] = [];
    const still: THREE.BufferGeometry[] = [];
    for (const g of splitComponents(source.geometry)) {
      const box = boxOf(g);
      const size = box.getSize(new THREE.Vector3());
      const width = Math.max(size.x, size.z);
      if (fall!.baseOnly && box.min.y > 0.7) still.push(g);
      else if (size.y < 0.3 || (size.y >= 1 && size.y > 2 * width)) streaks.push(addPuff(holder, g, base, 2.2));
      else spray.push(addPuff(holder, g, base, 2.4));
    }
    addStill(holder, still, base);
    swap(source, holder);
    if (streaks.length) clusters.push({ mode: "flow", puffs: streaks, dir: new THREE.Vector3(0, 1, 0), travel: 0, alpha: 1 });
    if (spray.length) clusters.push({ mode: "spray", puffs: spray, dir: new THREE.Vector3(0, 1, 0), travel: 0.5, alpha: 0.9 });
  }

  // Whirlpools: each dark eye turns together with the arms of foam around it.
  const eyes = id === VORTEX.id ? meshes.filter((m) => named(m) === VORTEX.eye) : [];
  const arms = id === VORTEX.id ? meshes.filter((m) => named(m) === VORTEX.arms) : [];
  for (const eye of eyes) {
    const holder = holderFor(eye);
    const pools: { readonly centre: THREE.Vector3; readonly radius: number; readonly pivot: THREE.Group }[] = [];
    for (const g of splitComponents(eye.geometry)) {
      const box = boxOf(g);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const pivot = new THREE.Group();
      pivot.position.set(centre.x, 0, centre.z);
      const mesh = new THREE.Mesh(g, eye.material as THREE.Material);
      mesh.position.set(-centre.x, 0, -centre.z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      pivot.add(mesh);
      holder.add(pivot);
      pools.push({ centre, radius: Math.max(size.x, size.z) / 2, pivot });
      whirls.push({ pivot, rate: 0.9 });
    }
    swap(eye, holder);
    for (const arm of arms) {
      const still: THREE.BufferGeometry[] = [];
      for (const g of splitComponents(arm.geometry)) {
        const centre = boxOf(g).getCenter(new THREE.Vector3());
        const pool = pools
          .map((p) => ({ p, d: Math.hypot(p.centre.x - centre.x, p.centre.z - centre.z) }))
          .filter(({ p, d }) => d < p.radius * 1.5)
          .sort((a, b) => a.d - b.d)[0]?.p;
        if (!pool) { still.push(g); continue; }
        const mesh = new THREE.Mesh(g, arm.material as THREE.Material);
        mesh.position.set(-pool.centre.x, 0, -pool.centre.z);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        pool.pivot.add(mesh);
      }
      addStill(holder, still, arm.material as THREE.Material);
      swap(arm, new THREE.Group());
    }
  }

  if (!clusters.length && !whirls.length) return null;

  let last = 0;
  return {
    update(time, life) {
      const dt = Math.max(0, Math.min(0.25, time - last));
      last = time;
      for (const whirl of whirls) whirl.pivot.rotation.y += dt * whirl.rate * life;
      for (const { mode, puffs, dir, travel, alpha } of clusters) {
        for (const puff of puffs) {
          const alive = life > 0.01;
          if (mode === "rise") puff.mesh.visible = alive;
          if (!alive) {
            // Dormant water and foam keep their modelled shape.
            if (mode !== "rise") {
              puff.mesh.position.copy(puff.home);
              puff.mesh.scale.setScalar(1);
              puff.material.opacity = 1;
            }
            continue;
          }
          const u = (time / puff.period + puff.phase) % 1;
          if (mode === "flow") {
            puff.mesh.position.copy(puff.home);
            puff.mesh.position.y += (0.5 - u) * 0.4 * puff.height * life;
            puff.material.opacity = 1 + (alpha * (0.4 + 0.6 * Math.sin(Math.PI * u) ** 0.7) - 1) * life;
          } else if (mode === "spray") {
            puff.mesh.position.copy(puff.home).addScaledVector(dir, (u - 0.2) * travel * life);
            puff.mesh.scale.setScalar(1 + (0.8 + 0.4 * u - 1) * life);
            puff.material.opacity = 1 + (alpha * Math.sin(Math.PI * u) ** 0.5 - 1) * life;
          } else {
            const fade = Math.sin(Math.PI * u) ** 0.8;
            puff.mesh.position.copy(puff.home).addScaledVector(dir, (u - 0.5) * travel);
            puff.mesh.position.x += Math.sin(time * 0.6 + puff.phase * 6.28) * 0.07;
            puff.mesh.scale.setScalar((0.6 + 0.8 * u) * (0.5 + 0.5 * life));
            puff.material.opacity = alpha * fade * life;
          }
        }
      }
    },
  };
}
