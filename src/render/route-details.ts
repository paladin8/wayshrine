import * as THREE from "three";
import { createRng } from "../core";
import { isWater, MONUMENT_CLEARING, plateauDistance, railwayClearance, type FujiRailway, type MonumentPlan, type Point, type Terrain } from "../world";
import { biomeArt } from "./biome-art";
import { Kind, ParticleLayer } from "./particles";

type RouteKind = "sea" | "volcanic" | "dunes";
interface RouteVisit extends Point {
  readonly kind: RouteKind;
  readonly y: number;
  readonly dx: number;
  readonly dz: number;
  readonly regionId: string;
  readonly duration: number;
  age: number;
}

const STEAM = new THREE.Color(0xc9bcb3);
const SAND = new THREE.Color(0xe9cf9f);
const INV_SQRT2 = Math.SQRT1_2;

/** A single passing detail in the middle distance, independent of persistent wildlife and weather. */
export function createRouteDetails(
  scene: THREE.Scene, terrain: Terrain, monuments: MonumentPlan, lifeAt: (x: number, z: number) => number, railway: FujiRailway | null,
) {
  const rng = createRng(terrain.world.seed).fork("route visits");
  const art = biomeArt(terrain);
  const birds = new THREE.Group();
  birds.name = "Passing coastal birds";
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0.15, 0.26, 0.04, 0.03, 0.13, 0, -0.14,
    0.26, 0.04, 0.03, 0.53, -0.025, -0.10, 0.13, 0, -0.14,
  ], 3));
  wing.setAttribute("color", new THREE.Float32BufferAttribute([
    0.86, 0.90, 0.91, 0.74, 0.80, 0.82, 0.86, 0.90, 0.91,
    0.74, 0.80, 0.82, 0.23, 0.30, 0.36, 0.86, 0.90, 0.91,
  ], 3));
  const birdMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const flock = Array.from({ length: 3 }, () => {
    const gull = new THREE.Group();
    const left = new THREE.Mesh(wing, birdMaterial);
    const right = new THREE.Mesh(wing, birdMaterial);
    left.scale.x = -1;
    gull.add(left, right);
    birds.add(gull);
    return { gull, left, right };
  });
  const dust = new ParticleLayer(16, false);
  dust.points.name = "Steam and drifting sand";
  scene.add(birds, dust.points);
  birds.visible = dust.points.visible = false;
  let visit: RouteVisit | null = null;
  let wait = rng.range(6, 12);
  let lastRegion = "";
  let revisit = 0;

  function clear(x: number, z: number, regionId: string): boolean {
    if (plateauDistance(terrain.world.regionById(regionId), x, z) < 4) return false;
    if (railway && railwayClearance(railway, x, z) < 6) return false;
    return monuments.near(x, z, MONUMENT_CLEARING + 2.5).length === 0;
  }

  function find(focus: Point, player: Point, halfWidth: number, halfHeight: number): RouteVisit | null {
    for (let i = 0; i < 10; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const distance = rng.range(4.4, 10);
      const x = focus.x + Math.cos(angle) * distance;
      const z = focus.z + Math.sin(angle) * distance;
      const tile = terrain.tileAtPoint(x, z);
      const kind = tile.biome;
      if (kind !== "sea" && kind !== "volcanic" && kind !== "dunes") continue;
      if (Math.abs((x - focus.x - z + focus.z) * INV_SQRT2) > halfWidth - 1.7) continue;
      if (Math.abs((x - focus.x + z - focus.z) / Math.sqrt(6)) > halfHeight - 2) continue;
      if (tile.skirt || (tile.regionId === lastRegion && revisit > 0)) continue;
      if (Math.hypot(x - player.x, z - player.z) < 4.5 || lifeAt(x, z) < 0.92) continue;
      if (!clear(x, z, tile.regionId)) continue;
      const region = terrain.world.regionById(tile.regionId);
      const profile = art.profile(region);
      if (kind === "sea" && !tile.shoal && ![[-5, 0], [5, 0], [0, -5], [0, 5]].some(([dx, dz]) =>
        !isWater(terrain.tileAtPoint(x + dx!, z + dz!).biome))) continue;
      if (kind === "volcanic" && art.ashSeam(x, z, region) < 0.7) continue;
      if (kind === "dunes" && (tile.height + 0.16 < terrain.tileAtPoint(x + 2, z).height ||
          tile.height + 0.16 < terrain.tileAtPoint(x - 2, z).height ||
          tile.height + 0.16 < terrain.tileAtPoint(x, z + 2).height ||
          tile.height + 0.16 < terrain.tileAtPoint(x, z - 2).height)) continue;
      const heading = kind === "sea" ? -Math.PI / 4 + rng.range(-0.28, 0.28) : profile.angle;
      const dx = Math.cos(heading), dz = Math.sin(heading);
      const span = kind === "sea" ? 4.8 : kind === "dunes" ? 3.7 : 1.4;
      if (![-1, -0.5, 0.5, 1].every(step => {
        const px = x + dx * span * step, pz = z + dz * span * step;
        const along = terrain.tileAtPoint(px, pz);
        return along.biome === kind && along.regionId === region.id && !along.skirt && clear(px, pz, region.id) && lifeAt(px, pz) >= 0.8;
      })) continue;
      return { kind, x, z, y: tile.height, dx, dz, regionId: region.id, age: 0,
        duration: kind === "sea" ? 4.2 : kind === "volcanic" ? 3.4 : 2.65 };
    }
    return null;
  }

  return (dt: number, focus: Point, player: Point, width: number, height: number, pixelScale: number, allowed: boolean): void => {
    if (!allowed) {
      visit = null;
      birds.visible = dust.points.visible = false;
      return;
    }
    wait -= dt;
    revisit -= dt;
    if (!visit && wait <= 0) {
      visit = find(focus, player, width / 2, height / 2);
      wait = visit ? rng.range(27, 48) : rng.range(2.5, 5);
      if (visit) {
        lastRegion = visit.regionId;
        revisit = 68;
      }
    }
    if (!visit) return;
    visit.age += dt;
    const t = visit.age / visit.duration;
    if (t >= 1 || Math.hypot(visit.x - focus.x, visit.z - focus.z) > 19 || lifeAt(visit.x, visit.z) < 0.8 ||
        Math.hypot(visit.x - player.x, visit.z - player.z) < 2.7) {
      visit = null;
      birds.visible = dust.points.visible = false;
      return;
    }

    const { x, y, z, dx, dz, kind, age } = visit;
    if (kind === "sea") {
      birds.visible = true;
      birdMaterial.opacity = 0.92 * Math.min(1, t * 7, (1 - t) * 6);
      for (const [i, { gull, left, right }] of flock.entries()) {
        const along = (t - 0.5) * 7.3 - i * 0.66 + 0.6;
        const side = i === 1 ? -0.53 : i * 0.28;
        gull.position.set(x + dx * along - dz * side, y + 2.45 + i * 0.19 + Math.sin(t * Math.PI) * 0.73, z + dz * along + dx * side);
        gull.rotation.y = Math.atan2(dx, dz);
        const flap = Math.sin(age * 8 + i * 0.9) * 0.55 * (0.25 + 0.75 * Math.max(0, Math.sin(t * Math.PI * 2)));
        left.rotation.z = flap;
        right.rotation.z = -flap;
      }
      return;
    }

    const steam = kind === "volcanic";
    const color = steam ? STEAM : SAND;
    dust.points.visible = true;
    for (const [i, p] of dust.particles.entries()) {
      const life = (t - i * (steam ? 0.036 : 0.026)) / (steam ? 0.45 : 0.57);
      p.active = life > 0 && life < 1;
      if (!p.active) continue;
      const along = steam ? life * life * 0.83 : life * 3.8 - 1.9;
      const side = Math.sin(i * 2.4) * (steam ? 0.14 + life * 0.37 : 0.83);
      p.x = x + dx * along - dz * side;
      p.z = z + dz * along + dx * side;
      p.y = steam ? y + 0.12 + life * 2.6 : terrain.groundAt(p.x, p.z) + 0.10 + Math.sin(life * Math.PI) * 0.19;
      p.age = life;
      p.maxAge = 1;
      p.kind = steam ? Kind.Mist : Kind.Spray;
      p.r = color.r; p.g = color.g; p.b = color.b;
      p.size = steam ? 31 + (i % 4) * 6 : 12 + (i % 3) * 6;
      p.alpha = steam ? 0.46 : 0.50;
    }
    dust.flush(pixelScale);
  };
}
