import * as THREE from "three";
import { expect, it } from "vitest";
import { CHUNK_SIZE, createTerrain, createWorld, ginzanStream, propsInChunk } from "../world";
import { buildGinzanSurfaces, ginzanFlowAt } from "./ginzan-water";
import { terrainChunkData } from "./terrain-mesh";

it.each(["wayshrine", "spring"])("shares flow coordinates and thaws the bath only after both restorations in %s", (seed) => {
  const terrain = createTerrain(createWorld(seed));
  const plan = ginzanStream(terrain.world)!;
  const bath = plan.springs[0]!;
  const chunkX = Math.floor(bath.x / CHUNK_SIZE), chunkZ = Math.floor(bath.z / CHUNK_SIZE);
  const { strips } = terrainChunkData(terrain, chunkX, chunkZ);
  const strip = strips.find(({ id }) => id === bath.regionId)!;
  expect(strip.flow.length).toBe(strip.vertices.length);
  expect(strip.flow.every(Number.isFinite)).toBe(true);
  for (let i = 0; i < strip.flow.length; i += 3) {
    const expected = ginzanFlowAt(plan, strip.vertices[i]!, strip.vertices[i + 2]!);
    expect(strip.flow[i]).toBeCloseTo(expected[0], 4);
    expect(strip.flow[i + 1]).toBeCloseTo(expected[1], 5);
    expect(strip.flow[i + 2]).toBeCloseTo(expected[2], 5);
  }

  const life = new Map<string, number>();
  const progress = (id: string) => life.get(id) ?? 0;
  const built = buildGinzanSurfaces(terrain, [strip], progress)!;
  try {
    const mesh = built.object.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const shader = { ...THREE.ShaderLib.standard, uniforms: {} } as Parameters<THREE.Material["onBeforeCompile"]>[0];
    mesh.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    const heat = shader.uniforms.uSpringHeat!;
    expect(heat.value).toBe(0);
    life.set(bath.regionId, 1);
    built.applyVitality(progress, new Set([bath.regionId]));
    expect(heat.value).toBe(0);
    life.set(plan.sourceId, 0.5);
    built.applyVitality(progress, new Set([plan.sourceId]));
    expect(heat.value).toBe(0.5);
    life.set(plan.sourceId, 1);
    built.applyVitality(progress, new Set([plan.sourceId]));
    expect(heat.value).toBe(1);
    life.delete(bath.regionId);
    built.applyVitality(progress, new Set([bath.regionId]));
    expect(heat.value).toBe(0);
  } finally {
    built.dispose();
  }

  const c = Math.cos(bath.entranceAngle), s = Math.sin(bath.entranceAngle);
  for (let x = chunkX - 1; x <= chunkX + 1; x++) {
    for (let z = chunkZ - 1; z <= chunkZ + 1; z++) {
      for (const prop of propsInChunk(terrain, x, z)) {
        const dx = prop.x - bath.x, dz = prop.z - bath.z;
        const along = dx * c + dz * s;
        const across = Math.abs(dz * c - dx * s);
        expect(along > bath.radius && along < bath.radius + 4 && across < 2).toBe(false);
      }
    }
  }
});
