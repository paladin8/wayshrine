import * as THREE from "three";
import { frontRadius } from "../game";
import type { Point, Terrain } from "../world";
import { Kind, ParticleLayer, stepParticle, type Particle } from "./particles";
import { createWildlife } from "./wildlife";

const FIREFLIES = 110;
const PETALS = 80;
const SNOW = 170;
const ASH_PARTICLES = 28;
const SPARKS = 60;
const FRONT_SPARKS = 170;
/** Particles live within this distance of the camera, growing as the camera pulls back. */
const AREA_RADIUS = 26;
const SPAWN_TRIES_PER_FRAME = 10;

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const colour = (hex: number): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const FIREFLY = colour(0xe6f7a0);
const PETAL = colour(0xf6c4d0);
const SNOWFLAKE = colour(0xd9e6ef);
const GOLD = colour(0xffe08a);
const ASH = colour(0xc7a49c);

export interface AmbientView {
  /** Where the camera is looking. */
  readonly focus: Point;
  /** 0 normal, 1 fully pulled back. */
  readonly zoom: number;
  /** The region being awakened and its progress, if any. */
  readonly awakening: { readonly regionId: string; readonly progress: number } | null;
}

/**
 * Small living things that appear only where the land is alive: fireflies and
 * drifting petals over meadows, snow over snowfields, sparks rising from lit
 * shrines, and a spray of sparks along the front of a restoration wave.
 * Dead land stays empty.
 */
export interface Ambient {
  update(dt: number, view: AmbientView): void;
  dispose(): void;
}

