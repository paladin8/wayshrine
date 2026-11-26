import { perfMark, perfInfo, perfGpuBegin, perfGpuEnd } from "./profile";
import * as THREE from "three";
import { lifeAt, railwayPowered, vitality, type GameState, type RestorationWake, type TrainFrame, type VoyageFrame } from "../game";
import { BIOME_REQUIRES, CHUNK_SIZE, hokoraOf, waveOriginOf, isWater, plateauBase, railwayClearance, type MonumentPlan, type Obstacle, type Obstacles, type Point, type Terrain, type Capability, type FujiRailway } from "../world";
import { createAmbient } from "./ambient";
import { buildFujiTrain } from "./fuji-train";
import { createFujiVista } from "./fuji-vista";
import { lightBiome } from "./biome-light";
import { createHaikuScenes, type HaikuSounds } from "./haiku-scenes";
import { createGinzanScenery } from "./ginzan-scenery";
import { createGlimmer } from "./glimmer";
import { createHirosakiScenery } from "./hirosaki-scenery";
import { buildChunk, meshChunk } from "./chunk-mesh";
import { disposeObject } from "./dispose";
import { palette } from "./palette";
import type { CharacterVariant, GearId, LanternLighting } from "./character";
import { createAshPuff } from "./ash-puff";
import { createFootprints } from "./footprints";
import { buildPlayer } from "./player-mesh";
import { SHIP_DECK_HEIGHT } from "./ship-mesh";
import { buildLandmark } from "./landmark-mesh";
import { biomeArt } from "./biome-art";
import { createLargeWildlife } from "./large-wildlife";
import { buildShrine, type ShrineMesh } from "./shrine-mesh";
import { setLifeTime, type VitalityMesh } from "./vitality-mesh";
import type { ChunkSource } from "./chunk-source";
import {
  browserTraits, createFrameGovernor, QUALITY_TIERS, renderQuality, startingPixelRatio,
  type QualityChoice, type QualityState, type RenderQuality,
} from "./quality";


/** World units visible vertically in normal play, and when pulled back to see a whole region. */
const VIEW_SIZE = 16;
const SHRINE_SHIMMER_SECONDS = 0.48;
const WIDE_VIEW_SIZE = 62;
/** Chunks kept loaded around the camera: enough to cover the view, more when pulled back. */
const LOAD_RADIUS = 2;
const EXTRA_LOAD_RADIUS = 3;
const CHUNKS_PER_FRAME = 2;
const CHUNKS_PER_FRAME_WIDE = 8;
/** With worker-built chunks: how many may be in flight at once (so the nearest are always asked for first), and how many are meshed per frame. */
const CHUNKS_IN_FLIGHT = 6;
const CHUNKS_MESHED_PER_FRAME = 3;
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

/** Fraction of the draw moment at which the walking sticks reach the hands. */
const DRAW_AT = 0.3;

