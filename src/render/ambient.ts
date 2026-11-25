import * as THREE from "three";
import { frontRadius, type RestorationWake } from "../game";
import { hokoraOf, waveOriginOf, type Point, type Terrain } from "../world";
import { biomeArt } from "./biome-art";
import { Kind, ParticleLayer, stepParticle, type Particle } from "./particles";
import { createWildlife } from "./wildlife";

const FIREFLIES = 110;
const PETALS = 80;
const SNOW = 170;
const WEATHER = 62;
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
const ASH = colour(0xc3a195);
const CINDER = colour(0xf8a35b);
const FOREST_SPORE = colour(0xc1cda4);
const MARSH_FIREFLY = colour(0xc8e3ae);
const MARSH_MIST = colour(0xb1c6ac);
const SEA_SPRAY = colour(0xcfdee5);

export interface AmbientView {
  /** Where the camera is looking. */
  readonly focus: Point;
  /** 0 normal, 1 fully pulled back. */
  readonly zoom: number;
  /** The region being awakened and its progress, if any. */
  readonly awakening: { readonly regionId: string; readonly progress: number } | null;
  readonly wakes?: ReadonlyMap<string, RestorationWake>;
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
  const soft = new ParticleLayer(PETALS + SNOW + WEATHER, false);
  const wildlife = createWildlife(terrain, lifeAtPoint);
  scene.add(glow.points, soft.points, wildlife.root);
  const world = terrain.world;
  const art = biomeArt(terrain);

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
    readonly weather: number;
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
      const inMarsh = tile.biome === "marsh";
      const inForest = tile.biome === "forest";
      if (inMarsh && room.weather >= 0 && Math.random() < 0.52 && art.wetland(x, z, world.regionById(tile.regionId)) > 0.56) {
        const mist = spawn(soft.particles[room.weather]!, Kind.Mist, x, z, tile.height + rand(0.07, 0.29), tile.height);
        mist.vy = rand(0.004, 0.032);
        mist.maxAge = rand(4, 8);
        paint(mist, MARSH_MIST, rand(48, 83), rand(0.24, 0.38));
      } else if (room.firefly >= 0 && Math.random() < (inForest ? 0.81 : inMarsh ? 0.73 : 0.43)) {
        const p = spawn(glow.particles[room.firefly]!, Kind.Firefly, x, z, tile.height + 0.9, tile.height);
        p.maxAge = rand(5, 9);
        paint(p, inForest ? FOREST_SPORE : inMarsh ? MARSH_FIREFLY : FIREFLY, rand(4, inForest ? 6 : 8), inForest ? 0.67 : 0.9);
      } else if (!inForest && !inMarsh && room.petal >= 0) {
        const p = spawn(soft.particles[room.petal]!, Kind.Petal, x, z, tile.height + rand(1.5, 3.2), tile.height);
        p.maxAge = 12;
        paint(p, PETAL, rand(4, 6), 0.9);
      }
    } else if (tile.biome === "snow" && room.snow >= 0) {
      const p = spawn(soft.particles[room.snow]!, Kind.Snow, x, z, tile.height + rand(3, 6), tile.height);
      p.maxAge = 12;
      paint(p, SNOWFLAKE, rand(3, 5), 0.95);
    } else if (tile.biome === "volcanic" && room.weather >= 0) {
      const region = world.regionById(tile.regionId);
      const seam = art.ashSeam(x, z, region);
      if (seam > 0.43) {
        const cinder = seam > 0.79 && Math.random() < 0.39;
        const p = spawn(soft.particles[room.weather]!, Kind.Ash, x, z, tile.height + 0.27, tile.height);
        p.vy = rand(0.20, cinder ? 0.75 : 0.53);
        p.maxAge = cinder ? rand(1.5, 4) : rand(3, 6);
        paint(p, cinder ? CINDER : ASH, cinder ? rand(3, 6) : rand(27, 48), cinder ? 0.78 : rand(0.25, 0.39));
      }
    } else if (tile.biome === "sea" && room.weather >= 0 && Math.random() < 0.25 && art.swell(x, z, world.regionById(tile.regionId)) > 0.80) {
      const spray = spawn(soft.particles[room.weather]!, Kind.Spray, x, z, tile.height + 0.14, tile.height);
      spray.vy = rand(0.44, 0.83);
      spray.maxAge = rand(0.52, 1.09);
      paint(spray, SEA_SPRAY, rand(3, 7), 0.83);
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
    // The orb hovers over an ordinary shrine's hokora, and at a landmark's site.
    const orb = hokoraOf(region) ?? region.shrine;
    const p = spawn(
      glow.particles[glowFreeSparks]!,
      Kind.Spark,
      orb.x + rand(-0.6, 0.6),
      orb.z + rand(-0.6, 0.6),
      ground + (region.landmark ? 1.3 : 1.8) + rand(0, 0.4),
      ground,
    );
    p.maxAge = rand(2, 3.6);
    p.vy = rand(0.5, 1.1);
    paint(p, GOLD, rand(4, 7), 0.9);
  }

  function spawnFront(regionId: string, progress: number, glowFreeFront: number, wake?: RestorationWake): void {
    const radius = frontRadius(progress, wake?.extent);
    if (radius === null || radius < 0 || glowFreeFront < 0) return;
    const origin = wake?.origin ?? waveOriginOf(world.regionById(regionId));
    const angle = rand(0, Math.PI * 2);
    const x = origin.x + Math.cos(angle) * radius;
    const z = origin.z + Math.sin(angle) * radius;
    if (world.regionAt(x, z).id !== regionId) return;
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
  const weather = group(soft, PETALS + SNOW, soft.particles.length);

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
          weather: weather.free(),
        });
      }
      if (Math.random() < dt * 14 && sparks.active() < SPARKS) spawnSparks(view.focus, sparks.free());
      if (view.awakening) {
        const { regionId, progress } = view.awakening;
        for (let i = 0; i < 4; i++) spawnFront(regionId, progress, front.free());
      }
      for (const [regionId, wake] of view.wakes ?? []) {
        for (let i = 0; i < 4; i++) spawnFront(regionId, wake.progress, front.free(), wake);
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
