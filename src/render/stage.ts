import * as THREE from "three";
import { vitality, type GameState } from "../game";
import { CHUNK_SIZE, type Point, type Terrain } from "../world";
import { buildChunk } from "./chunk-mesh";
import { disposeObject } from "./dispose";
import { palette } from "./palette";
import { buildPlayer } from "./player-mesh";
import { buildShrine, type ShrineMesh } from "./shrine-mesh";
import type { VitalityMesh } from "./vitality-mesh";

/** World units visible vertically. */
const VIEW_SIZE = 16;
/** Chunks kept loaded around the player: enough to cover the isometric view. */
const LOAD_RADIUS = 2;
const UNLOAD_RADIUS = LOAD_RADIUS + 1;
/** Regions (around the player's) whose shrines are shown. */
const SHRINE_RADIUS = 2;
const CHUNKS_PER_FRAME = 2;
/** Vitality change per second when a region is restored. */
const VITALITY_RATE = 0.5;

// Isometric view: the camera looks down the (1,1,1) diagonal. Screen-right and
// screen-up are therefore fixed ground directions.
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const FORWARD = new THREE.Vector3(-1, 0, -1).normalize();

export interface StageView {
  readonly player: Point;
  /** Heading in radians about the vertical axis. */
  readonly facing: number;
  readonly state: GameState;
}

/**
 * The renderer, isometric camera and streaming scene. Everything three.js
 * lives behind this interface.
 */
export interface Stage {
  /** Converts screen-space input (right, up) to a unit ground direction. */
  groundDirection(right: number, up: number): Point;
  /** The inverse: a ground-space offset as screen-space (right, up) components. */
  screenDirection(dx: number, dz: number): { right: number; up: number };
  resize(widthPixels: number, heightPixels: number): void;
  render(dtSeconds: number, view: StageView): void;
}

export function createStage(container: HTMLElement, terrain: Terrain): Stage {
  const world = terrain.world;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(80);
  let targetReady = false;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  scene.add(sun, sun.target);

  const player = buildPlayer();
  scene.add(player.group);

  const chunks = new Map<string, VitalityMesh>();
  const shrines = new Map<string, ShrineMesh>();
  /** Current (tweened) vitality per region. */
  const shown = new Map<string, number>();
  let clock = 0;
  let playerY = 1;

  const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;

  function streamChunks(playerPos: Point, state: GameState): void {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);
    const wanted: Array<{ cx: number; cz: number; d: number }> = [];
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        if (!chunks.has(chunkKey(pcx + dx, pcz + dz))) wanted.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    // The first frame builds everything so the screen is never empty; later frames are budgeted.
    const budget = chunks.size === 0 ? wanted.length : CHUNKS_PER_FRAME;
    for (const w of wanted.slice(0, budget)) {
      const built = buildChunk(terrain, w.cx, w.cz, (id) => shownVitality(id, state));
      chunks.set(chunkKey(w.cx, w.cz), built);
      scene.add(built.object);
    }
    for (const [key, chunk] of chunks) {
      const [cx, cz] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > UNLOAD_RADIUS) {
        scene.remove(chunk.object);
        chunk.dispose();
        chunks.delete(key);
      }
    }
  }

  function streamShrines(playerPos: Point, state: GameState): void {
    const here = world.regionAt(playerPos.x, playerPos.z).coord;
    const keep = new Set<string>();
    for (let dz = -SHRINE_RADIUS; dz <= SHRINE_RADIUS; dz++) {
      for (let dx = -SHRINE_RADIUS; dx <= SHRINE_RADIUS; dx++) {
        const region = world.region(here.rx + dx, here.rz + dz);
        keep.add(region.id);
        if (shrines.has(region.id)) continue;
        const shrine = buildShrine();
        const ground = terrain.tileAtPoint(region.site.x, region.site.z).height;
        shrine.group.position.set(region.site.x, ground, region.site.z);
        shrine.setVitality(shownVitality(region.id, state));
        shrines.set(region.id, shrine);
        scene.add(shrine.group);
      }
    }
    for (const [id, shrine] of shrines) {
      if (keep.has(id)) continue;
      scene.remove(shrine.group);
      disposeObject(shrine.group);
      shrines.delete(id);
    }
  }

  function targetVitality(id: string, state: GameState): number {
    return vitality(state, world.regionById(id));
  }

  /** Vitality to draw now; a region seen for the first time appears at its true value. */
  function shownVitality(id: string, state: GameState): number {
    let v = shown.get(id);
    if (v === undefined) {
      v = targetVitality(id, state);
      shown.set(id, v);
    }
    return v;
  }

  function tweenVitality(dt: number, state: GameState): void {
    let changed = false;
    for (const [id, v] of shown) {
      const goal = targetVitality(id, state);
      if (v === goal) continue;
      const step = VITALITY_RATE * dt;
      shown.set(id, v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step));
      changed = true;
    }
    if (!changed) return;
    const lookup = (id: string): number => shown.get(id) ?? 0;
    for (const chunk of chunks.values()) chunk.applyVitality(lookup);
    for (const [id, shrine] of shrines) shrine.setVitality(lookup(id));
  }

  return {
    groundDirection(right, up) {
      const v = new THREE.Vector3().addScaledVector(RIGHT, right).addScaledVector(FORWARD, up);
      return { x: v.x, z: v.z };
    },
    screenDirection(dx, dz) {
      return { right: dx * RIGHT.x + dz * RIGHT.z, up: dx * FORWARD.x + dz * FORWARD.z };
    },
    resize(widthPixels, heightPx) {
      const aspect = widthPixels / heightPx;
      renderer.setSize(widthPixels, heightPx);
      camera.left = (-VIEW_SIZE * aspect) / 2;
      camera.right = (VIEW_SIZE * aspect) / 2;
      camera.top = VIEW_SIZE / 2;
      camera.bottom = -VIEW_SIZE / 2;
      camera.updateProjectionMatrix();
    },
    render(dt, view) {
      clock += dt;
      const { player: pos, facing, state } = view;

      streamChunks(pos, state);
      streamShrines(pos, state);
      tweenVitality(dt, state);
      for (const shrine of shrines.values()) shrine.tick(clock);

      const tile = terrain.tileAtPoint(pos.x, pos.z);
      const onWater = tile.biome === "water";
      const groundY = tile.height + (onWater ? 0.05 + Math.sin(clock * 3) * 0.03 : 0);
      playerY += (groundY - playerY) * Math.min(1, dt * 14);
      player.group.position.set(pos.x, playerY, pos.z);
      player.group.rotation.y = facing;
      player.setBoat(onWater);

      if (!targetReady) {
        target.set(pos.x, 1, pos.z);
        targetReady = true;
      } else {
        const k = Math.min(1, dt * 6);
        target.x += (pos.x - target.x) * k;
        target.z += (pos.z - target.z) * k;
      }
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      sun.position.set(target.x - 10, 20, target.z + 8);
      sun.target.position.set(target.x, 0, target.z);
      sun.target.updateMatrixWorld();
      renderer.render(scene, camera);
    },
  };
}
