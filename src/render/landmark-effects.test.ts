import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { extractPuffs, splitComponents } from "./landmark-effects";

function blob(x: number): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.3, 0).translate(x, 1, 0);
}

describe("landmark steam", () => {
  it("splits disjoint blobs into separate pieces", () => {
    const merged = new THREE.BufferGeometry();
    const a = blob(0).toNonIndexed(), b = blob(2).toNonIndexed();
    const positions = [...a.getAttribute("position").array, ...b.getAttribute("position").array];
    merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    expect(splitComponents(merged)).toHaveLength(2);
  });

  it("replaces steam meshes with animated puffs that only show once alive", () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ name: "pond_steam" });
    const geometry = new THREE.BufferGeometry();
    const a = blob(0).toNonIndexed(), b = blob(2).toNonIndexed();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([...a.getAttribute("position").array, ...b.getAttribute("position").array], 3));
    root.add(new THREE.Mesh(geometry, material));
    const rock = new THREE.Mesh(blob(5), new THREE.MeshStandardMaterial({ name: "pond_rock" }));
    root.add(rock);

    const puffs = extractPuffs(root)!;
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => { if (o instanceof THREE.Mesh && o !== rock) meshes.push(o); });
    expect(meshes).toHaveLength(2);
    expect(root.children).toContain(rock);

    puffs.update(3, 0);
    expect(meshes.every((m) => !m.visible)).toBe(true);
    puffs.update(3, 1);
    expect(meshes.every((m) => m.visible)).toBe(true);
    const before = meshes[0]!.position.y;
    puffs.update(4.5, 1);
    expect(meshes[0]!.position.y).not.toBeCloseTo(before, 3);
  });

  it("leaves a model without steam alone", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(blob(0), new THREE.MeshStandardMaterial({ name: "pond_water" })));
    expect(extractPuffs(root)).toBeNull();
  });

  function merged(...geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const out = new THREE.BufferGeometry();
    const positions = geometries.flatMap((g) => [...g.toNonIndexed().getAttribute("position").array]);
    out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return out;
  }
  const effectMeshes = (root: THREE.Object3D, name: string): THREE.Mesh[] => {
    const found: THREE.Mesh[] = [];
    root.traverse((o) => { if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === name) found.push(o); });
    return found;
  };

  it("slides the streaks of a waterfall down and lets spray boil, only for waterfall landmarks", () => {
    const build = (): THREE.Group => {
      const root = new THREE.Group();
      const streak = new THREE.BoxGeometry(0.2, 3, 0.2).translate(0, 2, 0);
      const splash = new THREE.BoxGeometry(1, 0.5, 1).translate(3, 0.25, 0);
      root.add(new THREE.Mesh(merged(streak, splash), new THREE.MeshStandardMaterial({ name: "foam" })));
      return root;
    };
    expect(extractPuffs(build(), "somewhere-else")).toBeNull();

    const root = build();
    const falls = extractPuffs(root, "kegon-falls")!;
    const pieces = effectMeshes(root, "foam");
    expect(pieces).toHaveLength(2);
    const streak = pieces.find((m) => m.position.x === 0)!;
    const splash = pieces.find((m) => m.position.x === 3)!;

    // Dormant: they sit where they were modelled.
    falls.update(1, 0);
    expect(streak.position.y).toBeCloseTo(2, 5);
    expect((streak.material as THREE.Material).opacity).toBe(1);
    // Restored: the streak slides, the splash rises and swells.
    falls.update(2, 1);
    const y0 = streak.position.y, s0 = splash.position.y;
    falls.update(2.5, 1);
    expect(streak.position.y).not.toBeCloseTo(y0, 3);
    expect(splash.position.y).not.toBeCloseTo(s0, 3);
  });

  it("keeps the other pieces of a fall's material still", () => {
    const root = new THREE.Group();
    const fall = new THREE.BoxGeometry(1, 8, 1).translate(0, 4, 0);
    const wall = new THREE.BoxGeometry(0.4, 0.5, 0.2).translate(4, 3, 0);
    root.add(new THREE.Mesh(merged(fall, wall), new THREE.MeshStandardMaterial({ name: "white" })));
    extractPuffs(root, "nachi-falls");
    const meshes = effectMeshes(root, "white");
    expect(meshes).toHaveLength(2);
    expect(meshes.some((m) => m.geometry.getAttribute("position").count === 36 && m.position.lengthSq() === 0)).toBe(true);
  });

  it("turns a whirlpool's eye together with the foam arms around it", () => {
    const root = new THREE.Group();
    const eye = new THREE.CylinderGeometry(1, 1, 0.02, 8).translate(5, -0.7, 5);
    const arm = new THREE.BoxGeometry(0.6, 0.02, 0.2).translate(6, -0.7, 5);
    const far = new THREE.BoxGeometry(0.6, 0.02, 0.2).translate(-9, -0.7, 5);
    root.add(new THREE.Mesh(merged(eye), new THREE.MeshStandardMaterial({ name: "deep" })));
    root.add(new THREE.Mesh(merged(arm, far), new THREE.MeshStandardMaterial({ name: "foam" })));
    const world = (m: THREE.Mesh): THREE.Vector3 => m.getWorldPosition(new THREE.Vector3());
    const whirl = extractPuffs(root, "naruto")!;
    root.updateMatrixWorld(true);
    const arms = effectMeshes(root, "foam");
    const before = arms.map((m) => world(m).clone());
    whirl.update(0, 1);
    whirl.update(1, 1);
    root.updateMatrixWorld(true);
    const after = arms.map(world);
    const flat = (v: THREE.Vector3): THREE.Vector2 => new THREE.Vector2(v.x, v.z);
    const moved = arms.filter((_, i) => flat(before[i]!).distanceTo(flat(after[i]!)) > 0.1);
    expect(moved).toHaveLength(1);
    // The foam rides the sea's swell above its modelled height once restored.
    expect(arms.every((_, i) => Math.abs(after[i]!.y - before[i]!.y) > 1e-3)).toBe(true);
    // A dormant whirlpool does not turn.
    whirl.update(2, 0);
    root.updateMatrixWorld(true);
    // It settles back at its modelled height.
    expect(arms.map(world).every((p, i) => Math.abs(p.y - before[i]!.y) < 1e-6)).toBe(true);
  });
});
