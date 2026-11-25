import * as THREE from "three";
import { FRONT_WIDTH, lifeAt, SETTLE_FROM, WAVE_EXTENT, type RestorationWake } from "../game";
import type { Point } from "../world";
import { palette } from "./palette";

/** A drawable chunk of the world whose look follows region restoration. */
export interface VitalityMesh {
  readonly object: THREE.Object3D;
  readonly regionIds: ReadonlySet<string>;
  /**
   * Recolours from each region's restoration progress (0 dead, 1 alive, in
   * between a front sweeping out from the shrine or the traveller). With
   * `only`, regions outside the set are left as they are.
   */
  applyVitality(
    progressOf: (regionId: string) => number,
    only?: ReadonlySet<string>,
    wakeOf?: (regionId: string) => RestorationWake | undefined,
  ): void;
  dispose(): void;
}

/** A dead colour: the same hue drained of saturation and darkened. */
export function deadOf(c: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.12, hsl.l * 0.62);
}

// --- per-region life table ---------------------------------------------------

/**
 * How alive each region is lives in a small uniform table rather than in vertex colours, so a wave sweeping
 * across a region changes a few numbers per frame instead of recolouring and re-uploading every vertex.
 * Each loaded region owns a slot while any mesh uses it; vertices carry their slot (`aSlot`).
 */
const SLOTS = 64;
/** Per slot: progress, wave extent, 1 when a wake supplies the origin. */
const slotA = new Float32Array(SLOTS * 4);
/** Per slot: wake origin x, z. */
const slotB = new Float32Array(SLOTS * 4);
const slotOf = new Map<string, { slot: number; refs: number }>();
const freeSlots: number[] = Array.from({ length: SLOTS }, (_, i) => SLOTS - 1 - i);

function acquireSlot(id: string, initial: number): number {
  const held = slotOf.get(id);
  if (held) {
    held.refs++;
    return held.slot;
  }
  const slot = freeSlots.pop();
  if (slot === undefined) throw new Error("Too many regions are loaded at once for the vitality table.");
  slotOf.set(id, { slot, refs: 1 });
  setSlot(slot, initial, undefined);
  return slot;
}

function releaseSlot(id: string): void {
  const held = slotOf.get(id);
  if (!held || --held.refs > 0) return;
  slotOf.delete(id);
  freeSlots.push(held.slot);
}

function setSlot(slot: number, progress: number, wake: RestorationWake | undefined): void {
  const a = slot * 4;
  slotA[a] = progress;
  slotA[a + 1] = wake?.extent ?? WAVE_EXTENT;
  slotA[a + 2] = wake ? 1 : 0;
  slotB[a] = wake?.origin.x ?? 0;
  slotB[a + 1] = wake?.origin.z ?? 0;
}

/**
 * How alive vertex `i` of a mesh built here is right now: the shader's value, evaluated on the CPU
 * (for tests and tools).
 */
export function vertexLife(mesh: THREE.Mesh, i: number): number {
  const g = mesh.geometry;
  const a = (g.getAttribute("aSlot").getX(i)) * 4;
  const wake = slotA[a + 2]! > 0.5;
  const d = wake
    ? Math.hypot(g.getAttribute("position").getX(i) - slotB[a]!, g.getAttribute("position").getZ(i) - slotB[a + 1]!)
    : g.getAttribute("aDist").getX(i);
  return lifeAt(slotA[a]!, d, slotA[a + 1]!);
}

// --- shared material: wind sway for plants, ripples for water ---------------

export const lifeTimeUniform = { value: 0 };
const vitAUniform = { value: slotA };
const vitBUniform = { value: slotB };

/** Advances the clock used by the wind and water motion. */
export function setLifeTime(seconds: number): void {
  lifeTimeUniform.value = seconds;
}

/**
 * One material for all terrain and props. Per-vertex `aMotion.x` is how much a
 * vertex sways in the wind (0 for rocks and ground, up to 1 at treetops),
 * `aMotion.y` marks water surface, and the vertex's life (from its region's slot
 * in the table above) says how alive it is, so dead regions are perfectly still
 * and drained of colour.
 */
const lifeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const GLOW = new THREE.Color(palette.glow);
const GLOW_STRENGTH = 0.55;
lifeMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = lifeTimeUniform;
  shader.uniforms.uVitA = vitAUniform;
  shader.uniforms.uVitB = vitBUniform;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute vec3 aDead;
attribute float aDist;
attribute float aSlot;
attribute vec3 aMotion;
uniform float uTime;
uniform vec4 uVitA[${SLOTS}];
uniform vec4 uVitB[${SLOTS}];
float vitLife;
float vitSmooth(float t) { return t * t * (3.0 - 2.0 * t); }`,
    )
    .replace(
      "#include <color_vertex>",
      `#include <color_vertex>
{
  int vitSlot = int(aSlot + 0.5);
  vec4 vitA = uVitA[vitSlot];
  float vitD = vitA.z > 0.5 ? length(position.xz - uVitB[vitSlot].xy) : aDist;
  float vitT = clamp((vitA.x * (vitA.y + ${FRONT_WIDTH.toFixed(3)}) - vitD) / ${FRONT_WIDTH.toFixed(3)}, 0.0, 1.0);
  float vitSettle = vitSmooth(clamp((vitA.x - ${SETTLE_FROM.toFixed(4)}) / ${(1 - SETTLE_FROM).toFixed(4)}, 0.0, 1.0));
  bool vitMid = vitA.x > 0.0 && vitA.x < 1.0;
  vitLife = vitA.x <= 0.0 ? 0.0 : (vitA.x >= 1.0 ? 1.0 : max(vitSmooth(vitT), vitSettle));
  float vitGlow = vitMid ? 4.0 * vitT * (1.0 - vitT) : 0.0;
  vColor.rgb = clamp(mix(aDead, color, vitLife) + vec3(${GLOW.r.toFixed(5)}, ${GLOW.g.toFixed(5)}, ${GLOW.b.toFixed(5)}) * (vitGlow * ${GLOW_STRENGTH}), 0.0, 1.0);
}`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vec4 lifeWorld = modelMatrix * vec4(position, 1.0);
float lifePhase = lifeWorld.x * 0.31 + lifeWorld.z * 0.23;
float gust = pow(0.5 + 0.5 * sin(uTime * 0.72 + lifeWorld.x * 0.071 - lifeWorld.z * 0.095), 4.0);
float wind = sin(uTime * 1.7 + lifePhase) + 0.45 * sin(uTime * 2.9 - lifePhase * 1.7);
transformed.x += wind * (0.035 + 0.115 * gust) * aMotion.x * vitLife;
transformed.z += cos(uTime * 1.3 + lifePhase * 0.8) * (0.025 + 0.10 * gust) * aMotion.x * vitLife;
float ocean = step(1.5, aMotion.y);
float swell = sin(uTime * mix(1.6, 1.05, ocean) + lifeWorld.x * mix(0.51, 0.33, ocean) - lifeWorld.z * 0.36);
float ripple = cos(uTime * 2.65 + lifeWorld.z * 0.96 + lifeWorld.x * 0.29);
transformed.y += (swell * (0.022 + 0.037 * gust + ocean * 0.054) + ripple * mix(0.018, 0.01, ocean)) * step(0.5, aMotion.y) * vitLife;
transformed.y -= aMotion.z * (1.0 - smoothstep(0.17, 0.82, vitLife));`,
    );
};
lifeMaterial.customProgramCacheKey = () => "wayshrine-life-table";

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
  // Growable typed storage: building a chunk pushes tens of thousands of vertices, so plain arrays cost
  // more in boxing and collection than the geometry itself.
  private count = 0;
  private capacity = 0;
  private positions = new Float32Array(0);
  private alive = new Float32Array(0);
  private dead = new Float32Array(0);
  private distance = new Float32Array(0);
  private motion = new Float32Array(0);
  private vertexRegion = new Uint16Array(0);
  private readonly regionList: string[] = [];
  private readonly regionIndex = new Map<string, number>();
  private readonly sites = new Map<string, Point>();

  constructor(private readonly siteOf: (regionId: string) => Point) {}

  private reserve(extra: number): void {
    const need = this.count + extra;
    if (need <= this.capacity) return;
    let capacity = Math.max(256, this.capacity);
    while (capacity < need) capacity *= 2;
    const grow = <T extends Float32Array | Uint16Array>(from: T, per: number): T => {
      const next = new (from.constructor as new (n: number) => T)(capacity * per);
      next.set(from.subarray(0, this.count * per));
      return next;
    };
    this.positions = grow(this.positions, 3);
    this.alive = grow(this.alive, 3);
    this.dead = grow(this.dead, 3);
    this.distance = grow(this.distance, 1);
    this.motion = grow(this.motion, 3);
    this.vertexRegion = grow(this.vertexRegion, 1);
    this.capacity = capacity;
  }

  private regionOf(regionId: string): { region: number; site: Point } {
    let region = this.regionIndex.get(regionId);
    if (region === undefined) {
      region = this.regionList.length;
      this.regionList.push(regionId);
      this.regionIndex.set(regionId, region);
      this.sites.set(regionId, this.siteOf(regionId));
    }
    return { region, site: this.sites.get(regionId)! };
  }

  /** Adds non-indexed triangles: `positions` holds x,y,z per vertex, three vertices per triangle. */
  addTriangles(positions: ArrayLike<number>, color: THREE.Color, regionId: string, motion?: Motion): void {
    this.add(positions, null, color, regionId, motion);
  }

  /** Like addTriangles, but moves each vertex by `matrix` first, without building a transformed copy. */
  addTransformed(positions: ArrayLike<number>, matrix: THREE.Matrix4, color: THREE.Color, regionId: string, motion?: Motion): void {
    this.add(positions, matrix.elements, color, regionId, motion);
  }

  private add(positions: ArrayLike<number>, m: ArrayLike<number> | null, color: THREE.Color, regionId: string, motion?: Motion): void {
    const verts = Math.floor(positions.length / 3);
    if (verts === 0) return;
    this.reserve(verts);
    const { region, site } = this.regionOf(regionId);
    deadInto(color, scratchDead);
    const swayBase = motion?.sway?.baseY ?? 0;
    const swayHeight = motion?.sway?.height ?? 1;
    const hasSway = motion?.sway !== undefined;
    const bloomBase = motion?.bloomBase;
    const water = motion?.water === "sea" ? 2 : Number(motion?.water === "water");
    const { positions: P, alive: A, dead: D, distance: S, motion: M, vertexRegion: R } = this;
    let v = this.count;
    for (let i = 0; i < verts * 3; i += 3, v++) {
      let x = positions[i]!;
      let y = positions[i + 1]!;
      let z = positions[i + 2]!;
      if (m) {
        const tx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
        const ty = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
        const tz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
        x = tx; y = ty; z = tz;
      }
      const k = v * 3;
      P[k] = x; P[k + 1] = y; P[k + 2] = z;
      A[k] = color.r; A[k + 1] = color.g; A[k + 2] = color.b;
      D[k] = scratchDead.r; D[k + 1] = scratchDead.g; D[k + 2] = scratchDead.b;
      const dx = x - site.x;
      const dz = z - site.z;
      S[v] = Math.sqrt(dx * dx + dz * dz);
      M[k] = hasSway ? Math.min(1, Math.max(0, (y - swayBase) / swayHeight)) ** 1.5 : 0;
      M[k + 1] = water;
      M[k + 2] = bloomBase === undefined ? 0 : Math.max(0, y - bloomBase + 0.10);
      R[v] = region;
    }
    this.count = v;
  }

  get isEmpty(): boolean {
    return this.count === 0;
  }

  /** The accumulated triangles as plain typed arrays (transferable to another thread), or null when empty. */
  finish(castShadow = true): MeshData | null {
    const count = this.count;
    if (count === 0) return null;
    const positions = this.positions.slice(0, count * 3);
    return {
      positions,
      normals: flatNormals(positions),
      alive: this.alive.slice(0, count * 3),
      dead: this.dead.slice(0, count * 3),
      motion: this.motion.slice(0, count * 3),
      distance: this.distance.slice(0, count),
      vertexRegion: this.vertexRegion.slice(0, count),
      regions: [...this.regionList],
      castShadow,
    };
  }

  build(progressOf: (regionId: string) => number): VitalityMesh {
    return meshFromData(this.finish() ?? emptyData(), progressOf);
  }
}

