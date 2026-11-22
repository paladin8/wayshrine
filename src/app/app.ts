import {
  awakeningFrame,
  captionTarget,
  CAPTION_FADE,
  capabilitiesOf,
  clearOfObstacles,
  collectMonument,
  isCollected,
  deserialize,
  discoverNear,
  isLegible,
  isRestored,
  monumentInReach,
  movePlayer,
  newGame,
  nextShrine,
  requirementOf,
  resetGame,
  resetShrines,
  restoreShrine,
  revealLandmarks,
  unrestoreShrine,
  safePosition,
  skipTarget,
  timingOf,
  type AwakeningKind,
  serialize,
  shrineInReach,
  startPosition,
  type GameState,
  type SaveData,
} from "../game";
import { createCuePlayer, createMusic, trackFor, type CueId } from "../audio";
import { createStage } from "../render";
import { monumentSpecs } from "../content";
import { capabilitiesForCount, createObstacles, createTerrain, createWorld, planMonuments, standPoint, type Biome, type Obstacles, type Point, type World } from "../world";
import { createDebugPanel } from "./debug";
import { createHud } from "./hud";
import { messagesFor } from "./i18n";
import { createMinimap } from "./minimap";
import { createMonumentUi } from "./monuments-ui";
import { createNotebook } from "./notebook";
import { createSettingsStore } from "./settings";
import { createSettingsPanel } from "./settings-panel";

const HINT_SECONDS = 1.5;
const OVERVIEW_SECONDS = 3;
const OVERVIEW_FADE_SECONDS = 0.5;

function overviewZoomAt(elapsed: number): number {
  const t = Math.min(elapsed, OVERVIEW_SECONDS - elapsed, OVERVIEW_FADE_SECONDS) / OVERVIEW_FADE_SECONDS;
  return t * t * (3 - 2 * t);
}
/** Everything that plays for an awakening: the burst at the wave launch and the swell under the whole sequence. */
const AWAKENING_CUES: Readonly<Record<AwakeningKind, readonly CueId[]>> = {
  shrine: ["awakening-burst", "dawn-reverence"],
  landmark: ["awakening-burst", "radiant-arrival"],
};
const ALL_AWAKENING_CUES: readonly CueId[] = ["awakening-burst", "dawn-reverence", "radiant-arrival"];
/** How far the music drops while the awakening swell plays, and how long the swell takes to fade if skipped. */
const SWELL_DUCK = 0.04;
const SWELL_SKIP_FADE = 1.5;

const KEY_UP = ["KeyW", "ArrowUp"];
const KEY_DOWN = ["KeyS", "ArrowDown"];
const KEY_LEFT = ["KeyA", "ArrowLeft"];
const KEY_RIGHT = ["KeyD", "ArrowRight"];
const KEY_ACT = ["KeyE", "Space", "Enter"];
const KEY_MAP = "KeyM";
const KEY_OVERVIEW = "KeyZ";
const KEY_BOOK = "KeyB";
const KEY_JOURNAL = "KeyJ";
const KEY_MUTE = "KeyN";
/** Debug only. */
const KEY_UNRESTORE = "KeyU";
const KEY_RUBBING = "KeyR";

function loadGame(world: World): GameState {
  const { seed } = world;
  try {
    const raw = window.localStorage.getItem(`wayshrine:save:${seed}`);
    if (raw) return deserialize(JSON.parse(raw) as SaveData, world);
  } catch {
    // Unreadable or unavailable storage: start fresh.
  }
  return newGame(seed);
}

function saveGame(state: GameState): void {
  try {
    window.localStorage.setItem(`wayshrine:save:${state.seed}`, JSON.stringify(serialize(state)));
  } catch {
    // Saving is best-effort.
  }
}