/** Fraction of the strap-on moment at which the snowshoes appear on the feet. */
const STRAP_ON_AT = 0.4;
/** How fast the ship's heading follows the player's, in radians per second. */
const SHIP_TURN_RATE = 2.1;
/** Turns `current` toward `target` by at most `step`, the short way round. */
function turnToward(current: number, target: number, step: number): number {
  const delta = ((target - current + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return current + Math.min(step, Math.max(-step, delta));
}
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
  readonly voyage?: VoyageFrame;
  readonly train?: TrainFrame;
  readonly parkedTrain?: number;
  /** Starts the arrival effect on the traveller after shrine travel. */
  readonly shrineArrival?: boolean;
  /** Called once, after drawing the first frame of the arrival shimmer. */
  readonly onShrineShimmer?: () => void;
  readonly boardingHeight?: number;
  readonly moving?: boolean;
  /** While the traveller straps on snowshoes for the first time: progress through that moment, 0 to 1. */
  readonly strapping?: number;
  /** Which gear the strapping moment puts on (default snowshoes). */
  readonly strapGear?: GearId;
  /** While the walking sticks are first drawn on a mountain: progress through that moment, 0 to 1. */
  readonly drawing?: number;
  /** First lighting of the lantern, including how much the flame has caught. */
  readonly lighting?: LanternLighting;
  /** Which traveller body to show (default female). */
  readonly character?: CharacterVariant;
  /** Abilities held, so the traveller wears or carries the gear the ground underfoot calls for. */
  readonly capabilities?: ReadonlySet<Capability>;
  /** Passive waves centred on where the traveller entered each region. */
  readonly wakes?: ReadonlyMap<string, RestorationWake>;
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
  resize(widthPixels: number, heightPixels: number): void;
  /** Advances model poses before movement queries their collision. */
  tick(dtSeconds: number): void;
  appendObstaclesNear(x: number, z: number, reach: number, out: Obstacle[]): void;
  railwayReady(): boolean;
  /** Debug: the current rendering budget. */
  quality(): QualityState;
  /** Debug: force a quality tier, or "auto" to detect it and adapt to the frame rate again. */
  setQuality(choice: QualityChoice): void;
  render(dtSeconds: number, view: StageView): void;
}

export function createStage(
  container: HTMLElement,
  terrain: Terrain,
  monuments: MonumentPlan,
  obstacles: Obstacles,
  haikuSounds: HaikuSounds,
  railway: FujiRailway | null,
  /** Builds chunk geometry on worker threads when given; otherwise the stage builds chunks itself. */
  chunkSource: ChunkSource | null = null,
): Stage {
  const world = terrain.world;
  // Landmark models colour their natural ground from the region's terrain, so their footprint's edge doesn't show.
  const art = biomeArt(terrain);
  const groundPaint = (x: number, y: number, z: number): THREE.Color => {
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    const tile = terrain.tileAt(tx, tz);
    const region = world.regionById(tile.regionId);
    // An island in a water region keeps its lawn: the model draws its own beaches, so the terrain's low-shore sand
    // isn't applied to its grass.
    const height = isWater(region.biome) ? Math.max(y, 1.2) : y;
    return art.top(tx, tz, { ...tile, biome: isWater(tile.biome) ? "meadow" : tile.biome, height, shoal: 0 }, region);
  };
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const device = browserTraits();
  let qualityChoice: QualityChoice = "auto";
  let quality: RenderQuality = renderQuality(device);
  renderer.setPixelRatio(startingPixelRatio(quality, device));
  const autoGovernor = () =>
    createFrameGovernor(renderer.getPixelRatio(), quality.minPixelRatio, (ratio) => renderer.setPixelRatio(ratio));
  let governor: ReturnType<typeof createFrameGovernor> | null = autoGovernor();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const fujiVista = railway ? createFujiVista() : null;
  const railwayMesh = railway && buildFujiTrain(railway, terrain);
  if (railwayMesh) {
    railwayMesh.root.visible = false;
    scene.add(railwayMesh.root);
  }
  let railwayVitalityReady = false;
  let wasRiding = false;
  let wasAtWindow = false;
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
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  scene.add(sun, sun.target);

  const player = buildPlayer();
  scene.add(player.group, player.hull);
  const footprints = createFootprints();
  scene.add(footprints.root);
  const ashPuff = createAshPuff();
  scene.add(ashPuff.root);
  let ashPuffed = false;
  let shipYaw = 0;

  const chunks = new Map<string, VitalityMesh>();
  const shrines = new Map<string, ShrineMesh>();
  /** Restoration progress currently drawn per region. */
  const shown = new Map<string, number>();
  let state: GameState | null = null;
  let awakeningRegion: string | null = null;
  let awakeningProgress = 0;
  let wakes: StageView["wakes"];
  const wakeOf = (id: string) => wakes?.get(id);
  let clock = 0;
  let playerY = 1;
  let arrivalProgress = 1;

  const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;
  // Warm up the two station views for boarding and arrival. The window has its own scene.
  const stationChunks = new Map<string, { cx: number; cz: number }>();
  for (const { stand } of railway?.stations ?? []) {
    const cx = Math.floor(stand.x / CHUNK_SIZE);
    const cz = Math.floor(stand.z / CHUNK_SIZE);
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        stationChunks.set(chunkKey(cx + dx, cz + dz), { cx: cx + dx, cz: cz + dz });
      }
    }
  }

  function targetProgress(id: string): number {
    return vitality(state!, world.regionById(id));
  }

  /** Progress to draw now; a region seen for the first time appears at its true value. */
  function shownProgress(id: string): number {
    if (id === awakeningRegion) return awakeningProgress;
    const wake = wakeOf(id);
    if (wake) return wake.progress;
    let v = shown.get(id);
    if (v === undefined) {
      v = targetProgress(id);
      shown.set(id, v);
    }
    return v;
  }

  const pendingChunks = new Set<string>();

  function streamChunks(centre: Point, zoom: number, riding: boolean): void {
    const radius = LOAD_RADIUS + Math.ceil(zoom * EXTRA_LOAD_RADIUS);
    const pcx = Math.floor(centre.x / CHUNK_SIZE);
    const pcz = Math.floor(centre.z / CHUNK_SIZE);
    // Keep a margin so chunks are not rebuilt as the camera zooms in and out.
    const keep = Math.max(LOAD_RADIUS + EXTRA_LOAD_RADIUS + 1, radius + 1);
    const add = (key: string, built: VitalityMesh): void => {
      chunks.set(key, built);
      scene.add(built.object);
    };
    if (chunkSource) {
      // Chunks built on the workers arrive a few frames after they were asked for; wrapping them is cheap.
      for (const arrived of chunkSource.take(CHUNKS_MESHED_PER_FRAME)) {
        const key = chunkKey(arrived.cx, arrived.cz);
        pendingChunks.delete(key);
        const wanted = Math.max(Math.abs(arrived.cx - pcx), Math.abs(arrived.cz - pcz)) <= keep || (riding && stationChunks.has(key));
        if (wanted && !chunks.has(key)) add(key, meshChunk(terrain, arrived.data, shownProgress));
      }
    }
    const missing: Array<{ cx: number; cz: number; d: number }> = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = chunkKey(pcx + dx, pcz + dz);
        if (!chunks.has(key) && !pendingChunks.has(key)) missing.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz });
      }
    }
    missing.sort((a, b) => a.d - b.d);
    if (chunkSource && chunks.size > 0) {
      for (const w of missing) {
        if (chunkSource.outstanding() >= CHUNKS_IN_FLIGHT) break;
        pendingChunks.add(chunkKey(w.cx, w.cz));
        chunkSource.request(w.cx, w.cz);
      }
    } else {
      // The first frame builds everything so the screen is never empty; later frames are budgeted.
      const budget = chunks.size === 0 ? missing.length : zoom > 0 ? CHUNKS_PER_FRAME_WIDE : CHUNKS_PER_FRAME;
      for (const w of missing.slice(0, budget)) add(chunkKey(w.cx, w.cz), buildChunk(terrain, w.cx, w.cz, shownProgress, monuments));
    }
    if (riding) {
      let remaining = 5;
      for (const [key, { cx, cz }] of stationChunks) {
        if (chunks.has(key) || pendingChunks.has(key)) continue;
        if (chunkSource) {
          if (chunkSource.outstanding() >= CHUNKS_IN_FLIGHT) break;
          pendingChunks.add(key);
          chunkSource.request(cx, cz);
        } else {
          add(key, buildChunk(terrain, cx, cz, shownProgress, monuments));
          if (--remaining === 0) break;
        }
      }
    }
    for (const [key, chunk] of chunks) {
      if (riding && stationChunks.has(key)) continue;
      const [cx, cz] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > keep) {
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
        const hokora = hokoraOf(region);
        const shrine = region.landmark
          ? buildLandmark(region.landmark.id, groundPaint)
          : buildShrine(region.biome, hokora && { x: hokora.x - region.shrine.x, z: hokora.z - region.shrine.z });
        // A landmark model's origin sits at its plateau's base height; its own ground rises from there.
        const ground = region.landmark ? plateauBase(region) : terrain.tileAtPoint(region.shrine.x, region.shrine.z).height;
        shrine.group.position.set(region.shrine.x, ground, region.shrine.z);
        shrine.setVitality(shrineVitality(region));
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
    for (const [id, wake] of wakes ?? []) {
      if (id === awakeningRegion) continue;
      shown.set(id, wake.progress);
      // Newly streamed geometry needs the wake origin even when its progress has not changed.
      dirty.add(id);
    }
    for (const [id, v] of shown) {
      if (id === awakeningRegion || wakes?.has(id)) continue;
      const goal = targetProgress(id);
      if (v === goal) continue;
      const step = QUICK_RATE * dt;
      shown.set(id, v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step));
      dirty.add(id);
    }
    if (railwayMesh && !railwayVitalityReady) {
      for (const id of railwayMesh.scenery.regionIds) dirty.add(id);
      railwayVitalityReady = true;
    }
    if (dirty.size === 0) return;
    const originFor = wakes?.size ? wakeOf : undefined;
    railwayMesh?.scenery.applyVitality(shownProgress, dirty, originFor);
    for (const chunk of chunks.values()) chunk.applyVitality(shownProgress, dirty, originFor);
    for (const [id, shrine] of shrines) if (dirty.has(id)) shrine.setVitality(shrineVitality(world.regionById(id)));
  }

  function lifeAtPoint(x: number, z: number): number {
    const region = world.regionAt(x, z);
    const wake = wakeOf(region.id);
    const origin = wake?.origin ?? waveOriginOf(region);
    return lifeAt(shownProgress(region.id), Math.hypot(x - origin.x, z - origin.z), wake?.extent);
  }

  function shrineVitality(region: ReturnType<typeof world.regionById>): number {
    const wake = wakeOf(region.id);
    const at = waveOriginOf(region);
    return wake ? lifeAt(wake.progress, Math.hypot(at.x - wake.origin.x, at.z - wake.origin.z), wake.extent)
      : shownProgress(region.id);
  }

  const particlePixelScale = (): number =>
    renderer.getPixelRatio() * Math.min(1.6, Math.max(0.8, heightPixels / 720));
  const updateGinzan = createGinzanScenery(scene, terrain, shownProgress, lifeAtPoint);
  const updateHirosaki = createHirosakiScenery(scene, terrain, lifeAtPoint);
  const ambient = createAmbient(scene, terrain, lifeAtPoint, particlePixelScale);
  const sightings = createLargeWildlife(terrain, lifeAtPoint);
  const haiku = createHaikuScenes(terrain, monuments, obstacles, lifeAtPoint, haikuSounds);
  scene.add(sightings.root, haiku.root);

  const glimmer = createGlimmer(scene);

  function applyZoom(zoom: number, size: number): void {
    if (zoom === appliedZoom) return;
    appliedZoom = zoom;
    camera.left = (-size * aspect) / 2;
    camera.right = (size * aspect) / 2;
    camera.top = size / 2;
    camera.bottom = -size / 2;
    camera.updateProjectionMatrix();
    const half = SHADOW_NEAR + (SHADOW_WIDE - SHADOW_NEAR) * Math.max(0, zoom);
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
    sun.shadow.camera.updateProjectionMatrix();
  }

  return {
    groundDirection(right, up) {
      const v = new THREE.Vector3().addScaledVector(RIGHT, right).addScaledVector(FORWARD, up);
      return { x: v.x, z: v.z };
    },
    quality() {
      return { choice: qualityChoice, tier: quality.tier, pixelRatio: renderer.getPixelRatio(), shadowMapSize: quality.shadowMapSize };
    },
    setQuality(choice) {
      qualityChoice = choice;
      quality = choice === "auto" ? renderQuality(device) : QUALITY_TIERS[choice];
      renderer.setPixelRatio(startingPixelRatio(quality, device));
      if (sun.shadow.mapSize.x !== quality.shadowMapSize) {
        sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null; // rebuilt at the new size on the next render
      }
      governor = choice === "auto" ? autoGovernor() : null;
    },
    resize(w, h) {
      heightPixels = h;
      aspect = w / h;
      renderer.setSize(w, h);
      appliedZoom = -1;
      fujiVista?.resize(aspect);
    },
    tick(dt) {
      clock += dt;
      for (const shrine of shrines.values()) shrine.tick(clock);
      if (state && targetReady && !wasAtWindow) {
        // Solve player motion against the animal poses that this frame will draw.
        sightings.update(dt, target, Math.max(0, appliedZoom));
      }
    },
    appendObstaclesNear(x, z, reach, out) {
      for (const shrine of shrines.values()) shrine.appendObstaclesNear?.(x, z, reach, out);
      sightings.appendObstaclesNear(x, z, reach, out);
      for (const post of railwayMesh?.posts ?? []) {
        if (Math.hypot(post.x - x, post.z - z) <= reach + post.r) out.push(post);
      }
    },
    railwayReady() {
      if (!fujiVista?.ready()) return false;
      for (const key of stationChunks.keys()) if (!chunks.has(key)) return false;
      return true;
    },
    render(dt, view) {
      governor?.frame(performance.now());
      state = view.state;
      wakes = view.wakes;
      const awakening = view.awakening ?? null;
      awakeningRegion = awakening?.regionId ?? null;
      awakeningProgress = awakening?.progress ?? 0;
      const lighting = view.lighting;
      const closeUp = lighting ? smooth(lighting.progress / 0.28) * (1 - smooth((lighting.progress - 0.67) / 0.33)) : 0;
      const zoom = awakening?.zoom ?? (Math.max(view.overviewZoom ?? 0, view.voyage ? 0.07 * view.voyage.wake : 0) - 0.17 * closeUp);
      const viewSize = VIEW_SIZE + (WIDE_VIEW_SIZE - VIEW_SIZE) * zoom;
      const pos = view.player;
      const riding = view.train !== undefined;
      if (riding) fujiVista?.load();
      if (view.train?.windowView && fujiVista) {
        wasAtWindow = true;
        fujiVista.render(renderer, view.train, clock);
        return;
      }
      setLifeTime(clock);

      // The camera follows the player, or the shrine being restored.
      const focus = awakening ? world.regionById(awakening.regionId).shrine : pos;
      const elevation = terrain.groundAt(focus.x, focus.z) + 0.65 * closeUp;
      if (!targetReady || riding !== wasRiding || wasAtWindow) {
        target.set(focus.x, elevation, focus.z);
        targetReady = true;
      } else {
        const k = Math.min(1, dt * (awakening ? 3 : 6));
        target.x += (focus.x - target.x) * k;
        target.y += (elevation - target.y) * k;
        target.z += (focus.z - target.z) * k;
      }
      const centre = { x: target.x, z: target.z };

      wasRiding = riding;
      wasAtWindow = false;
      perfMark("setup");
      streamChunks(centre, zoom, riding);
      perfMark("streamChunks");
      streamShrines(centre);
      perfMark("streamShrines");
      updateProgress(dt);
      perfMark("updateProgress");
      const sceneryPixelScale = particlePixelScale() * (VIEW_SIZE / viewSize);
      updateGinzan(clock, sceneryPixelScale, centre);
      updateHirosaki(clock, sceneryPixelScale, centre);
      perfMark("scenery");
      if (railway && railwayMesh) {
        const visible = riding || railwayClearance(railway, centre.x, centre.z) < 85;
        railwayMesh.root.visible = visible;
        if (visible) {
          railwayMesh.update(view.train, view.parkedTrain ?? railway.stations[0].distance, railwayPowered(railway, view.state), shownProgress);
        }
      }
      perfMark("railway");
      haiku.update(dt, centre, pos, viewSize, awakening);
      perfMark("haiku");
      ambient.update(dt, {
        focus: centre,
        zoom,
        awakening: awakening ? { regionId: awakening.regionId, progress: awakening.progress } : null,
        wakes,
      });

      perfMark("ambient");
      // During the wide shot, let the restoration wave light the stones in that region.
      const candidates = awakening
        ? monuments.inRegion(awakening.regionId)
        : monuments.near(centre.x, centre.z, GLIMMER_RADIUS * (viewSize / VIEW_SIZE));
      const unread = candidates
        .filter((m) => view.state.restored.has(m.regionId) && !view.state.collected.includes(m.id))
        .map((monument) => ({ monument, life: lifeAtPoint(monument.x, monument.z) }))
        .filter(({ life }) => life > 0);
      glimmer.update(clock, particlePixelScale() * (VIEW_SIZE / viewSize), unread);

      perfMark("glimmer");
      const tile = terrain.tileAtPoint(pos.x, pos.z);
      lightBiome(sun, fill, tile.biome, dt);
      const voyage = view.voyage;
      // Lakes take the skiff and the open sea the ship, however the traveller came to be afloat.
      const vessel = voyage?.vessel ?? (tile.biome === "sea" ? "ship" : isWater(tile.biome) ? "boat" : null);
      const seated = vessel === "boat" ? voyage?.seated ?? 1 : 0;
      // How far aboard the ship the traveller is: on the quay 0, up the gangway, then standing on the deck.
      const aboard = vessel === "ship" ? voyage?.lift ?? 1 : 0;
      const bob = 0.045 + Math.sin(clock * 3) * 0.03;
      const groundY = view.boardingHeight ?? terrain.groundAt(pos.x, pos.z) + bob * (vessel === "ship" ? Math.min(1, aboard * 2) : seated);
      playerY += (groundY - playerY) * Math.min(1, dt * 14);
      player.group.position.set(pos.x, playerY, pos.z);
      player.group.rotation.y = view.facing;
      player.setPose(seated, vessel === "ship" ? aboard * SHIP_DECK_HEIGHT : voyage?.lift ?? 0);
      const needed = BIOME_REQUIRES[tile.biome];
      player.setCharacter(view.character ?? "female");
      if (view.shrineArrival) arrivalProgress = 0;
      // On a long trip, wait for the camera to catch up before revealing the traveller.
      const waitingForView = arrivalProgress === 0;
      if (arrivalProgress < 1 && (!waitingForView || Math.hypot(target.x - pos.x, target.z - pos.z) < viewSize * 0.36)) {
        arrivalProgress = Math.min(1, arrivalProgress + dt / SHRINE_SHIMMER_SECONDS);
      }
      player.setArrival(arrivalProgress);
      const strapping = view.strapping;
      let worn = seated < 0.5 && needed && view.capabilities?.has(needed) ? WORN_GEAR[needed] ?? null : null;
      if (strapping !== undefined) {
        // Crouch to tie them on, stand, then they are on.
        worn = strapping >= STRAP_ON_AT ? view.strapGear ?? "snowshoes" : null;
        const down = smooth(strapping / 0.22) * (1 - smooth((strapping - 0.62) / 0.22));
        player.setCrouch(down, Math.sin(strapping * 55));
      } else {
        player.setCrouch(0, 0);
      }
      const drawing = view.drawing;
      if (drawing !== undefined) {
        // The sticks come out of the pack a third of the way in, and are in the hands from then on.
        worn = drawing >= DRAW_AT ? "climbing" : null;
        player.setDraw(drawing);
      } else {
        player.setDraw(null);
      }
      if (worn === "lantern" && !view.state.lanternUsed) worn = null;
      if (lighting) worn = lighting.progress >= 0.10 ? "lantern" : null;
      if (worn === "snowshoes" && (tile.ginzanSurface === "stream" || tile.ginzanSurface === "bath")) worn = null;
      player.setGear(worn);
      player.setLanternLighting(lighting);
      // Aboard the ship the traveller only walks while boarding; under sail they stand at the helm.
      const walking = vessel === "ship" ? voyage?.walking ?? false : view.moving ?? false;
      for (const step of player.animate(dt, strapping === undefined && drawing === undefined && !lighting && walking)) {
        const stepTile = terrain.tileAtPoint(step.x, step.z);
        const surface = stepTile.biome;
        if (surface === "dunes" || (surface === "snow" && worn === "snowshoes" && !stepTile.ginzanSurface)) {
          footprints.add(step.x, terrain.groundAt(step.x, step.z), step.z, view.facing, surface === "dunes" ? "sand" : "snow");
        }
      }
      // Stepping off in ash sandals kicks up a puff of ash, once per strap-on moment.
      if (strapping === undefined) ashPuffed = false;
      else if (view.strapGear === "ashSandals" && strapping >= 0.82 && !ashPuffed) {
        ashPuffed = true;
        ashPuff.burst(pos.x, terrain.groundAt(pos.x, pos.z), pos.z);
      }
      ashPuff.update(dt);
      footprints.update(dt);

      const hull = voyage?.hull ?? pos;
      player.hull.position.set(hull.x, terrain.groundAt(hull.x, hull.z) + bob, hull.z);
      // The ship is slow to turn; during the launch it follows the launch's own heading.
      shipYaw = vessel === "ship" && !voyage ? turnToward(shipYaw, view.facing, SHIP_TURN_RATE * dt) : voyage?.yaw ?? view.facing;
      player.hull.rotation.y = vessel === "ship" ? shipYaw : voyage?.yaw ?? view.facing;
      const wake = voyage?.wake ?? Number(view.moving ?? false);
      player.setBoat(vessel === "boat", wake, clock);
      player.setShip(vessel === "ship", wake, clock, voyage?.gangway ?? 0);

      perfMark("player");
      applyZoom(zoom, viewSize);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      sun.position.set(target.x - 14, target.y + 27, target.z + 11);
      sun.target.position.set(target.x, target.y - 1, target.z);
      sun.target.updateMatrixWorld();
      perfMark("cameraSetup");
      const glc = renderer.getContext() as WebGL2RenderingContext;
      perfGpuBegin(glc);
      renderer.render(scene, camera);
      perfGpuEnd(glc);
      perfMark("renderer.render");
      perfInfo({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
      if (waitingForView && arrivalProgress > 0) view.onShrineShimmer?.();
    },
  };
}
