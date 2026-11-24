import * as THREE from "three";

const COUNT = 14;
const LIFETIME = 1.7;

export interface AshPuff {
  readonly root: THREE.Group;
  /** Kick up a small cloud of ash at (x, y, z). */
  burst(x: number, y: number, z: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** A short burst of grey ash flakes that rise, spread, and fade, used when the ash sandals first touch the ground. */
export function createAshPuff(): AshPuff {
  const root = new THREE.Group();
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const flakes = Array.from({ length: COUNT }, () => {
    const material = new THREE.MeshBasicMaterial({ color: 0x9d9390, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    root.add(mesh);
    return { mesh, material, age: LIFETIME, vx: 0, vy: 0, vz: 0, size: 0.1, spin: 0 };
  });

  return {
    root,
    burst(x, y, z) {
      flakes.forEach((f, i) => {
        const angle = (i / COUNT) * Math.PI * 2 + i * 0.7;
        const speed = 0.25 + (i % 4) * 0.12;
        f.age = 0;
        f.vx = Math.cos(angle) * speed;
        f.vz = Math.sin(angle) * speed;
        f.vy = 0.35 + (i % 3) * 0.14;
        f.size = 0.05 + (i % 5) * 0.018;
        f.spin = (i % 2 ? 1 : -1) * (1 + (i % 3));
        f.mesh.position.set(x + Math.cos(angle) * 0.1, y + 0.03, z + Math.sin(angle) * 0.1);
        f.mesh.visible = true;
      });
    },
    update(dt) {
      for (const f of flakes) {
        if (f.age >= LIFETIME) continue;
        f.age += dt;
        const t = Math.min(1, f.age / LIFETIME);
        const drag = Math.exp(-dt * 2.2);
        f.vx *= drag;
        f.vz *= drag;
        f.vy *= Math.exp(-dt * 1.6);
        f.mesh.position.x += f.vx * dt;
        f.mesh.position.z += f.vz * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.rotation.y += f.spin * dt;
        f.mesh.scale.setScalar(f.size * (1 + t * 1.8));
        f.material.opacity = 0.5 * (1 - t) * Math.min(1, f.age / 0.08);
        if (t >= 1) f.mesh.visible = false;
      }
    },
    dispose() {
      geometry.dispose();
      for (const f of flakes) f.material.dispose();
    },
  };
}