export function createAmbient(
  scene: THREE.Scene,
  terrain: Terrain,
  /** How alive the ground is at a point, 0 to 1. */
  lifeAtPoint: (x: number, z: number) => number,
  /** Screen pixels per particle size unit. */
  pixelScale: () => number,
): Ambient {
  const glow = new ParticleLayer(FIREFLIES + SPARKS + FRONT_SPARKS, true);
  const soft = new ParticleLayer(PETALS + SNOW + ASH_PARTICLES, false);
  const wildlife = createWildlife(terrain, lifeAtPoint);
  scene.add(glow.points, soft.points, wildlife.root);
  const world = terrain.world;

  const spawn = (p: Particle, kind: Kind, x: number, z: number, y: number, ground: number): Particle => {
    p.active = true;
    p.kind = kind;
    p.age = 0;
    p.x = x;
    p.y = y;
    p.z = z;
    p.ground = ground;
    p.phase = rand(0, Math.PI * 2);
    return p;
  };
  const paint = (p: Particle, c: readonly [number, number, number], size: number, alpha: number): void => {
    [p.r, p.g, p.b] = c;
    p.size = size;
    p.alpha = alpha;
  };

  interface Rooms {
    readonly firefly: number;
    readonly petal: number;
    readonly snow: number;
    readonly ash: number;
  }

  /** Tries once to start an ambient particle at a random spot; the biome there decides what kind. */
  function spawnAmbient(focus: Point, radius: number, room: Rooms): void {
    const angle = rand(0, Math.PI * 2);
    const r = radius * Math.sqrt(Math.random());
    const x = focus.x + Math.cos(angle) * r;
    const z = focus.z + Math.sin(angle) * r;
    if (Math.random() >= lifeAtPoint(x, z)) return;
    const tile = terrain.tileAtPoint(x, z);
    if (tile.biome === "meadow" || tile.biome === "forest" || tile.biome === "marsh") {
      const wantFirefly = Math.random() < 0.55;
      if (wantFirefly && room.firefly >= 0) {
        const p = spawn(glow.particles[room.firefly]!, Kind.Firefly, x, z, tile.height + 0.9, tile.height);
        p.maxAge = rand(5, 9);
        paint(p, FIREFLY, rand(5, 8), 0.9);
      } else if (!wantFirefly && room.petal >= 0) {
        const p = spawn(soft.particles[room.petal]!, Kind.Petal, x, z, tile.height + rand(1.5, 3.2), tile.height);
        p.maxAge = 12;
        paint(p, PETAL, rand(4, 6), 0.9);
      }
    } else if (tile.biome === "snow" && room.snow >= 0) {
      const p = spawn(soft.particles[room.snow]!, Kind.Snow, x, z, tile.height + rand(3, 6), tile.height);
      p.maxAge = 12;
      paint(p, SNOWFLAKE, rand(3, 5), 0.95);
    } else if (tile.biome === "volcanic" && room.ash >= 0) {
      const p = spawn(soft.particles[room.ash]!, Kind.Ash, x, z, tile.height + 0.2, tile.height);
      p.vy = rand(0.23, 0.8);
      p.maxAge = rand(3, 6);
      paint(p, ASH, rand(7, 16), rand(0.35, 0.65));
    }
  }

  function spawnSparks(focus: Point, glowFreeSparks: number): void {
    // Rise from the orb of any lit shrine near the camera.
    const here = world.regionAt(focus.x, focus.z).coord;
    const lit = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const region = world.region(here.rx + dx, here.rz + dz);
        if (lifeAtPoint(region.shrine.x, region.shrine.z) > 0.3) lit.push(region);
      }
    }
    if (lit.length === 0 || glowFreeSparks < 0) return;
    const region = lit[Math.floor(Math.random() * lit.length)]!;
    const ground = terrain.tileAtPoint(region.shrine.x, region.shrine.z).height;
    const p = spawn(
      glow.particles[glowFreeSparks]!,
      Kind.Spark,
      region.shrine.x + rand(-0.6, 0.6),
      region.shrine.z + rand(-0.6, 0.6),
      ground + 1.3 + rand(0, 0.4),
      ground,
    );
    p.maxAge = rand(2, 3.6);
    p.vy = rand(0.5, 1.1);
    paint(p, GOLD, rand(4, 7), 0.9);
  }

  function spawnFront(awakening: NonNullable<AmbientView["awakening"]>, glowFreeFront: number): void {
    const radius = frontRadius(awakening.progress);
    if (radius === null || glowFreeFront < 0) return;
    const region = world.regionById(awakening.regionId);
    const angle = rand(0, Math.PI * 2);
    const x = region.shrine.x + Math.cos(angle) * radius;
    const z = region.shrine.z + Math.sin(angle) * radius;
    if (world.regionAt(x, z).id !== region.id) return;
    const ground = terrain.tileAtPoint(x, z).height;
    const p = spawn(glow.particles[glowFreeFront]!, Kind.Front, x, z, ground + 0.2, ground);
    p.maxAge = rand(1.2, 2.2);
    p.vy = rand(0.8, 1.8);
    paint(p, GOLD, rand(5, 9), 0.95);
  }

  const group = (layer: ParticleLayer, from: number, to: number): { free: () => number; active: () => number } => ({
    free: () => {
      for (let i = from; i < to; i++) if (!layer.particles[i]!.active) return i;
      return -1;
    },
    active: () => {
      let n = 0;
      for (let i = from; i < to; i++) if (layer.particles[i]!.active) n++;
      return n;
    },
  });
  const fireflies = group(glow, 0, FIREFLIES);
  const sparks = group(glow, FIREFLIES, FIREFLIES + SPARKS);
  const front = group(glow, FIREFLIES + SPARKS, FIREFLIES + SPARKS + FRONT_SPARKS);
  const petals = group(soft, 0, PETALS);
  const snow = group(soft, PETALS, PETALS + SNOW);
  const ash = group(soft, PETALS + SNOW, soft.particles.length);

  return {
    update(dt, view) {
      wildlife.update(dt, view.focus, view.zoom);
      const radius = AREA_RADIUS * (1 + view.zoom * 1.4);
      for (const layer of [glow, soft]) {
        for (const p of layer.particles) {
          if (!p.active) continue;
          const far = Math.hypot(p.x - view.focus.x, p.z - view.focus.z) > radius * 1.15;
          if (far || !stepParticle(p, dt)) p.active = false;
        }
      }

      // More of the pool is in use as the camera pulls back and the view covers more land.
      const share = 0.55 + 0.45 * view.zoom;
      for (let i = 0; i < SPAWN_TRIES_PER_FRAME; i++) {
        spawnAmbient(view.focus, radius, {
          firefly: fireflies.active() < FIREFLIES * share ? fireflies.free() : -1,
          petal: petals.active() < PETALS * share ? petals.free() : -1,
          snow: snow.active() < SNOW * share ? snow.free() : -1,
          ash: ash.free(),
        });
      }
      if (Math.random() < dt * 14 && sparks.active() < SPARKS) spawnSparks(view.focus, sparks.free());
      if (view.awakening) {
        for (let i = 0; i < 4; i++) spawnFront(view.awakening, front.free());
      }

      const scale = pixelScale() * (1 - 0.3 * view.zoom);
      glow.flush(scale);
      soft.flush(scale);
    },
    dispose() {
      scene.remove(glow.points, soft.points, wildlife.root);
      wildlife.dispose();
      glow.dispose();
      soft.dispose();
    },
  };
}
