import { Mesh, Vector3 } from "three";
import { expect, it } from "vitest";
import { createTerrain, createWorld, type Terrain } from "../world";
import { buildTerrainChunk } from "./terrain-mesh";

it("closes both sides of a sloping seam where the two tile edges cross", () => {
  const terrain = createTerrain(createWorld("sloping-seam"));
  const fixture: Terrain = {
    ...terrain,
    corners: (x, z) => x === 0 && z === 0 ? [2, 2, 0, 0] : [1, 1, 1, 1],
  };
  const built = buildTerrainChunk(fixture, 0, 0, () => 1);
  try {
    const position = (built.object as Mesh).geometry.getAttribute("position");
    const vertex = (i: number) => new Vector3().fromBufferAttribute(position, i);
    const faces: Array<{ start: number; end: number; facing: number }> = [];
    for (let i = 0; i < position.count; i += 3) {
      const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
      if ([a, b, c].some(({ x, z }) => x !== 1 || z < 0 || z > 1)) continue;
      const facing = Math.sign(b.clone().sub(a).cross(c.clone().sub(a)).x);
      if (facing) faces.push({ start: Math.min(a.z, b.z, c.z), end: Math.max(a.z, b.z, c.z), facing });
    }
    expect(faces).toEqual([{ start: 0, end: 0.5, facing: 1 }, { start: 0.5, end: 1, facing: -1 }]);
  } finally {
    built.dispose();
  }
});
