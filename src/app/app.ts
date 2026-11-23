import {
  awakeningFrame,
  BOAT_PUSH_OFF_SECONDS,
  boatLaunchFrame,
  blockerAt,
  captionTarget,
  CAPTION_FADE,
  capabilitiesOf,
  clearOfObstacles,
  collectMonument,
  isCollected,
  deserialize,
  discoverNear,
  isLegible,
  landmarksRestored,
  isRestored,
  monumentInReach,
  movePlayer,
  newGame,
  onWater,
  planBoatLaunch,
  recordBoatLaunch,
  recordClimbUse,
  recordGetaUse,
  recordSnowshoeUse,
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
  type BoatLaunch,
  serialize,
  shrineInReach,
  startPosition,
  type GameState,
  type SaveData,
} from "../game";
import { createCuePlayer, createMusic, MUSIC_SETS, musicSetFor, type CueId, type MusicSet, type TrackId } from "../audio";
import { createStage } from "../render";
import { monumentSpecs } from "../content";
import { CAPABILITY_THRESHOLDS, capabilitiesForCount, createObstacles, createTerrain, createWorld, planMonuments, standPoint, type Biome, type Capability, type Obstacles, type Point, type World } from "../world";
import { createDebugPanel } from "./debug";
import { createHud } from "./hud";
import { messagesFor, type Messages } from "./i18n";
import { createMinimap } from "./minimap";
import { createMonumentUi } from "./monuments-ui";
import { createNotebook } from "./notebook";
import { createSettingsStore } from "./settings";
import { createSettingsPanel } from "./settings-panel";

const HINT_SECONDS = 1.5;
/** The synthesised alternative to each supplied footstep loop (marsh only has the synthesised one). */
const SYNTH_STEP_CUES: Readonly<Partial<Record<CueId, CueId>>> = {
  "walk-meadow": "walk-meadow-synth",
  "walk-snow": "walk-snow-synth",
  "walk-mountain": "walk-mountain-synth",
};
const MOVEMENT_CUES: Readonly<Partial<Record<Biome, CueId>>> = {
  meadow: "walk-meadow",
  snow: "walk-snow",
  mountain: "walk-mountain",
  marsh: "walk-marsh",
  water: "row-water",
};
const MOVEMENT_FADE_IN = 0.65;
const MOVEMENT_FADE_OUT = 0.85;
type GearReveal = keyof Messages["gearReveal"];
const GEAR_REVEAL_SECONDS = 3;
const OVERVIEW_SECONDS = 3;
const OVERVIEW_FADE_SECONDS = 0.5;

