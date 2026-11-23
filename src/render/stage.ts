import * as THREE from "three";
import { lifeAt, vitality, type boatLaunchFrame, type GameState } from "../game";
import { BIOME_REQUIRES, CHUNK_SIZE, isWater, plateauBase, type MonumentPlan, type Obstacle, type Point, type Terrain, type Capability } from "../world";
import { createAmbient } from "./ambient";
import { lightBiome } from "./biome-light";
import { createGlimmer } from "./glimmer";
import { buildChunk } from "./chunk-mesh";
import { disposeObject } from "./dispose";
import { palette } from "./palette";
import type { CharacterVariant, GearId } from "./character";
import { createFootprints } from "./footprints";
import { buildPlayer } from "./player-mesh";
import { buildLandmark } from "./landmark-mesh";
import { createLargeWildlife } from "./large-wildlife";
import { buildShrine, type ShrineMesh } from "./shrine-mesh";
import { setLifeTime, type VitalityMesh } from "./vitality-mesh";

/** World units visible vertically in normal play, and when pulled back to see a whole region. */
const VIEW_SIZE = 16;
const WIDE_VIEW_SIZE = 62;
/** Chunks kept loaded around the camera: enough to cover the view, more when pulled back. */
const LOAD_RADIUS = 2;
const EXTRA_LOAD_RADIUS = 3;
const CHUNKS_PER_FRAME = 2;
const CHUNKS_PER_FRAME_WIDE = 8;
/** Regions (around the camera's) whose shrines are shown. */
const SHRINE_RADIUS = 2;
/** Progress change per second for regions that are restored or reset without the full sequence. */
const QUICK_RATE = 0.5;
/** Half-extent of the shadow map, in world units, in normal play and when pulled back. */
const SHADOW_NEAR = 22;
const SHADOW_WIDE = 62;
/** Monuments within this distance of the view centre are on screen or about to be. */
const GLIMMER_RADIUS = 17;

// Isometric view: the camera looks down the (1,1,1) diagonal. Screen-right and
// screen-up are therefore fixed ground directions.
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const FORWARD = new THREE.Vector3(-1, 0, -1).normalize();

/** Fraction of the strap-on moment at which the snowshoes appear on the feet. */
const STRAP_ON_AT = 0.4;
const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** The gear shown for each ability, worn on the biome that needs it. */
const WORN_GEAR: Readonly<Partial<Record<Capability, GearId>>> = {
  snowshoes: "snowshoes",
  geta: "geta",
  ashSandals: "ashSandals",
  lantern: "lantern",
  climbing: "climbing",
};

export interface StageView {
  readonly player: Point;
  /** Heading in radians about the vertical axis. */
  readonly facing: number;
  readonly state: GameState;
  readonly voyage?: ReturnType<typeof boatLaunchFrame>;
  readonly moving?: boolean;
  /** While the traveller straps on snowshoes for the first time: progress through that moment, 0 to 1. */
  readonly strapping?: number;
  /** Which traveller body to show (default female). */
  readonly character?: CharacterVariant;
  /** Abilities held, so the traveller wears or carries the gear the ground underfoot calls for. */
  readonly capabilities?: ReadonlySet<Capability>;
  /** Optional camera pull-back centred on the player, from 0 to 1. */
  readonly overviewZoom?: number;
  /**
   * Present while a shrine is being restored. The camera pulls back and centres
   * on the shrine, and the region's restoration is drawn at `progress` instead of
   * its saved state.
   */
  readonly awakening?: {
    readonly regionId: string;
    /** Restoration progress, 0 to 1. */
    readonly progress: number;
    /** Camera pull-back, 0 normal to 1 whole region. */
    readonly zoom: number;
  };
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
  /** Advances model poses before movement queries their collision. */
  tick(dtSeconds: number): void;
  appendObstaclesNear(x: number, z: number, reach: number, out: Obstacle[]): void;
  render(dtSeconds: number, view: StageView): void;
}