/** Browser wiring: input, the game loop, the HUD and saving. */
export function startApp(container: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  // ?seed=anything selects the world; the same seed always builds the same world.
  const seed = params.get("seed") ?? "wayshrine";
  const world = createWorld(seed);
  const terrain = createTerrain(world);
  const debug = params.has("debug");
  const monuments = planMonuments(terrain, monumentSpecs);
  const sceneryObstacles = createObstacles(terrain, monuments);
  const stage = createStage(container, terrain, monuments);
  const obstacles: Obstacles = {
    near(x, z, reach) {
      const nearby = sceneryObstacles.near(x, z, reach);
      stage.appendObstaclesNear(x, z, reach, nearby);
      return nearby;
    },
  };
  const minimap = createMinimap(container, world, (right, up) => stage.groundDirection(right, up), (region) => {
    if (awakening) return;
    // Land on the shrine's plateau, within reach of its gate.
    pos = standPoint(region);
    minimap.toggleExpanded();
  }, () => {
    if (!awakening && overviewTime >= OVERVIEW_SECONDS) overviewTime = 0;
  });

  const hud = createHud(container);
  const music = createMusic();
  const cues = createCuePlayer();
  const settings = createSettingsStore(undefined, navigator.languages);
  const applyAudio = (s = settings.get()): void => {
    music.setVolume(s.musicVolume);
    music.setMuted(s.muted);
    cues.setVolume(s.sfxVolume);
    cues.setMuted(s.muted);
  };
  applyAudio();
  settings.subscribe(applyAudio);

  let state = loadGame(world);
  const monumentUi = createMonumentUi(container, hud.actions, {
    collected: () => state.collected,
    language: () => settings.get().language,
  });
  const panel = createSettingsPanel(container, hud.actions, settings);
  const notebook = createNotebook(container, hud.landmarkButton, {
    all: world.landmarks.map((region) => region.landmark!.id),
    restored: () => world.landmarks.filter((region) => isRestored(state, region)).map((region) => region.landmark!.id),
    debug,
    language: () => settings.get().language,
    sound: (cue) => cues.play(cue),
    onTravel: (id) => {
      const region = world.landmarks.find((r) => r.landmark?.id === id);
      if (!region || awakening) return;
      pos = standPoint(region);
    },
  });
  /** Dialogs own the keyboard while open. */
  const modalOpen = (): boolean => panel.isOpen() || monumentUi.isBookOpen() || notebook.isOpen();
  let drawnCollected = state.collected.length;
  let drawnLanguage = settings.get().language;
  let drawnLandmarks = -1;
  let pos: Point = startPosition(terrain);
  let facing = 0;
  /** The terrain the player just walked into without the means to cross it; shown briefly as a hint. */
  let blockedBy: Biome | null = null;
  let hintLeft = 0;
  let overviewTime = OVERVIEW_SECONDS;
  /** The restoration sequence in progress, if any; `t` is seconds since it began. */
  let awakening: {
    regionId: string;
    kind: AwakeningKind;
    t: number;
    /** Zoom at activation, so restoring during an overview continues from the current view. */
    initialZoom: number;
    /** How visible a landmark's name is, 0 to 1; eased so it fades and a skip does not pop it. */
    caption: number;
    /** Set when the sequence is skipped before the name appeared, so it is not shown late. */
    captionOff: boolean;
  } | null = null;
  /** Debug only: fixed sim step per frame (seconds), so slow renderers can step the sequence deterministically. */
  let fixedDt: number | null = null;

  const restore = (id: string): void => {
    const region = world.regionById(id);
    state = revealLandmarks(restoreShrine(state, region), world);
    saveGame(state);
  };

  const readMonument = (id: string): void => {
    const collected = collectMonument(state, id);
    if (collected !== state) {
      state = revealLandmarks(collected, world);
      saveGame(state);
    }
    monumentUi.read(id);
  };

  /** Debug: reads the first rubbing in the player's region that is not yet in the book. */
  const readRubbingHere = (): void => {
    const next = monuments.inRegion(world.regionAt(pos.x, pos.z).id).find((m) => !isCollected(state, m.id));
    if (next) readMonument(next.id);
  };

  /** Debug: un-restores the shrine or landmark within reach, else the one whose region the player is in. */
  const unrestoreHere = (): void => {
    const region = shrineInReach(terrain, pos) ?? world.regionAt(pos.x, pos.z);
    if (!isRestored(state, region)) return;
    if (awakening?.regionId === region.id) {
      awakening = null;
      ALL_AWAKENING_CUES.forEach((id) => cues.stop(id, 0.3));
    }
    state = revealLandmarks(unrestoreShrine(state, region), world);
    saveGame(state);
    // A lost ability may leave the player standing where they can no longer be.
    pos = safePosition(terrain, capabilitiesOf(state, world), pos);
  };

  if (params.has("debug")) {
    const restoreLandmarks = (): void => world.landmarks.forEach((r) => restore(r.id));
    const reset = (next: (s: GameState) => GameState): void => {
      state = revealLandmarks(next(state), world);
      overviewTime = OVERVIEW_SECONDS;
      saveGame(state);
    };
    const actions = {
      restoreLandmarks,
      unrestoreHere,
      resetShrines: () => {
        awakening = null;
        ALL_AWAKENING_CUES.forEach((id) => cues.stop(id, 0.3));
        reset(resetShrines);
        pos = startPosition(terrain); // land reached with lost capabilities may now be cut off
      },
      resetAll: () => {
        awakening = null;
        ALL_AWAKENING_CUES.forEach((id) => cues.stop(id, 0.3));
        reset(resetGame);
        pos = startPosition(terrain);
      },
      readRubbing: readRubbingHere,
      goToTarget: () => {
        const g = nextShrine(world, state, pos);
        if (g) pos = standPoint(g.region);
      },
    };
    createDebugPanel(container, actions);
    // Also available from the console: window.wayshrine.
    Object.assign(window, {
      wayshrine: { world, monuments, obstacles, getPos: () => pos, readMonument, music, cues, setFixedDt: (d: number | null) => (fixedDt = d), teleport: (x: number, z: number) => (pos = { x, z }), restore, ...actions },
    });
  }

  const fit = (): void => stage.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", fit);
  fit();

  // Escape closes the expanded map before it can open the settings.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape" || !minimap.isExpanded() || panel.isOpen()) return;
      e.stopImmediatePropagation();
      if (!e.repeat) minimap.toggleExpanded();
    },
    true,
  );

  const down = new Set<string>();
  const any = (codes: readonly string[]): number => (codes.some((c) => down.has(c)) ? 1 : 0);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    music.unlock(); // browsers allow audio only after a user gesture
    if (modalOpen()) {
      down.clear(); // a dialog owns the keyboard while it is open
      return;
    }
    down.add(e.code);
    if (e.code === KEY_MAP) minimap.toggleExpanded();
    if (e.code === KEY_OVERVIEW && !awakening && overviewTime >= OVERVIEW_SECONDS && !e.metaKey && !e.ctrlKey && !e.altKey) {
      overviewTime = 0;
    }
    if (e.code === KEY_BOOK && !awakening) monumentUi.toggleBook();
    if (e.code === KEY_JOURNAL && !awakening && !e.metaKey && !e.ctrlKey && !e.altKey) notebook.toggle();
    if (debug && e.code === KEY_UNRESTORE) unrestoreHere();
    if (debug && e.code === KEY_RUBBING) readRubbingHere();
    if (e.code === KEY_MUTE) settings.update({ muted: !settings.get().muted });
    if (KEY_ACT.includes(e.code)) {
      if (e.code !== "KeyE" && e.target instanceof HTMLButtonElement) return;
      if (monumentUi.dismissReading()) return;
      if (awakening) {
        // Once the camera has pulled back, the sequence can be skipped to its end.
        if (awakening.t > timingOf(awakening.kind).zoomOut) {
          awakening.t = skipTarget(awakening.t, awakening.kind);
          AWAKENING_CUES[awakening.kind].forEach((id) => cues.stop(id, SWELL_SKIP_FADE));
          if (awakening.caption < 0.05) awakening.captionOff = true;
        }
      } else {
        const region = shrineInReach(terrain, pos);
        if (region && !isRestored(state, region)) {
          restore(region.id);
          const kind: AwakeningKind = region.landmark ? "landmark" : "shrine";
          const initialZoom = overviewZoomAt(overviewTime);
          overviewTime = OVERVIEW_SECONDS;
          awakening = { regionId: region.id, kind, t: 0, initialZoom, caption: 0, captionOff: false };
          // Each swell is trimmed so its peak lands just before the wave finishes filling the region.
          AWAKENING_CUES[kind].forEach((id) => cues.play(id));
        } else {
          const stone = monumentInReach(monuments, pos);
          if (stone && isLegible(state, stone)) {
            readMonument(stone.id);
            cues.play("monument-read");
          }
        }
      }
    }
  });
  window.addEventListener("pointerdown", () => music.unlock());
  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());

  let lastRestored: GameState["restored"] | undefined;
  let restoredLandmarks: readonly string[] = [];
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = fixedDt ?? Math.min(0.05, (now - last) / 1000);
    last = now;
    stage.tick(dt);

    if (lastRestored !== state.restored) {
      lastRestored = state.restored;
      restoredLandmarks = world.landmarks.filter((region) => isRestored(state, region)).map((region) => region.landmark!.id);
    }
    const caps = capabilitiesForCount(restoredLandmarks.length);
    // Losing a capability (a reset, an old save) must never strand the player.
    pos = clearOfObstacles(terrain, caps, obstacles, safePosition(terrain, caps, pos));
    const seen = discoverNear(state, world, pos);
    if (seen !== state) {
      state = seen;
      saveGame(state);
    }
    const live = !modalOpen();
    const right = live ? any(KEY_RIGHT) - any(KEY_LEFT) : 0;
    const up = live ? any(KEY_UP) - any(KEY_DOWN) : 0;
    if (!awakening && (right !== 0 || up !== 0)) {
      monumentUi.dismissReading();
      const dir = stage.groundDirection(right, up);
      const moved = movePlayer(pos, dir, dt, terrain, caps, obstacles);
      pos = moved.pos;
      facing = Math.atan2(dir.x, dir.z);
      if (moved.blockedBy) {
        blockedBy = moved.blockedBy;
        hintLeft = HINT_SECONDS;
      }
    }
    hintLeft = Math.max(0, hintLeft - dt);
    if (hintLeft === 0) blockedBy = null;
    overviewTime = Math.min(OVERVIEW_SECONDS, overviewTime + dt);

    let scene: { regionId: string; progress: number; zoom: number } | undefined;
    if (awakening) {
      awakening.t += dt;
      const f = awakeningFrame(awakening.t, awakening.kind);
      if (f.done) awakening = null;
      else {
        const zoom = awakening.t < timingOf(awakening.kind).zoomOut
          ? awakening.initialZoom + (1 - awakening.initialZoom) * f.zoom
          : f.zoom;
        scene = { regionId: awakening.regionId, progress: f.progress, zoom };
      }
    }

    const prefs = settings.get();
    const t = messagesFor(prefs.language);

    // A landmark's name begins to appear as the wave finishes.
    let nameModel: { id: string; label: string; opacity: number; english: boolean } | null = null;
    if (awakening?.kind === "landmark") {
      const landmark = world.regionById(awakening.regionId).landmark!;
      const target = awakening.captionOff ? 0 : captionTarget(awakening.t, awakening.kind);
      const step = dt / CAPTION_FADE;
      awakening.caption += Math.max(-step, Math.min(step, target - awakening.caption));
      // Present from the start (invisible) so its images are loaded before they are needed.
      nameModel = { id: landmark.id, label: t.landmarkNames[landmark.id] ?? landmark.id, opacity: awakening.caption, english: prefs.language === "en" };
    }
    const needed = blockedBy ? requirementOf(blockedBy) : null;
    const hint = blockedBy && needed ? t.blocked(t.capability[needed], t.terrain[blockedBy]) : null;
    const reach = shrineInReach(terrain, pos);
    const stone = awakening ? null : monumentInReach(monuments, pos);
    const prompt = awakening
      ? awakening.t > timingOf(awakening.kind).zoomOut
        ? t.promptSkip
        : null
      : reach && !isRestored(state, reach)
        ? t.promptRestore
        : stone
          ? isLegible(state, stone)
            ? t.monuments.promptRead
            : t.monuments.promptWorn
          : null;
    if (state.collected.length !== drawnCollected || prefs.language !== drawnLanguage) {
      drawnCollected = state.collected.length;
      drawnLanguage = prefs.language;
      monumentUi.refresh();
      notebook.refresh();
    }
    if (restoredLandmarks.length !== drawnLandmarks) {
      drawnLandmarks = restoredLandmarks.length;
      notebook.refresh();
    }
    const guide = nextShrine(world, state, pos);
    let compass = null;
    if (guide) {
      const s = stage.screenDirection(guide.dx, guide.dz);
      compass = { angle: Math.atan2(s.right, s.up), distance: guide.distance, arrived: reach?.id === guide.region.id };
    }
    const reading = monumentUi.isReading();
    hud.update({
      capabilities: caps,
      restoredLandmarks,
      compass,
      prompt: reading ? null : prompt,
      hint: reading ? null : hint,
      landmarkName: nameModel,
      messages: t,
      showCompass: prefs.showCompass,
    });
    minimap.update({ pos, state, target: guide?.region ?? null, visible: prefs.showMinimap, labels: t.map, names: { terrain: t.terrain, capability: t.capability, needs: t.mapNeeds }, monuments: debug ? monuments.all : undefined, travelToAny: debug });

    music.setTrack(trackFor(world.regionAt(pos.x, pos.z).biome));
    cues.update(dt);
    // Only the awakening swell ducks the music; the monument chime sits under it at its normal level.
    music.setDuck(ALL_AWAKENING_CUES.some((id) => cues.playing().includes(id)) ? SWELL_DUCK : 1);
    music.update(dt);

    stage.render(dt, { player: pos, facing, state, overviewZoom: overviewZoomAt(overviewTime), awakening: scene });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
