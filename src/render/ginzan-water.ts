import * as THREE from "three";
import { ginzanStream, ginzanWarmth, type Terrain } from "../world";
import { lifeTimeUniform, type VitalityMesh } from "./vitality-mesh";

type Stream = NonNullable<ReturnType<typeof ginzanStream>>;

/** Terrain triangles and their continuous channel coordinates, transferred from the chunk worker. */
export interface GinzanStrip {
  readonly id: string;
  readonly vertices: Float32Array;
  readonly flow: Float32Array;
}

/** Distance along the channel, signed offset, distance to the path, from the channel’s centreline. */
export function ginzanFlowAt({ path }: Stream, x: number, z: number): readonly [number, number, number] {
  let along = 0, offset = 0, nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const px = x - a.x, pz = z - a.z;
    const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / (dx * dx + dz * dz)));
    const distanceSq = (px - dx * t) ** 2 + (pz - dz * t) ** 2;
    if (distanceSq >= nearest) continue;
    nearest = distanceSq;
    along = a.distance + (b.distance - a.distance) * t;
    offset = (px * dz - pz * dx) / Math.hypot(dx, dz);
  }
  return [along, offset, Number.isFinite(nearest) ? Math.sqrt(nearest) : 6];
}

function springMaterial(heat: THREE.IUniform<number>, bath: THREE.Vector3): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    transparent: true, depthWrite: false, roughness: 0.74, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSpringHeat = heat;
    shader.uniforms.uSpringTime = lifeTimeUniform;
    shader.uniforms.uSpringBath = { value: bath };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec3 aSpringFlow;
varying vec3 vSpringFlow;
varying vec2 vSpringPoint;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vSpringFlow = aSpringFlow;
vSpringPoint = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uSpringHeat;
uniform float uSpringTime;
uniform vec3 uSpringBath;
varying vec3 vSpringFlow;
varying vec2 vSpringPoint;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float heat = smoothstep(0.0, 1.0, uSpringHeat);
float along = vSpringFlow.x;
float crossStream = vSpringFlow.y;
float bend = 0.14 * sin(along * 0.8) + 0.07 * sin(along * 2.1);
vec2 poolPoint = vSpringPoint - uSpringBath.xy;
float poolEdge = uSpringBath.z > 0.0 ? length(poolPoint) - uSpringBath.z : 8.0;
float edge = min(vSpringFlow.z - 1.24 + bend, poolEdge);
float water = 1.0 - smoothstep(-0.12, 0.18, edge);
float bank = 1.0 - smoothstep(0.15, 0.94, edge);
float patina = 0.5 + 0.5 * sin(dot(vSpringPoint, vec2(3.3, 2.7))) * sin(dot(vSpringPoint, vec2(1.6, -3.1)));
float frost = 0.5 + 0.5 * sin(dot(vSpringPoint, vec2(0.7, 1.7)) + 0.8 * cos(vSpringPoint.x * 1.7));
vec3 rock = mix(vec3(0.20, 0.23, 0.24), vec3(0.31, 0.33, 0.31), patina);
vec3 ice = mix(vec3(0.30, 0.38, 0.42), vec3(0.54, 0.65, 0.71), 0.27 + frost * 0.35 + patina * 0.07);
float frozenRim = smoothstep(-0.30, -0.04, edge) * water;
ice = mix(ice, vec3(0.68, 0.75, 0.77), frozenRim * 0.55);

float shallow = smoothstep(-1.18, 0.02, edge);
vec3 liquid = mix(vec3(0.022, 0.099, 0.141), vec3(0.11, 0.30, 0.33), shallow);
float t = uSpringTime;
float current = cos(along * 3.1 - t * 3.6 + 1.3 * sin(crossStream * 3.8) + 0.7 * sin(along * 1.8 - t));
float lanes = 0.5 + 0.5 * sin(crossStream * 7.0 + sin(along * 1.4));
float rapids = smoothstep(0.64, 0.99, current) * (0.15 + 0.85 * lanes);
float ringDistance = length(poolPoint - vec2(-0.74, 0.58));
float rings = smoothstep(0.59, 1.0, cos(ringDistance * 5.8 - t * 2.4));
float glints = 0.5 + 0.5 * sin(dot(poolPoint, vec2(3.4, 2.7)) + 0.6 * t);
float inBath = 1.0 - smoothstep(-0.66, 0.11, poolEdge);
float foam = smoothstep(-0.31, -0.11, edge) * smoothstep(0.45, 0.93, rapids);
float detail = mix(rapids * 0.18, rings * glints * 0.15, inBath) + foam * 0.21;
liquid = mix(liquid, vec3(0.48, 0.72, 0.71), detail);
diffuseColor.rgb = mix(rock, mix(ice, liquid, heat), water);
diffuseColor.a *= max(water, bank * mix(0.21, 0.78, heat));`);
  };
  material.customProgramCacheKey = () => "ginzan-spring";
  return material;
}

export function buildGinzanSurfaces(
  terrain: Terrain, strips: readonly GinzanStrip[], progressOf: (id: string) => number,
): VitalityMesh | undefined {
  const ginzan = ginzanStream(terrain.world);
  if (!ginzan || strips.length === 0) return;
  const object = new THREE.Group();
  const parts = strips.map(({ id, vertices, flow }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute("aSpringFlow", new THREE.BufferAttribute(flow, 3));
    geometry.computeVertexNormals();
    const heat = { value: 0 };
    const spring = ginzan.springs.find((candidate) => candidate.regionId === id);
    const bath = spring ? new THREE.Vector3(spring.x, spring.z, spring.radius) : new THREE.Vector3();
    const material = springMaterial(heat, bath);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    object.add(mesh);
    return { id, geometry, material, heat };
  });
  const regionIds = new Set([ginzan.sourceId, ...strips.map((strip) => strip.id)]);
  const applyVitality: VitalityMesh["applyVitality"] = (progress, only) => {
    for (const { id, heat } of parts) {
      if (!only || only.has(id) || only.has(ginzan.sourceId)) heat.value = ginzanWarmth(ginzan, id, progress);
    }
  };
  applyVitality(progressOf);
  return {
    object, regionIds, applyVitality,
    dispose() {
      for (const { geometry, material } of parts) {
        geometry.dispose();
        material.dispose();
      }
    },
  };
}
