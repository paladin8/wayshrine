import * as THREE from "three";
import { frontGlow, lifeAt } from "../game";
import type { Point } from "../world";
import { palette } from "./palette";

/** A drawable chunk of the world whose look follows region restoration. */
export interface VitalityMesh {
  readonly object: THREE.Object3D;
  readonly regionIds: ReadonlySet<string>;
  /**
   * Recolours from each region's restoration progress (0 dead, 1 alive, in
   * between a front sweeping out from the shrine). With `only`, regions not
   * in the set are left as they are.
   */
  applyVitality(progressOf: (regionId: string) => number, only?: ReadonlySet<string>): void;
  dispose(): void;
}

/** A dead colour: the same hue drained of saturation and darkened. */
export function deadOf(c: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.12, hsl.l * 0.62);
}

// --- shared material: wind sway for plants, ripples for water ---------------

const timeUniform = { value: 0 };

/** Advances the clock used by the wind and water motion. */
export function setLifeTime(seconds: number): void {
  timeUniform.value = seconds;
}

/**
 * One material for all terrain and props. Per-vertex `aMotion.x` is how much a
 * vertex sways in the wind (0 for rocks and ground, up to 1 at treetops),
 * `aMotion.y` marks water surface, and `aLife` is how alive the vertex is, so
 * dead regions are perfectly still.
 */
const lifeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
lifeMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = timeUniform;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute float aLife;
attribute vec3 aMotion;
uniform float uTime;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vec4 lifeWorld = modelMatrix * vec4(position, 1.0);
float lifePhase = lifeWorld.x * 0.31 + lifeWorld.z * 0.23;
float gust = pow(0.5 + 0.5 * sin(uTime * 0.72 + lifeWorld.x * 0.071 - lifeWorld.z * 0.095), 4.0);
float wind = sin(uTime * 1.7 + lifePhase) + 0.45 * sin(uTime * 2.9 - lifePhase * 1.7);
transformed.x += wind * (0.035 + 0.115 * gust) * aMotion.x * aLife;
transformed.z += cos(uTime * 1.3 + lifePhase * 0.8) * (0.025 + 0.10 * gust) * aMotion.x * aLife;
float ocean = step(1.5, aMotion.y);
float swell = sin(uTime * mix(1.6, 1.05, ocean) + lifeWorld.x * mix(0.51, 0.33, ocean) - lifeWorld.z * 0.36);
float ripple = cos(uTime * 2.65 + lifeWorld.z * 0.96 + lifeWorld.x * 0.29);
transformed.y += (swell * (0.022 + 0.037 * gust + ocean * 0.054) + ripple * mix(0.018, 0.01, ocean)) * step(0.5, aMotion.y) * aLife;
transformed.y -= aMotion.z * (1.0 - smoothstep(0.17, 0.82, aLife));`,
    );
};
lifeMaterial.customProgramCacheKey = () => "wayshrine-life";

const GLOW = new THREE.Color(palette.glow);
const GLOW_STRENGTH = 0.55;

export interface Motion {
  /** Vertices sway more the higher they are above `baseY`, reaching full sway at `height`. */
  readonly sway?: { readonly baseY: number; readonly height: number };
  /** The triangles are a water surface. */
  readonly water?: "water" | "sea";
  /** Plants that grow above this height as the land wakes. */
  readonly bloomBase?: number;
}

/**
 * Accumulates flat-coloured triangles belonging to regions, then builds one
 * mesh. Each vertex remembers its alive and dead colour and its distance from
 * its shrine, so a region can be recoloured, with energy sweeping outward,
 * without rebuilding geometry.
 */
export class VitalityBuilder {
  private readonly positions: number[] = [];
  private readonly alive: number[] = [];
  private readonly dead: number[] = [];
  private readonly distance: number[] = [];
  private readonly motion: number[] = [];
  private readonly vertexRegion: number[] = [];
  private readonly regionList: string[] = [];
  private readonly regionIndex = new Map<string, number>();

  constructor(private readonly siteOf: (regionId: string) => Point) {}

  /** Adds non-indexed triangles: `positions` holds x,y,z per vertex, three vertices per triangle. */
  addTriangles(positions: ArrayLike<number>, color: THREE.Color, regionId: string, motion?: Motion): void {
    let region = this.regionIndex.get(regionId);
    if (region === undefined) {
      region = this.regionList.length;
      this.regionList.push(regionId);
      this.regionIndex.set(regionId, region);
    }
    const site = this.siteOf(regionId);
    const dc = deadOf(color);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!;
      const y = positions[i + 1]!;
      const z = positions[i + 2]!;
      this.positions.push(x, y, z);
      this.alive.push(color.r, color.g, color.b);
      this.dead.push(dc.r, dc.g, dc.b);
      this.distance.push(Math.hypot(x - site.x, z - site.z));
      const sway = motion?.sway ? Math.min(1, Math.max(0, (y - motion.sway.baseY) / motion.sway.height)) ** 1.5 : 0;
      const bloom = motion?.bloomBase === undefined ? 0 : Math.max(0, y - motion.bloomBase + 0.10);
      this.motion.push(sway, motion?.water === "sea" ? 2 : Number(motion?.water === "water"), bloom);
      this.vertexRegion.push(region);
    }
  }

  get isEmpty(): boolean {
    return this.positions.length === 0;
  }

  build(progressOf: (regionId: string) => number): VitalityMesh {
    const { alive, dead, distance, vertexRegion, regionList } = this;
    const count = vertexRegion.length;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    const colors = new Float32Array(alive);
    const colorAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", colorAttr);
    const life = new Float32Array(count);
    const lifeAttr = new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aLife", lifeAttr);
    geometry.setAttribute("aMotion", new THREE.Float32BufferAttribute(this.motion, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, lifeMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const applyVitality = (progressFor: (regionId: string) => number, only?: ReadonlySet<string>): void => {
      if (only && !regionList.some((id) => only.has(id))) return;
      const progress = regionList.map((id) => Math.min(1, Math.max(0, progressFor(id))));
      const skip = regionList.map((id) => (only ? !only.has(id) : false));
      for (let i = 0; i < count; i++) {
        const r = vertexRegion[i]!;
        if (skip[r]) continue;
        const p = progress[r]!;
        const d = distance[i]!;
        const t = lifeAt(p, d);
        const glow = frontGlow(p, d) * GLOW_STRENGTH;
        life[i] = t;
        const k = i * 3;
        colors[k] = Math.min(1, dead[k]! + (alive[k]! - dead[k]!) * t + GLOW.r * glow);
        colors[k + 1] = Math.min(1, dead[k + 1]! + (alive[k + 1]! - dead[k + 1]!) * t + GLOW.g * glow);
        colors[k + 2] = Math.min(1, dead[k + 2]! + (alive[k + 2]! - dead[k + 2]!) * t + GLOW.b * glow);
      }
      colorAttr.needsUpdate = true;
      lifeAttr.needsUpdate = true;
    };
    applyVitality(progressOf);

    return {
      object: mesh,
      regionIds: new Set(regionList),
      applyVitality,
      // The material is shared by every chunk, so only the geometry is freed here.
      dispose: () => geometry.dispose(),
    };
  }
}

/** Combines several meshes into one object that is recoloured and freed together. */
export function combine(parts: readonly VitalityMesh[]): VitalityMesh {
  const object = new THREE.Group();
  const ids = new Set<string>();
  for (const p of parts) {
    object.add(p.object);
    p.regionIds.forEach((id) => ids.add(id));
  }
  return {
    object,
    regionIds: ids,
    applyVitality: (v, only) => parts.forEach((p) => p.applyVitality(v, only)),
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}
