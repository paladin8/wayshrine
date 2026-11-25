import { Color, Mesh } from "three";
import { expect, it } from "vitest";
import { createRestorationWake } from "../game";
import { createWorld } from "../world";
import { combine, VitalityBuilder, vertexLife } from "./vitality-mesh";

it("restores vertices near the traveller before those near the shrine", () => {
  const region = createWorld("wake-render").region(0, 0);
  const origin = { x: region.shrine.x - 23, z: region.shrine.z };
  const wake = createRestorationWake(region, origin);
  wake.progress = 0.13;
  const builder = new VitalityBuilder(() => region.shrine);
  builder.addTriangles([
    origin.x, 0, origin.z,
    region.shrine.x, 0, region.shrine.z,
    origin.x, 0, origin.z + 1,
  ], new Color(0x84ae5d), region.id);
  const part = builder.build(() => 0);
  const combined = combine([part]);
  const mesh = part.object as Mesh;
  combined.applyVitality(() => wake.progress, new Set([region.id]), () => wake);
  expect(vertexLife(mesh, 0)).toBe(1);
  expect(vertexLife(mesh, 1)).toBe(0);

  combined.applyVitality(() => wake.progress);
  expect(vertexLife(mesh, 0)).toBe(0);
  expect(vertexLife(mesh, 1)).toBe(1);

  combined.applyVitality(() => 1, new Set([region.id]), () => wake);
  expect(vertexLife(mesh, 0)).toBe(1);
  expect(vertexLife(mesh, 1)).toBe(1);
  combined.dispose();
});