function overviewZoomAt(elapsed: number): number {
  const t = Math.min(elapsed, OVERVIEW_SECONDS - elapsed, OVERVIEW_FADE_SECONDS) / OVERVIEW_FADE_SECONDS;
  return t * t * (3 - 2 * t);
}
const AWAKENING_BURST = "awakening-burst";
const AWAKENING_SWELLS: Readonly<Record<AwakeningKind, CueId>> = {
  shrine: "dawn-reverence",
  landmark: "radiant-arrival",
};
/** Shrine swell used instead of `dawn-reverence` while the snow theme is playing. */
const SNOW_SHRINE_SWELL: CueId = "winter-light-restored";
const ALL_AWAKENING_CUES = [AWAKENING_BURST, ...Object.values(AWAKENING_SWELLS), SNOW_SHRINE_SWELL, "haiku-bell"] as const;
/** How far the music drops while the awakening swell plays, and how long the swell takes to fade if skipped. */
const SWELL_DUCK = 0;
/** How slowly the background music comes back after a restoration swell has silenced it. */
const MUSIC_RETURN_SECONDS = 8;
const SWELL_SKIP_FADE = 1.5;
/** How long the player crouches to strap on snowshoes and steps off the first time. */
const SNOWSHOE_MOMENT_SECONDS = 4.6;
/** How long the player takes to slip into geta and step off the first time. */
const GETA_MOMENT_SECONDS = 4.2;
/** How long the walking sticks take to come off the pack and be planted the first time. */
const CLIMB_MOMENT_SECONDS = 5.2;
/** Length of the slow crossfade between background themes when gear is first used. */
const GEAR_FADE_SECONDS = 5;
const KEY_UP = ["KeyW", "ArrowUp"];
const KEY_DOWN = ["KeyS", "ArrowDown"];
const KEY_LEFT = ["KeyA", "ArrowLeft"];
const KEY_RIGHT = ["KeyD", "ArrowRight"];
const KEY_ACT = ["KeyE", "Space", "Enter"];
const KEY_MAP = "KeyM";
const KEY_OVERVIEW = "KeyZ";
const KEY_RUBBING_BOX = "KeyB";
/** How close (world units) the player must be to a restored landmark for its name to show again. */
const LANDMARK_NAME_RANGE = 16;
const KEY_JOURNAL = "KeyJ";
const KEY_MUTE = "KeyN";
/** Debug only. */
const KEY_UNRESTORE = "KeyU";
const KEY_RUBBING = "KeyR";
const KEY_NEXT_SHRINE = "KeyG";

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
  const cues = createCuePlayer();
  const stage = createStage(container, terrain, monuments, sceneryObstacles, {
    bell: () => cues.play("haiku-bell"),
    cicadas(audible) {
      if (audible) cues.play("haiku-cicadas", 1.1);
      else cues.stop("haiku-cicadas", 1.35);
    },
  });
  const obstacles: Obstacles = {
    near(x, z, reach) {
      const nearby = sceneryObstacles.near(x, z, reach);
      stage.appendObstaclesNear(x, z, reach, nearby);
      return nearby;
    },
  };
  const minimap = createMinimap(container, world, (right, up) => stage.groundDirection(right, up), (region) => {
    if (momentBusy()) return;
    // Land on the shrine's plateau, within reach of its gate.
    pos = standPoint(region);
    minimap.toggleExpanded();
  }, () => {
    if (!momentBusy() && overviewTime >= OVERVIEW_SECONDS) overviewTime = 0;
  });

  let debugPanel: ReturnType<typeof createDebugPanel> | undefined;
  if (debug) {
    // Let the debug dialog handle Escape before the map and other overlays.
    window.addEventListener("keydown", (event) => {
      if (event.code !== "Escape" || !debugPanel?.isOpen()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) debugPanel.close();
    }, true);
  }
  const hud = createHud(container);
  const music = createMusic({ duckReleaseSeconds: MUSIC_RETURN_SECONDS });
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
    sound: (cue) => cues.play(cue),
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
      if (!region || momentBusy()) return;
      pos = standPoint(region);
    },
  });
  /** Dialogs own the keyboard while open. */
  const modalOpen = (): boolean => panel.isOpen() || monumentUi.isBoxOpen() || notebook.isOpen() || debugPanel?.isOpen() === true;
  let drawnCollected = state.collected.length;
  let drawnLanguage = settings.get().language;
  let drawnLandmarks = -1;
  /** How visible the small name shown near a restored landmark is, 0 to 1. */
  let nearName = 0;
  /** The landmark whose name is shown (or fading out) near the player. */
  let nearNameId: string | null = null;
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
    returnZoom?: number;
    /** How visible a landmark's name is, 0 to 1; eased so it fades and a skip does not pop it. */
    caption: number;
    /** Set when the sequence is skipped before the name appeared, so it is not shown late. */
    captionOff: boolean;
    readonly unlocksGear: GearReveal | null;
    readonly backgroundTrack: TrackId;
  } | null = null;
  let gearReveal: { gear: GearReveal; left: number } | null = null;
  let boatVoyage: { readonly path: BoatLaunch; readonly preview: boolean; t: number } | null = null;
  // A debug voyage gives temporary water access, without writing that voyage to the save.
  let boatTrial = false;
  let snowshoeMusicPreview = false;
  let snowshoeMoment: { t: number } | null = null;
  let climbMoment: { t: number } | null = null;
  let climbMusicPreview = false;
  let getaMoment: { t: number } | null = null;
  let getaMusicPreview = false;
  /** True while a debug preview waits (negative time) for the previous theme to fade back before it starts. */
  const leadingIn = (): boolean => (boatVoyage?.t ?? 0) < 0 || (snowshoeMoment?.t ?? 0) < 0 || (climbMoment?.t ?? 0) < 0 || (getaMoment?.t ?? 0) < 0;
  const momentBusy = (): boolean => awakening !== null || gearReveal !== null || boatVoyage !== null || snowshoeMoment !== null || climbMoment !== null || getaMoment !== null;
  let debugMusicIndex = -1;
  const selectedMusicSet = (): MusicSet => {
    // Snowshoes come after the boat, so the moment starts on the sea theme and crosses over to the snow one.
    // Climbing comes after snowshoes, so its moment starts on the snow theme and crosses over to the ridge one.
    // Geta come after climbing, so their moment starts on the ridge theme and crosses over to the marsh one.
    const geta = getaMoment !== null;
    const climbing = climbMoment !== null || geta;
    const afterLaunch = boatVoyage ? boatVoyage.t >= BOAT_PUSH_OFF_SECONDS : state.boatLaunched || boatTrial || snowshoeMoment !== null || climbing;
    // A debug preview that is still waiting to start keeps the earlier theme.
    // A debug preview of an earlier gear ignores what the save has already unlocked later on.
    const earlierPreview = boatVoyage?.preview === true || snowshoeMoment !== null || snowshoeMusicPreview;
    const afterSnow = climbing || (snowshoeMoment && snowshoeMoment.t < 0 ? false
      : snowshoeMusicPreview || (!boatTrial && !(boatVoyage?.preview === true) && state.snowshoesUsed));
    const afterClimb = geta || (climbMoment && climbMoment.t < 0 ? false
      : climbMusicPreview || (!boatTrial && !earlierPreview && state.climbingUsed));
    const earlierThanGeta = earlierPreview || climbMoment !== null || climbMusicPreview;
    const afterGeta = getaMoment && getaMoment.t < 0 ? false
      : getaMusicPreview || (!boatTrial && !earlierThanGeta && state.getaUsed);
    return MUSIC_SETS[debugMusicIndex] ?? musicSetFor(afterLaunch, afterSnow, afterClimb, afterGeta);
  };

  const startVoyage = (path: BoatLaunch, preview = false): void => {
    // If this save is already on the later score, let the debug run fade back to theme one first.
    const playing = music.status().track;
    const lead = preview && debugMusicIndex < 0 && playing && playing !== musicSetFor(false, false).background ? -3.1 : 0;
    boatVoyage = { path, preview, t: lead };
    pos = path.from;
    facing = path.facing;
    overviewTime = OVERVIEW_SECONDS;
    snowshoeMusicPreview = false;
    climbMusicPreview = false;
    getaMusicPreview = false;
  };

  const stopGearMoments = (): void => {
    gearReveal = null;
    boatVoyage = null;
    snowshoeMoment = null;
    climbMoment = null;
    getaMoment = null;
    boatTrial = false;
    snowshoeMusicPreview = false;
    climbMusicPreview = false;
    getaMusicPreview = false;
  };
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
  /** Debug: moves the player to the next unrestored shrine. */
  const goToNextShrine = (): void => {
    if (momentBusy()) return;
    const g = nextShrine(world, state, pos);
    if (g) pos = standPoint(g.region);
  };
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

  const down = new Set<string>();
  if (debug) {
    const beginPreview = (): void => {
      awakening = null;
      ALL_AWAKENING_CUES.forEach((id) => cues.stop(id, 0.25));
      stopGearMoments();
      overviewTime = OVERVIEW_SECONDS;
      panel.close();
      notebook.close();
      if (monumentUi.isBoxOpen()) monumentUi.toggleBox();
      else monumentUi.dismissReading();
      if (minimap.isExpanded()) minimap.toggleExpanded();
      music.unlock();
    };
    const previewGearUnlock = (gear: GearReveal): void => {
      beginPreview();
      gearReveal = { gear, left: GEAR_REVEAL_SECONDS };
    };
    const previewFirstVoyage = (): void => {
      const caps = new Set<Capability>(["boat"]);
      // Trace out from a coastal landmark until a clear bank meets enough open water to push off.
      for (const region of world.landmarks) {
        if (region.biome !== "water") continue;
        for (let bearing = 0; bearing < 16; bearing++) {
          const angle = bearing * Math.PI / 8;
          const at = (r: number): Point => ({ x: region.site.x + Math.cos(angle) * r, z: region.site.z + Math.sin(angle) * r });
          for (let r = 4; r < 32; r += 0.35) {
            const from = at(r);
            const entry = at(r + 0.35);
            if (onWater(terrain, from) || !onWater(terrain, entry) || blockerAt(terrain, caps, from.x, from.z)) continue;
            const clear = clearOfObstacles(terrain, caps, obstacles, from);
            if (Math.hypot(clear.x - from.x, clear.z - from.z) > 0.01) continue;
            const path = planBoatLaunch(terrain, caps, obstacles, from, entry);
            if (Math.hypot(path.afloat.x - entry.x, path.afloat.z - entry.z) < 1.8) continue;
            beginPreview();
            boatTrial = true;
            startVoyage(path, true);
            return;
          }
        }
      }
    };

    const restoreLandmarks = (): void => world.landmarks.forEach((r) => restore(r.id));
    const reset = (next: (s: GameState) => GameState): void => {
      stopGearMoments();
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
      goToTarget: goToNextShrine,
      previewBoatUnlock: () => previewGearUnlock("boat"),
      previewSnowshoeUnlock: () => previewGearUnlock("snowshoes"),
      previewClimbUnlock: () => previewGearUnlock("climbing"),
      toggleFootsteps: () => {
        synthFootsteps = !synthFootsteps;
        return synthFootsteps ? "synth" : "supplied";
      },
      previewGetaUnlock: () => previewGearUnlock("geta"),
      previewClimbUse: () => {
        beginPreview();
        // If this save is already on the ridge theme, let the preview fade back to the snow theme first.
        const playing = music.status().track;
        const lead = debugMusicIndex < 0 && playing && playing !== MUSIC_SETS[2].background ? -3.1 : 0;
        climbMusicPreview = true;
        climbMoment = { t: lead };
      },
      previewGetaUse: () => {
        beginPreview();
        // If this save is already on the marsh theme, let the preview fade back to the ridge theme first.
        const playing = music.status().track;
        const lead = debugMusicIndex < 0 && playing && playing !== MUSIC_SETS[3].background ? -3.1 : 0;
        getaMusicPreview = true;
        getaMoment = { t: lead };
      },
      previewFirstVoyage,
      previewSnowshoeUse: () => {
        beginPreview();
        // If this save is already on the snow theme, let the preview fade back to the sea theme first.
        const playing = music.status().track;
        const lead = debugMusicIndex < 0 && playing && playing !== MUSIC_SETS[1].background ? -3.1 : 0;
        snowshoeMusicPreview = true;
        snowshoeMoment = { t: lead };
      },
      cycleMusic: () => {
        music.unlock();
        debugMusicIndex = debugMusicIndex + 1 < MUSIC_SETS.length ? debugMusicIndex + 1 : -1;
        return MUSIC_SETS[debugMusicIndex]?.label ?? "Auto";
      },
    };
    debugPanel = createDebugPanel(container, actions, () => down.clear());
    // Also available from the console: window.wayshrine.
    Object.assign(window, {
      wayshrine: { world, monuments, obstacles, getPos: () => pos, readMonument, music, cues, setFixedDt: (d: number | null) => (fixedDt = d), teleport: (x: number, z: number) => { stopGearMoments(); pos = { x, z }; }, restore, ...actions },
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

  const any = (codes: readonly string[]): number => (codes.some((c) => down.has(c)) ? 1 : 0);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    music.unlock(); // browsers allow audio only after a user gesture
    if (e.code === KEY_RUBBING_BOX && !momentBusy() && !e.metaKey && !e.ctrlKey && !e.altKey
        && (monumentUi.isBoxOpen() || !modalOpen())) {
      down.clear();
      monumentUi.toggleBox();
      return;
    }
    if (modalOpen()) {
      down.clear(); // a dialog owns the keyboard while it is open
      return;
    }
    down.add(e.code);
    if (e.code === KEY_MAP) minimap.toggleExpanded();
    if (e.code === KEY_OVERVIEW && !momentBusy() && overviewTime >= OVERVIEW_SECONDS && !e.metaKey && !e.ctrlKey && !e.altKey) {
      overviewTime = 0;
    }
    if (e.code === KEY_JOURNAL && !momentBusy() && !e.metaKey && !e.ctrlKey && !e.altKey) notebook.toggle();
    if (debug && e.code === KEY_UNRESTORE) unrestoreHere();
    if (debug && e.code === KEY_RUBBING) readRubbingHere();
    if (debug && e.code === KEY_NEXT_SHRINE && !e.metaKey && !e.ctrlKey && !e.altKey) goToNextShrine();
    if (e.code === KEY_MUTE) settings.update({ muted: !settings.get().muted });
    if (KEY_ACT.includes(e.code)) {
      if (e.code !== "KeyE" && e.target instanceof HTMLButtonElement) return;
      if (monumentUi.dismissReading()) return;
      if (awakening) {
        // Once the camera has pulled back, the sequence can be skipped to its end.
        if (awakening.t > timingOf(awakening.kind).zoomOut) {
          const target = skipTarget(awakening.t, awakening.kind);
          if (target > awakening.t) {
            awakening.returnZoom = awakeningFrame(awakening.t, awakening.kind, awakening).zoom;
            awakening.t = target;
          }
          cues.stop(AWAKENING_BURST, SWELL_SKIP_FADE);
          for (const id of ALL_AWAKENING_CUES) if (id !== AWAKENING_BURST) cues.stop(id, SWELL_SKIP_FADE);
          if (awakening.caption < 0.05) awakening.captionOff = true;
        }
      } else if (!momentBusy()) {
        const region = shrineInReach(terrain, pos);
        if (region && !isRestored(state, region)) {
          restore(region.id);
          const kind: AwakeningKind = region.landmark ? "landmark" : "shrine";
          const count = kind === "landmark" ? landmarksRestored(state, world) : 0;
          const unlocksGear = count === CAPABILITY_THRESHOLDS.boat ? "boat"
            : count === CAPABILITY_THRESHOLDS.snowshoes ? "snowshoes"
            : count === CAPABILITY_THRESHOLDS.climbing ? "climbing"
            : count === CAPABILITY_THRESHOLDS.geta ? "geta" : null;
          const initialZoom = overviewZoomAt(overviewTime);
          overviewTime = OVERVIEW_SECONDS;
          const backgroundTrack = selectedMusicSet().background;
          awakening = { regionId: region.id, kind, t: 0, initialZoom, caption: 0, captionOff: false, unlocksGear, backgroundTrack };
          // Each swell is trimmed so its peak lands just before the wave finishes filling the region.
          cues.play(AWAKENING_BURST);
          cues.play(kind === "shrine" && backgroundTrack === "snowline-walk" ? SNOW_SHRINE_SWELL : AWAKENING_SWELLS[kind]);
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
  /** Compare the synthesised footsteps with the supplied recordings (debug toggle). */
  let synthFootsteps = true;
  let movementCue: CueId | undefined;
  const releaseMovement = (): void => {
    down.clear();
    Object.values(MOVEMENT_CUES).forEach((id) => cues.stop(id));
    Object.values(SYNTH_STEP_CUES).forEach((id) => cues.stop(id));
    movementCue = undefined;
  };
  window.addEventListener("blur", releaseMovement);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseMovement();
  });

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
    if (boatTrial && !boatVoyage && !onWater(terrain, pos)) boatTrial = false;
    const sailingCaps = boatTrial ? new Set<Capability>([...caps, "boat"]) : caps;
    // Losing a capability (a reset, an old save) must never strand the player.
    if (!boatVoyage) pos = clearOfObstacles(terrain, sailingCaps, obstacles, safePosition(terrain, sailingCaps, pos));
    const seen = boatTrial ? state : discoverNear(state, world, pos);
    if (seen !== state) {
      state = seen;
      saveGame(state);
    }
    const live = !modalOpen();
    const right = live ? any(KEY_RIGHT) - any(KEY_LEFT) : 0;
    const up = live ? any(KEY_UP) - any(KEY_DOWN) : 0;
    let moving = false;
    if (!momentBusy() && (right !== 0 || up !== 0)) {
      monumentUi.dismissReading();
      const dir = stage.groundDirection(right, up);
      const from = pos;
      const moved = movePlayer(pos, dir, dt, terrain, sailingCaps, obstacles);
      moving = Math.hypot(from.x - moved.pos.x, from.z - moved.pos.z) > 0.001;
      pos = moved.pos;
      facing = Math.atan2(dir.x, dir.z);
      if (caps.has("boat") && !state.boatLaunched && !boatTrial && !onWater(terrain, from) && onWater(terrain, pos)) {
        startVoyage(planBoatLaunch(terrain, caps, obstacles, from, pos));
      } else if (moving && caps.has("snowshoes") && !state.snowshoesUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "snow") {
        state = recordSnowshoeUse(state);
        saveGame(state);
        snowshoeMoment = { t: 0 };
        facing = Math.atan2(dir.x, dir.z);
      } else if (moving && caps.has("geta") && !state.getaUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "marsh") {
        state = recordGetaUse(state);
        saveGame(state);
        getaMoment = { t: 0 };
        facing = Math.atan2(dir.x, dir.z);
      } else if (moving && caps.has("climbing") && !state.climbingUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "mountain") {
        state = recordClimbUse(state);
        saveGame(state);
        climbMoment = { t: 0 };
        facing = Math.atan2(dir.x, dir.z);
      }
      if (moved.blockedBy) {
        blockedBy = moved.blockedBy;
        hintLeft = HINT_SECONDS;
      }
    }
    hintLeft = Math.max(0, hintLeft - dt);
    if (hintLeft === 0) blockedBy = null;
    overviewTime = Math.min(OVERVIEW_SECONDS, overviewTime + dt);

    let voyageFrame: ReturnType<typeof boatLaunchFrame> | undefined;
    if (boatVoyage) {
      boatVoyage.t += dt;
      if (boatVoyage.t >= 0) {
        voyageFrame = boatLaunchFrame(boatVoyage.path, boatVoyage.t);
        pos = voyageFrame.rider;
        if (voyageFrame.done) {
          if (!boatVoyage.preview) {
            state = recordBoatLaunch(state);
            saveGame(state);
          }
          boatVoyage = null;
        }
      }
    }
    if (climbMoment) {
      climbMoment.t += dt;
      if (climbMoment.t >= CLIMB_MOMENT_SECONDS) climbMoment = null;
    }
    if (getaMoment) {
      getaMoment.t += dt;
      if (getaMoment.t >= GETA_MOMENT_SECONDS) getaMoment = null;
    }
    if (snowshoeMoment) {
      snowshoeMoment.t += dt;
      if (snowshoeMoment.t >= SNOWSHOE_MOMENT_SECONDS) snowshoeMoment = null;
    }
    if (gearReveal) {
      gearReveal.left -= dt;
      if (gearReveal.left <= 0) gearReveal = null;
    }

    let scene: { regionId: string; progress: number; zoom: number } | undefined;
    if (awakening) {
      awakening.t += dt;
      const f = awakeningFrame(awakening.t, awakening.kind, awakening);
      if (f.done) {
        if (awakening.unlocksGear) gearReveal = { gear: awakening.unlocksGear, left: GEAR_REVEAL_SECONDS };
        awakening = null;
      } else {
        scene = { regionId: awakening.regionId, progress: f.progress, zoom: f.zoom };
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
    // After restoration, the name returns, smaller and near the bottom, while the player is close to the landmark.
    const here = world.regionAt(pos.x, pos.z);
    const nearLandmark =
      !momentBusy() && here.landmark && isRestored(state, here) && Math.hypot(pos.x - here.site.x, pos.z - here.site.z) < LANDMARK_NAME_RANGE
        ? here.landmark.id
        : null;
    if (nearLandmark) nearNameId = nearLandmark;
    nearName += Math.max(-dt / CAPTION_FADE, Math.min(dt / CAPTION_FADE, (nearLandmark ? 1 : 0) - nearName));
    const nearModel = nearNameId && nearName > 0 ? { id: nearNameId, label: t.landmarkNames[nearNameId] ?? nearNameId, opacity: nearName, english: prefs.language === "en" } : null;
    const needed = blockedBy ? requirementOf(blockedBy) : null;
    const hint = blockedBy && needed ? t.blocked(t.capability[needed], t.terrain[blockedBy]) : null;
    const reach = shrineInReach(terrain, pos);
    const stone = momentBusy() ? null : monumentInReach(monuments, pos);
    const prompt = awakening
      ? awakening.t > timingOf(awakening.kind).zoomOut
        ? t.promptSkip
        : null
      : momentBusy()
        ? null
        : reach && !isRestored(state, reach)
        ? reach.landmark
          ? t.promptRestoreLandmark
          : t.promptRestore
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
      hint: reading || momentBusy() ? null : hint,
      gearReveal: gearReveal && { gear: gearReveal.gear, locale: prefs.language },
      landmarkName: nameModel,
      nearLandmarkName: nearModel,
      messages: t,
      showCompass: prefs.showCompass,
    });
    minimap.update({ pos, state, target: guide?.region ?? null, visible: prefs.showMinimap, labels: t.map, names: { landmark: (id) => t.landmarkNames[id] ?? id, terrain: t.terrain, capability: t.capability, needs: t.mapNeeds }, monuments: debug ? monuments.all : undefined, travelToAny: debug });

    // Keep the background steady through a restoration if debug selects another track.
    music.setTrack(awakening?.backgroundTrack ?? selectedMusicSet().background, !leadingIn() && (momentBusy() || snowshoeMusicPreview || climbMusicPreview) ? GEAR_FADE_SECONDS : undefined);
    const biomeCue = moving && !voyageFrame ? MOVEMENT_CUES[terrain.tileAtPoint(pos.x, pos.z).biome] : undefined;
    const nextMovementCue = biomeCue && synthFootsteps ? SYNTH_STEP_CUES[biomeCue] ?? biomeCue : biomeCue;
    if (nextMovementCue !== movementCue) {
      if (movementCue) cues.stop(movementCue, MOVEMENT_FADE_OUT);
      if (nextMovementCue) cues.play(nextMovementCue, MOVEMENT_FADE_IN);
      movementCue = nextMovementCue;
    }
    cues.update(dt);
    const audible = cues.playing();
    const swellDuck = ALL_AWAKENING_CUES.some((id) => audible.includes(id)) ? SWELL_DUCK : 1;
    music.setDuck(swellDuck);
    music.update(dt);

    stage.render(dt, {
      player: pos, facing, state, moving, drawing: climbMoment && climbMoment.t >= 0 ? climbMoment.t / CLIMB_MOMENT_SECONDS : undefined, strapping: snowshoeMoment && snowshoeMoment.t >= 0 ? snowshoeMoment.t / SNOWSHOE_MOMENT_SECONDS : getaMoment && getaMoment.t >= 0 ? getaMoment.t / GETA_MOMENT_SECONDS : undefined, strapGear: getaMoment ? "geta" : "snowshoes", character: settings.get().character, capabilities: caps, overviewZoom: overviewZoomAt(overviewTime), awakening: scene,
      voyage: voyageFrame,
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
