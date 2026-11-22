import * as THREE from "three";

/** What a particle is, which decides how it moves. */
export const enum Kind {
  Firefly,
  Petal,
  Snow,
  Spark,
  Front,
  Ash,
  Mist,
  Spray,
}

const VERTEX = `
attribute vec4 aColor;
attribute float aSize;
uniform float uPixels;
varying vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixels;
}`;

const FRAGMENT = `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - d, 0.0, 1.0);
  gl_FragColor = vec4(vColor.rgb, vColor.a * a * a);
  #include <colorspace_fragment>
}`;

/** Per-particle state, read and written by the ambient system. */
export interface Particle {
  active: boolean;
  kind: Kind;
  age: number;
  maxAge: number;
  x: number;
  y: number;
  z: number;
  /** Ground height beneath, for particles that settle or hover relative to it. */
  ground: number;
  /** Random per-particle phase so motion is not in lockstep. */
  phase: number;
  vy: number;
  size: number;
  r: number;
  g: number;
  b: number;
  /** Peak opacity. */
  alpha: number;
}

/** A pool of soft round particles drawn as one `Points` object. */
export class ParticleLayer {
  readonly particles: Particle[];
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly uniforms = { uPixels: { value: 1 } };

  constructor(count: number, additive: boolean) {
    this.particles = Array.from({ length: count }, () => ({
      active: false, kind: Kind.Firefly, age: 0, maxAge: 1, x: 0, y: 0, z: 0, ground: 0,
      phase: 0, vy: 0, size: 0, r: 1, g: 1, b: 1, alpha: 1,
    }));
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 4);
    this.sizes = new Float32Array(count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  /** Index of an unused particle, or -1. */
  free(): number {
    return this.particles.findIndex((p) => !p.active);
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  /** Writes particle state to the GPU buffers. `pixelScale` converts particle size to screen pixels. */
  flush(pixelScale: number): void {
    this.uniforms.uPixels.value = pixelScale;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      if (!p.active) {
        this.sizes[i] = 0;
        continue;
      }
      const t = p.age / p.maxAge;
      // Fade in over the first part of its life and out over the last.
      let a = Math.min(1, t / 0.15, (1 - t) / 0.3) * p.alpha;
      if (p.kind === Kind.Firefly) a *= 0.65 + 0.35 * Math.sin(p.age * 3.1 + p.phase);
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.colors[i * 4] = p.r;
      this.colors[i * 4 + 1] = p.g;
      this.colors[i * 4 + 2] = p.b;
      this.colors[i * 4 + 3] = Math.max(0, a);
      this.sizes[i] = p.size * (p.kind === Kind.Mist ? 0.8 + t * 0.8 : 1);
    }
    const g = this.points.geometry;
    g.getAttribute("position").needsUpdate = true;
    g.getAttribute("aColor").needsUpdate = true;
    g.getAttribute("aSize").needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Advances one particle's motion by `dt` seconds. Returns false when it should end. */
export function stepParticle(p: Particle, dt: number): boolean {
  p.age += dt;
  if (p.age >= p.maxAge) return false;
  const breeze = 0.22 + 1.1 * Math.max(0, Math.sin(p.phase + p.age * 0.72)) ** 3;
  switch (p.kind) {
    case Kind.Firefly:
      p.x += Math.cos(p.phase + p.age * 0.7) * 0.4 * dt;
      p.z += Math.sin(p.phase * 1.3 + p.age * 0.6) * 0.4 * dt;
      p.y = p.ground + 0.9 + Math.sin(p.age * 1.1 + p.phase) * 0.35;
      break;
    case Kind.Petal:
      p.y -= 0.35 * dt;
      p.x += (Math.sin(p.age * 1.3 + p.phase) * 0.5 + breeze) * dt;
      p.z += Math.cos(p.age * 1.1 + p.phase) * 0.3 * dt;
      if (p.y <= p.ground + 0.05) return false;
      break;
    case Kind.Snow:
      p.y -= 0.9 * dt;
      p.x += (Math.sin(p.age * 0.9 + p.phase) * 0.25 + breeze * 0.38) * dt;
      p.z += Math.cos(p.age * 0.8 + p.phase) * 0.2 * dt;
      if (p.y <= p.ground + 0.05) return false;
      break;
    case Kind.Ash:
      p.y += p.vy * dt;
      p.x += (0.19 + breeze * 0.8) * dt;
      p.z -= (0.13 + Math.cos(p.age + p.phase) * 0.28) * dt;
      break;
    case Kind.Mist:
      p.x += (0.31 + Math.cos(p.phase) * 0.16) * dt;
      p.z += Math.sin(p.phase + p.age * 0.38) * 0.13 * dt;
      p.y += p.vy * dt;
      break;
    case Kind.Spray:
      p.x += Math.cos(p.phase) * 1.5 * dt;
      p.z += Math.sin(p.phase) * 1.5 * dt;
      p.y += p.vy * dt;
      p.vy -= 2.1 * dt;
      if (p.y < p.ground) return false;
      break;
    case Kind.Spark:
    case Kind.Front:
      p.y += p.vy * dt;
      p.x += Math.sin(p.age * 3 + p.phase) * 0.12 * dt;
      p.z += Math.cos(p.age * 2.6 + p.phase) * 0.12 * dt;
      break;
  }
  return true;
}
