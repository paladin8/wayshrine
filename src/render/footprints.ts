import * as THREE from "three";

/** Seconds a print takes to fade away completely. */
const LIFETIME = 8;
const CAPACITY = 40;

type Surface = "snow" | "sand";

export interface Footprints {
  readonly root: THREE.Group;
  /** Press a print into the ground at (x, y, z), pointing along `yaw`. */
  add(x: number, y: number, z: number, yaw: number, surface: Surface): void;
  update(dt: number): void;
  dispose(): void;
}

function oval(width: number, length: number, segments: number): THREE.BufferGeometry {
  return new THREE.CircleGeometry(1, segments).rotateX(-Math.PI / 2).scale(width, 1, length);
}

/** Fading snowshoe and boot prints, drawn from the same pool. */
export function createFootprints(): Footprints {
  const root = new THREE.Group();
  const rim = oval(0.115, 0.31, 14);
  const net = oval(0.07, 0.24, 10);
  const bar = new THREE.PlaneGeometry(0.2, 0.025).rotateX(-Math.PI / 2);
  const forefoot = oval(0.068, 0.079, 12);
  const heel = oval(0.043, 0.056, 10);
  const styles = {
    snow: [
      { geometry: rim, color: 0x93a5b8, y: 0, z: 0, opacity: 0.8 },
      { geometry: net, color: 0xbccbda, y: 0.002, z: 0, opacity: 0.72 },
      { geometry: bar, color: 0x7f93a8, y: 0.004, z: -0.1, opacity: 0.8 },
      { geometry: bar, color: 0x7f93a8, y: 0.004, z: 0.07, opacity: 0.8 },
    ],
    sand: [
      { geometry: forefoot, color: 0xa48052, y: 0, z: 0.05, opacity: 0.7 },
      { geometry: heel, color: 0xa48052, y: 0, z: -0.065, opacity: 0.7 },
    ],
  };

  const prints = Array.from({ length: CAPACITY }, () => {
    const group = new THREE.Group();
    group.visible = false;
    const parts = styles.snow.map(({ geometry }) => new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      flatShading: true,
    })));
    group.add(...parts);
    root.add(group);
    return { group, parts, age: LIFETIME, surface: "snow" as Surface };
  });
  let next = 0;

  return {
    root,
    add(x, y, z, yaw, surface) {
      const print = prints[next]!;
      next = (next + 1) % CAPACITY;
      print.age = 0;
      print.surface = surface;
      print.group.visible = true;
      print.group.position.set(x, y + 0.03, z);
      print.group.rotation.y = yaw;
      print.parts.forEach((mesh, i) => {
        const part = styles[surface][i];
        mesh.visible = part !== undefined;
        if (!part) return;
        mesh.geometry = part.geometry;
        mesh.position.set(0, part.y, part.z);
        mesh.material.color.setHex(part.color);
      });
    },
    update(dt) {
      for (const print of prints) {
        if (!print.group.visible) continue;
        print.age += dt;
        if (print.age >= LIFETIME) {
          print.group.visible = false;
          continue;
        }
        const f = 1 - print.age / LIFETIME;
        const fade = f * f * (3 - 2 * f);
        styles[print.surface].forEach(({ opacity }, i) => {
          print.parts[i]!.material.opacity = opacity * fade;
        });
      }
    },
    dispose() {
      for (const geometry of [rim, net, bar, forefoot, heel]) geometry.dispose();
      for (const { parts } of prints) parts.forEach((part) => part.material.dispose());
    },
  };
}
