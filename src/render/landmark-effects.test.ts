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
});