export function createStage(container: HTMLElement, terrain: Terrain, monuments: MonumentPlan): Stage {
  const world = terrain.world;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(120);
  let targetReady = false;
  let aspect = 16 / 9;
  let heightPixels = 720;
  let appliedZoom = -1;

  const fill = new THREE.HemisphereLight(0xffffff, 0xcfc4a8, 1.4);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.normalBias = 0.04; // stops shadow acne on large flat model surfaces
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  scene.add(sun, sun.target);

  const player = buildPlayer();
  scene.add(player.group, player.hull);
  const footprints = createFootprints();
  scene.add(footprints.root);

  const chunks = new Map<string, VitalityMesh>();
  const shrines = new Map<string, ShrineMesh>();
  /** Restoration progress currently drawn per region. */
  const shown = new Map<string, number>();
  let state: GameState | null = null;
  let awakeningRegion: string | null = null;
  let awakeningProgress = 0;
  let clock = 0;
  let playerY = 1;

  const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;

  function targetProgress(id: string): number {
    return vitality(state!, world.regionById(id));
  }

  /** Progress to draw now; a region seen for the first time appears at its true value. */
  function shownProgress(id: string): number {
    if (id === awakeningRegion) return awakeningProgress;
    let v = shown.get(id);
    if (v === undefined) {
      v = targetProgress(id);
      shown.set(id, v);
    }
    return v;
  }

  function streamChunks(centre: Point, zoom: number): void {
    const radius = LOAD_RADIUS + Math.ceil(zoom * EXTRA_LOAD_RADIUS);
    const pcx = Math.floor(centre.x / CHUNK_SIZE);
    const pcz = Math.floor(centre.z / CHUNK_SIZE);
    const wanted: Array<{ cx: number; cz: number; d: number }> = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!chunks.has(chunkKey(pcx + dx, pcz + dz))) wanted.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    // The first frame builds everything so the screen is never empty; later frames are budgeted.
    const budget = chunks.size === 0 ? wanted.length : zoom > 0 ? CHUNKS_PER_FRAME_WIDE : CHUNKS_PER_FRAME;
    for (const w of wanted.slice(0, budget)) {
      const built = buildChunk(terrain, w.cx, w.cz, shownProgress, monuments);
      chunks.set(chunkKey(w.cx, w.cz), built);
      scene.add(built.object);
    }
    // Keep a margin so chunks are not rebuilt as the camera zooms in and out.
    const keep = LOAD_RADIUS + EXTRA_LOAD_RADIUS + 1;
    for (const [key, chunk] of chunks) {
      const [cx, cz] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > Math.max(keep, radius + 1)) {
        scene.remove(chunk.object);
        chunk.dispose();
        chunks.delete(key);
      }
    }
  }

  function streamShrines(centre: Point): void {
    const here = world.regionAt(centre.x, centre.z).coord;
    const keep = new Set<string>();
    for (let dz = -SHRINE_RADIUS; dz <= SHRINE_RADIUS; dz++) {
      for (let dx = -SHRINE_RADIUS; dx <= SHRINE_RADIUS; dx++) {
        const region = world.region(here.rx + dx, here.rz + dz);
        keep.add(region.id);
        if (shrines.has(region.id)) continue;
        const shrine = region.landmark ? buildLandmark(region.landmark.id) : buildShrine(region.biome);
        // A landmark model's origin sits at its plateau's base height; its own ground rises from there.
        const ground = region.landmark ? plateauBase(region) : terrain.tileAtPoint(region.shrine.x, region.shrine.z).height;
        shrine.group.position.set(region.shrine.x, ground, region.shrine.z);
        shrine.setVitality(shownProgress(region.id));
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

  /** Moves drawn progress toward its target and recolours only what changed. */
  function updateProgress(dt: number): void {
    const dirty = new Set<string>();
    if (awakeningRegion !== null) {
      const before = shown.get(awakeningRegion);
      shown.set(awakeningRegion, awakeningProgress);
      if (before !== awakeningProgress) dirty.add(awakeningRegion);
    }
    for (const [id, v] of shown) {
      if (id === awakeningRegion) continue;
      const goal = targetProgress(id);
      if (v === goal) continue;
      const step = QUICK_RATE * dt;
      shown.set(id, v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step));
      dirty.add(id);
    }
    if (dirty.size === 0) return;
    for (const chunk of chunks.values()) chunk.applyVitality(shownProgress, dirty);
    for (const [id, shrine] of shrines) if (dirty.has(id)) shrine.setVitality(shownProgress(id));
  }

  function lifeAtPoint(x: number, z: number): number {
    const region = world.regionAt(x, z);
    return lifeAt(shownProgress(region.id), Math.hypot(x - region.shrine.x, z - region.shrine.z));
  }

  const particlePixelScale = (): number =>
    renderer.getPixelRatio() * Math.min(1.6, Math.max(0.8, heightPixels / 720));
  const ambient = createAmbient(scene, terrain, lifeAtPoint, particlePixelScale);
  const sightings = createLargeWildlife(terrain, lifeAtPoint);
  scene.add(sightings.root);

  const glimmer = createGlimmer(scene);

  function applyZoom(zoom: number, size: number): void {
    if (zoom === appliedZoom) return;
    appliedZoom = zoom;
    camera.left = (-size * aspect) / 2;
    camera.right = (size * aspect) / 2;
    camera.top = size / 2;
    camera.bottom = -size / 2;
    camera.updateProjectionMatrix();
    const half = SHADOW_NEAR + (SHADOW_WIDE - SHADOW_NEAR) * zoom;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
    sun.shadow.camera.updateProjectionMatrix();
  }

  return {
    groundDirection(right, up) {
      const v = new THREE.Vector3().addScaledVector(RIGHT, right).addScaledVector(FORWARD, up);
      return { x: v.x, z: v.z };
    },
    screenDirection(dx, dz) {
      return { right: dx * RIGHT.x + dz * RIGHT.z, up: dx * FORWARD.x + dz * FORWARD.z };
    },
    resize(w, h) {
      heightPixels = h;
      aspect = w / h;
      renderer.setSize(w, h);
      appliedZoom = -1;
    },
    tick(dt) {
      clock += dt;
      for (const shrine of shrines.values()) shrine.tick(clock);
      if (state && targetReady) {
        // Solve player motion against the animal poses that this frame will draw.
        sightings.update(dt, target, Math.max(0, appliedZoom));
      }
    },
    appendObstaclesNear(x, z, reach, out) {
      for (const shrine of shrines.values()) shrine.appendObstaclesNear?.(x, z, reach, out);
      sightings.appendObstaclesNear(x, z, reach, out);
    },
    render(dt, view) {
      state = view.state;
      const awakening = view.awakening ?? null;
      awakeningRegion = awakening?.regionId ?? null;
      awakeningProgress = awakening?.progress ?? 0;
      const zoom = awakening?.zoom ?? Math.max(view.overviewZoom ?? 0, view.voyage ? 0.07 * view.voyage.wake : 0);
      const viewSize = VIEW_SIZE + (WIDE_VIEW_SIZE - VIEW_SIZE) * zoom;
      const pos = view.player;
      setLifeTime(clock);

      // The camera follows the player, or the shrine being restored.
      const focus = awakening ? world.regionById(awakening.regionId).shrine : pos;
      const elevation = terrain.groundAt(focus.x, focus.z);
      if (!targetReady) {
        target.set(focus.x, elevation, focus.z);
        targetReady = true;
      } else {
        const k = Math.min(1, dt * (awakening ? 3 : 6));
        target.x += (focus.x - target.x) * k;
        target.y += (elevation - target.y) * k;
        target.z += (focus.z - target.z) * k;
      }
      const centre = { x: target.x, z: target.z };

      streamChunks(centre, zoom);
      streamShrines(centre);
      updateProgress(dt);
      ambient.update(dt, {
        focus: centre,
        zoom,
        awakening: awakening ? { regionId: awakening.regionId, progress: awakening.progress } : null,
      });

      // During the wide shot, let the restoration wave light the stones in that region.
      const candidates = awakening
        ? monuments.inRegion(awakening.regionId)
        : monuments.near(centre.x, centre.z, GLIMMER_RADIUS * (viewSize / VIEW_SIZE));
      const unread = candidates
        .filter((m) => view.state.restored.has(m.regionId) && !view.state.collected.includes(m.id))
        .map((monument) => ({ monument, life: lifeAtPoint(monument.x, monument.z) }))
        .filter(({ life }) => life > 0);
      glimmer.update(clock, particlePixelScale() * (VIEW_SIZE / viewSize), unread);

      const tile = terrain.tileAtPoint(pos.x, pos.z);
      lightBiome(sun, fill, tile.biome, dt);
      const onWater = isWater(tile.biome);
      const voyage = view.voyage;
      const seated = voyage?.seated ?? Number(onWater);
      const bob = 0.045 + Math.sin(clock * 3) * 0.03;
      const groundY = terrain.groundAt(pos.x, pos.z) + bob * seated;
      playerY += (groundY - playerY) * Math.min(1, dt * 14);
      player.group.position.set(pos.x, playerY, pos.z);
      player.group.rotation.y = view.facing;
      player.setPose(seated, voyage?.lift ?? 0);
      const needed = BIOME_REQUIRES[tile.biome];
      player.setCharacter(view.character ?? "female");
      const strapping = view.strapping;
      let worn = seated < 0.5 && needed && view.capabilities?.has(needed) ? WORN_GEAR[needed] ?? null : null;
      if (strapping !== undefined) {
        // Crouch to tie them on, stand, then they are on.
        worn = strapping >= STRAP_ON_AT ? "snowshoes" : null;
        const down = smooth(strapping / 0.22) * (1 - smooth((strapping - 0.62) / 0.22));
        player.setCrouch(down, Math.sin(strapping * 55));
      } else {
        player.setCrouch(0, 0);
      }
      player.setGear(worn);
      for (const step of player.animate(dt, strapping === undefined && (view.moving ?? false))) {
        if (worn === "snowshoes") footprints.add(step.x, terrain.groundAt(step.x, step.z), step.z, view.facing);
      }
      footprints.update(dt);

      const hull = voyage?.hull ?? pos;
      player.hull.position.set(hull.x, terrain.groundAt(hull.x, hull.z) + bob, hull.z);
      player.hull.rotation.y = view.facing;
      player.setBoat(onWater || voyage !== undefined, voyage?.wake ?? Number(view.moving ?? false), clock);

      applyZoom(zoom, viewSize);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      sun.position.set(target.x - 14, target.y + 27, target.z + 11);
      sun.target.position.set(target.x, target.y - 1, target.z);
      sun.target.updateMatrixWorld();
      renderer.render(scene, camera);
    },
  };
}