/** Everything a chunk part needs to be drawn, as typed arrays: what a worker hands back. */
export interface MeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly alive: Float32Array;
  readonly dead: Float32Array;
  readonly motion: Float32Array;
  readonly distance: Float32Array;
  /** Per vertex, an index into `regions`. */
  readonly vertexRegion: Uint16Array;
  readonly regions: readonly string[];
  readonly castShadow: boolean;
}

/** The arrays of `data` to hand to postMessage as transferables. */
export function transferablesOf(data: MeshData): ArrayBuffer[] {
  return [data.positions, data.normals, data.alive, data.dead, data.motion, data.distance, data.vertexRegion].map((a) => a.buffer as ArrayBuffer);
}

function emptyData(): MeshData {
  return {
    positions: new Float32Array(0), normals: new Float32Array(0), alive: new Float32Array(0), dead: new Float32Array(0),
    motion: new Float32Array(0), distance: new Float32Array(0), vertexRegion: new Uint16Array(0), regions: [], castShadow: true,
  };
}

/** Turns built data into a drawable mesh whose life follows its regions' slots in the table. Takes ownership of the arrays. */
export function meshFromData(data: MeshData, progressOf: (regionId: string) => number): VitalityMesh {
  const { regions: regionList, vertexRegion } = data;
  const count = vertexRegion.length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(data.alive, 3));
  geometry.setAttribute("aDead", new THREE.BufferAttribute(data.dead, 3));
  geometry.setAttribute("aMotion", new THREE.BufferAttribute(data.motion, 3));
  geometry.setAttribute("aDist", new THREE.BufferAttribute(data.distance, 1));
  const slotFor = regionList.map((id) => acquireSlot(id, Math.min(1, Math.max(0, progressOf(id)))));
  const slots = new Uint8Array(count);
  for (let i = 0; i < count; i++) slots[i] = slotFor[vertexRegion[i]!]!;
  geometry.setAttribute("aSlot", new THREE.BufferAttribute(slots, 1));

  const mesh = new THREE.Mesh(geometry, lifeMaterial);
  mesh.castShadow = data.castShadow;
  mesh.receiveShadow = true;

  const applyVitality: VitalityMesh["applyVitality"] = (progressFor, only, wakeOf) => {
    regionList.forEach((id, r) => {
      if (only && !only.has(id)) return;
      setSlot(slotFor[r]!, Math.min(1, Math.max(0, progressFor(id))), wakeOf?.(id));
    });
  };

  return {
    object: mesh,
    regionIds: new Set(regionList),
    applyVitality,
    // The material is shared by every chunk, so only the geometry is freed here.
    dispose: () => {
      geometry.dispose();
      for (const id of regionList) releaseSlot(id);
    },
  };
}

const scratchDead = new THREE.Color();
const scratchHsl = { h: 0, s: 0, l: 0 };

/** deadOf without the allocation. */
function deadInto(c: THREE.Color, out: THREE.Color): void {
  c.getHSL(scratchHsl);
  out.setHSL(scratchHsl.h, scratchHsl.s * 0.12, scratchHsl.l * 0.62);
}

/** One face normal per triangle, repeated for its three vertices (the meshes are flat-shaded and non-indexed). */
function flatNormals(p: Float32Array): Float32Array {
  const n = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i + 3]! - p[i]!, ay = p[i + 4]! - p[i + 1]!, az = p[i + 5]! - p[i + 2]!;
    const bx = p[i + 6]! - p[i]!, by = p[i + 7]! - p[i + 1]!, bz = p[i + 8]! - p[i + 2]!;
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (let j = 0; j < 9; j += 3) { n[i + j] = nx; n[i + j + 1] = ny; n[i + j + 2] = nz; }
  }
  return n;
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
    applyVitality: (v, only, wakeOf) => parts.forEach((p) => p.applyVitality(v, only, wakeOf)),
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}
