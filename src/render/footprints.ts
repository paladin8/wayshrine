import * as THREE from "three";

/** Seconds a print takes to fade away completely. */
const LIFETIME = 8;
const CAPACITY = 40;
const PRINT_OPACITY = 0.8;

export interface Footprints {
  readonly root: THREE.Group;
  /** Press a snowshoe print into the ground at (x, y, z), pointing along `yaw`. */
  add(x: number, y: number, z: number, yaw: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** Fading snowshoe prints: a shallow oval with a lighter net pattern inside, reused in a ring. */
export function createFootprints(): Footprints {
  const root = new THREE.Group();
  const oval = new THREE.CircleGeometry(1, 14);
  oval.rotateX(-Math.PI / 2);
  oval.scale(0.115, 1, 0.31);
  const net = new THREE.CircleGeometry(1, 10);
  net.rotateX(-Math.PI / 2);
  net.scale(0.07, 1, 0.24);
  const bar = new THREE.PlaneGeometry(0.2, 0.025);
  bar.rotateX(-Math.PI / 2);

  const dent = (color: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      flatShading: true,
    });
  const edgeMat = dent(0x93a5b8);
  const netMat = dent(0xbccbda);
  const barMat = dent(0x7f93a8);
  const materials = [edgeMat, netMat, barMat] as const;
  const base = [PRINT_OPACITY, PRINT_OPACITY * 0.9, PRINT_OPACITY] as const;

  interface Print {
    readonly group: THREE.Group;
    age: number;
  }
  const prints: Print[] = [];
  for (let i = 0; i < CAPACITY; i++) {
    const group = new THREE.Group();
    group.visible = false;
    const edge = new THREE.Mesh(oval, edgeMat);
    const inner = new THREE.Mesh(net, netMat);
    inner.position.y = 0.002;
    group.add(edge, inner);
    for (const z of [-0.1, 0.07]) {
      const b = new THREE.Mesh(bar, barMat);
      b.position.set(0, 0.004, z);
      group.add(b);
    }
    root.add(group);
    prints.push({ group, age: LIFETIME });
  }
  let next = 0;

  // All prints share three materials, so the fade is per print through scale-free opacity groups:
  // each print owns clones instead, so ages can differ.
  const owned: THREE.MeshStandardMaterial[] = [];
  for (const p of prints) {
    p.group.children.forEach((child, idx) => {
      const mesh = child as THREE.Mesh;
      const src = idx === 0 ? edgeMat : idx === 1 ? netMat : barMat;
      const clone = src.clone();
      owned.push(clone);
      mesh.material = clone;
    });
  }

  return {
    root,
    add(x, y, z, yaw) {
      const p = prints[next]!;
      next = (next + 1) % CAPACITY;
      p.age = 0;
      p.group.visible = true;
      p.group.position.set(x, y + 0.03, z);
      p.group.rotation.y = yaw;
    },
    update(dt) {
      for (const p of prints) {
        if (!p.group.visible) continue;
        p.age += dt;
        if (p.age >= LIFETIME) {
          p.group.visible = false;
          continue;
        }
        const f = 1 - p.age / LIFETIME;
        const fade = f * f * (3 - 2 * f);
        p.group.children.forEach((child, idx) => {
          ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = (idx === 0 ? base[0] : idx === 1 ? base[1] : base[2]) * fade;
        });
      }
    },
    dispose() {
      oval.dispose();
      net.dispose();
      bar.dispose();
      materials.forEach((m) => m.dispose());
      owned.forEach((m) => m.dispose());
    },
  };
}
