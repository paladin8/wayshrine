import {
  awakeningFrame,
  BOAT_PUSH_OFF_SECONDS,
  boatLaunchFrame,
  shipLaunchFrame,
  SHIP_PUSH_OFF_SECONDS,
  blockerAt,
  captionTarget,
  CAPTION_FADE,
  capabilitiesOf,
  clearOfObstacles,
  collectMonument,
  createRestorationWake,
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
  otherStation,
  railwayPowered,
  stationInReach,
  trainFrame,
  TRAIN_BOARD_SECONDS,
  TRAIN_RUN_SECONDS,
  type StationIndex,
  type TrainFrame,
  planBoatLaunch,
  planShipLaunch,
  recordBoatLaunch,
  recordShipLaunch,
  recordClimbUse,
  recordAshSandalsUse,
  recordGetaUse,
  recordLanternUse,
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
  type ShipLaunch,
  type VoyageFrame,
  serialize,
  shrineInReach,
  startPosition,
  type GameState,
  type RestorationWake,
  type SaveData,
} from "../game";
import { createCuePlayer, createMusic, FINAL_MUSIC, MUSIC_SETS, musicSetFor, nextTheme, unlockedThemes, type CueId, type Music, type MusicSet, type TrackId } from "../audio";
import { createStage } from "../render";
import { monumentSpecs } from "../content";
import { CAPABILITY_THRESHOLDS, PILGRIMS_WAKE_STARS, capabilitiesForCount, createObstacles, createTerrain, createWorld, fujiRailway, ginzanStream, ginzanWarmth, planMonuments, railPoint, standPoint, type Biome, type Capability, type Obstacles, type Point, type Region, type World } from "../world";
import { createDebugPanel } from "./debug";
import { createHud } from "./hud";
import { messagesFor, type Messages } from "./i18n";
import { createJourneyCompletion } from "./journey-completion";
import { createMinimap } from "./minimap";
import { createMonumentUi } from "./monuments-ui";
import { createMusicButton } from "./music-button";
import { createNotebook } from "./notebook";
import { createRailwayView } from "./railway-view";
import { createSaveStore, type SaveSlot, type SaveStore } from "./saves";
import { createSettingsStore, type SettingsStore } from "./settings";
import { createTitleScreen } from "./title-screen";
import { createSettingsPanel } from "./settings-panel";

const HINT_SECONDS = 1.5;
const MOVEMENT_CUES: Readonly<Partial<Record<Biome, CueId>>> = {
  meadow: "walk-meadow",
  forest: "walk-meadow",
  snow: "walk-snow",
  mountain: "walk-mountain",
  marsh: "walk-marsh",
  volcanic: "walk-mountain",
  dunes: "walk-snow",
  water: "row-water",
  sea: "row-water",
};
const MOVEMENT_FADE_IN = 0.65;
const MOVEMENT_FADE_OUT = 0.85;
type GearReveal = keyof Messages["gearReveal"];
const GEAR_REVEAL_SECONDS = 3;
const PILGRIMS_WAKE_SECONDS = 6;
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
/** Alternate shrine swell shared by the Snowline, Marshwalk, and Lantern music sets. */
const WINTER_SHRINE_SWELL: CueId = "winter-light-restored";
const WINTER_SHRINE_FADE_IN = 2.4;
/** Volcanic shrines have their own swell; the winter and landmark ones did not suit the basalt theme. */
const VOLCANIC_SHRINE_SWELL: CueId = "basalt-restoration";
const ALL_AWAKENING_CUES = [AWAKENING_BURST, ...Object.values(AWAKENING_SWELLS), WINTER_SHRINE_SWELL, VOLCANIC_SHRINE_SWELL, "haiku-bell"] as const;
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
/** How long the player takes to bind on ash sandals and step off the first time. */
const ASH_MOMENT_SECONDS = 4.4;
const LANTERN_MOMENT_SECONDS = 4.6;
const LANTERN_IGNITION_AT = 0.32;
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

function loadGame(saves: SaveStore, slot: SaveSlot, world: World): GameState {
  try {
    const raw = saves.read(slot.id);
    if (raw) return deserialize(JSON.parse(raw) as SaveData, world);
  } catch {
    // Unreadable or unavailable storage: start fresh.
  }
  return newGame(world.seed);
}

/** How often the player's position is written to the save. */
const POSITION_SAVE_SECONDS = 1;

/**
 * Browser entry: the title screen, then the game. ?seed=anything skips the title and plays that world
 * (the same seed always builds the same world).
 */
export function startApp(container: HTMLElement): void {
  const settings = createSettingsStore(undefined, navigator.languages);
  const saves = createSaveStore(undefined, undefined, undefined, (seed, ids) => {
    const world = createWorld(seed);
    return ids.filter((id) => world.regionById(id).landmark).length;
  });
  const seed = new URLSearchParams(window.location.search).get("seed");
  if (seed !== null) {
    startGame(container, saves.forSeed(seed), settings, saves, createMusic({ duckReleaseSeconds: MUSIC_RETURN_SECONDS }));
    return;
  }
  const music = createMusic({ duckReleaseSeconds: MUSIC_RETURN_SECONDS });
  const title = createTitleScreen(container, { saves, settings, music });
  void title.chosen.then((slot) => {
    title.destroy();
    startGame(container, slot, settings, saves, music);
  });
}

/** Browser wiring: input, the game loop, the HUD and saving. */
function startGame(container: HTMLElement, slot: SaveSlot, settings: SettingsStore, saves: SaveStore, music: Music): void {
  const params = new URLSearchParams(window.location.search);
  const world = createWorld(slot.seed);
  const terrain = createTerrain(world);
  const railway = fujiRailway(world);
  const ginzan = ginzanStream(world);
  const debug = params.has("debug");
  const monuments = planMonuments(terrain, monumentSpecs);
  const sceneryObstacles = createObstacles(terrain, monuments);
  const cues = createCuePlayer();
  const playShrineTravel = (): void => cues.play("shrine-travel");
  const stage = createStage(container, terrain, monuments, sceneryObstacles, {
    bell: () => cues.play("haiku-bell"),
    cicadas(audible) {
      if (audible) cues.play("haiku-cicadas", 1.1);
      else cues.stop("haiku-cicadas", 1.35);
    },
  }, railway);
  const obstacles: Obstacles = {
    near(x, z, reach) {
      const nearby = sceneryObstacles.near(x, z, reach);
      stage.appendObstaclesNear(x, z, reach, nearby);
      return nearby;
    },
  };
  const minimap = createMinimap(container, world, (right, up) => stage.groundDirection(right, up), (region) => {
    if (travelToShrine(standPoint(region))) minimap.toggleExpanded();
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
  const applyAudio = (s = settings.get()): void => {
    music.setVolume(s.musicVolume);
    music.setMuted(s.muted);
    cues.setVolume(s.sfxVolume);
    cues.setMuted(s.muted);
  };
  applyAudio();
  settings.subscribe(applyAudio);

  let state = loadGame(saves, slot, world);
  const monumentUi = createMonumentUi(container, hud.actions, {
    collected: () => state.collected,
    language: () => settings.get().language,
    sound: (cue) => cues.play(cue),
  });
  const musicButton = createMusicButton(hud.actions, () => cycleMusic());
  const panel = createSettingsPanel(container, hud.actions, settings, {
    onTitle: () => {
      saveGame(state);
      savePosition();
      window.location.href = window.location.pathname;
    },
  });
  const completion = createJourneyCompletion(container, stage.groundDirection);
  const notebook = createNotebook(container, hud.landmarkButton, {
    all: world.landmarks.map((region) => region.landmark!.id),
    restored: () => world.landmarks.filter((region) => isRestored(state, region)).map((region) => region.landmark!.id),
    debug,
    language: () => settings.get().language,
    sound: (cue) => cues.play(cue),
    onCompletion: () => {
      if (!pendingCompletion) showCompletion();
    },
    onTravel: (id) => {
      const region = world.landmarks.find((r) => r.landmark?.id === id);
      if (region) travelToShrine(standPoint(region));
    },
  });
  /** Dialogs own the keyboard while open. */
  const modalOpen = (): boolean => completion.isOpen() || panel.isOpen() || monumentUi.isBoxOpen() || notebook.isOpen() || debugPanel?.isOpen() === true;
  let drawnCollected = state.collected.length;
  let drawnLanguage = settings.get().language;
  let drawnLandmarks = -1;
  /** How visible the small name shown near a restored landmark is, 0 to 1. */
  let nearName = 0;
  /** The landmark whose name is shown (or fading out) near the player. */
  let nearNameId: string | null = null;
  const savedPosition = saves.readPosition(slot.id);
  let pos: Point = savedPosition ? safePosition(terrain, capabilitiesOf(state, world), savedPosition) : startPosition(terrain);
  let savedAt: Point = pos;
  let positionTimer = 0;
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
  let pendingCompletion: Region | null = null;
  const wakes = new Map<string, RestorationWake>();
  let finalMusicPending = false;
  let boatVoyage: { readonly path: BoatLaunch; readonly preview: boolean; t: number } | null = null;
  let shipVoyage: { readonly path: ShipLaunch; readonly preview: boolean; t: number } | null = null;
  let trainRide: {
    readonly from: StationIndex;
    readonly boardingFrom: Point;
    readonly preview: boolean;
    readonly visibleState: GameState;
    wait: number;
    t: number;
  } | null = null;
  let shrineArrival = false;
  let parkedTrain: StationIndex = 0;
  let trainLoadNotice = 0;
  // A debug voyage gives temporary water access, without writing that voyage to the save.
  let boatTrial = false;
  let shipTrial = false;
  let shipMusicPreview = false;
  let snowshoeMusicPreview = false;
  let snowshoeMoment: { t: number } | null = null;
  let climbMoment: { t: number } | null = null;
  let climbMusicPreview = false;
  let getaMoment: { t: number } | null = null;
  let getaMusicPreview = false;
  let lanternMoment: { t: number } | null = null;
  let lanternMusicPreview = false;
  let ashMoment: { t: number } | null = null;
  let ashMusicPreview = false;
  /** True while a debug preview waits (negative time) for the previous theme to fade back before it starts. */
  const leadingIn = (): boolean => (boatVoyage?.t ?? 0) < 0 || (shipVoyage?.t ?? 0) < 0 || (snowshoeMoment?.t ?? 0) < 0 || (climbMoment?.t ?? 0) < 0 || (getaMoment?.t ?? 0) < 0 || (lanternMoment?.t ?? 0) < 0 || (ashMoment?.t ?? 0) < 0;
  const momentBusy = (): boolean => trainRide !== null || awakening !== null
    || (gearReveal !== null && gearReveal.gear !== "pilgrimsWake") || boatVoyage !== null || shipVoyage !== null || snowshoeMoment !== null || climbMoment !== null || getaMoment !== null || lanternMoment !== null || ashMoment !== null;
  const gearMusicActive = (): boolean => boatVoyage !== null || shipVoyage !== null || snowshoeMoment !== null
    || climbMoment !== null || getaMoment !== null || lanternMoment !== null || ashMoment !== null
    || awakening?.unlocksGear === "pilgrimsWake" || gearReveal?.gear === "pilgrimsWake";
  let lastRestored: GameState["restored"] | undefined;
  let restoredLandmarks: readonly string[] = [];
  /** Themes are earned per world. A saved choice may belong to another seed. */
  const earnedMusicSets = (): readonly boolean[] => [
    true, state.boatLaunched, state.snowshoesUsed, state.climbingUsed, state.getaUsed,
    state.lanternUsed, state.ashSandalsUsed, state.shipLaunched, restoredLandmarks.length >= PILGRIMS_WAKE_STARS,
  ];
  const musicSetIndex = (set: MusicSet): number => MUSIC_SETS.findIndex((candidate) => candidate === set);
  const selectedMusicSet = (progression = progressionMusicSet()): MusicSet => {
    const track = settings.get().musicTrack;
    if (track === null || gearMusicActive()) return progression;
    const earned = earnedMusicSets();
    return MUSIC_SETS.find((set, i) => set.background === track && earned[i]) ?? progression;
  };
  /** Moves on to the next unlocked theme, and back to following progression after the newest one. */
  const cycleMusic = (): void => {
    music.unlock();
    if (momentBusy() || gearMusicActive() || finalMusicPending) return;
    const progression = progressionMusicSet();
    const playing = musicSetIndex(selectedMusicSet(progression));
    const next = MUSIC_SETS[nextTheme(unlockedThemes(earnedMusicSets(), playing), playing)] ?? progression;
    settings.update({ musicTrack: next === progression ? null : next.background });
  };
  const progressionMusicSet = (): MusicSet => {
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
    const afterGeta = lanternMusicPreview || (getaMoment && getaMoment.t < 0 ? false
      : getaMusicPreview || (!boatTrial && !earlierThanGeta && state.getaUsed));
    const earlierGearPreview = boatTrial || snowshoeMusicPreview || climbMusicPreview || getaMusicPreview;
    // Ash sandals come after the lantern, so their moment starts on the lantern theme and crosses over to the basalt one.
    const ash = ashMoment !== null;
    const afterLantern = ash || (lanternMoment
      ? lanternMoment.t >= LANTERN_MOMENT_SECONDS * LANTERN_IGNITION_AT
      : lanternMusicPreview || (!earlierGearPreview && state.lanternUsed));
    const earlierThanAsh = earlierGearPreview || lanternMusicPreview || lanternMoment !== null;
    // The ship comes after the ash sandals, so a previewed departure starts on the basalt theme and crosses over to the sea one.
    const sailing = shipVoyage?.preview === true || shipMusicPreview;
    const afterAsh = ashMoment && ashMoment.t < 0 ? false
      : ash || ashMusicPreview || sailing || (!earlierThanAsh && state.ashSandalsUsed);
    const earlierThanShip = earlierThanAsh || ashMoment !== null || ashMusicPreview;
    const afterShip = shipVoyage ? shipVoyage.t >= SHIP_PUSH_OFF_SECONDS
      : shipMusicPreview || (!earlierThanShip && state.shipLaunched);
    const previewingEarlierGear = boatTrial || shipTrial || snowshoeMusicPreview || climbMusicPreview || getaMusicPreview
      || lanternMusicPreview || ashMusicPreview || sailing;
    const afterPilgrimsWake = !previewingEarlierGear && restoredLandmarks.length >= PILGRIMS_WAKE_STARS;
    return musicSetFor(afterLaunch, afterSnow, afterClimb, afterGeta, afterLantern, afterAsh, afterShip, afterPilgrimsWake);
  };

  const startVoyage = (path: BoatLaunch, preview = false): void => {
    // If this save is already on the later score, let the debug run fade back to theme one first.
    const playing = music.status().track;
    const lead = preview && playing && playing !== musicSetFor(false, false).background ? -3.1 : 0;
    boatVoyage = { path, preview, t: lead };
    pos = path.from;
    facing = path.facing;
    overviewTime = OVERVIEW_SECONDS;
    snowshoeMusicPreview = false;
    climbMusicPreview = false;
    getaMusicPreview = false;
    lanternMusicPreview = false;
    ashMusicPreview = false;
  };

  const startShipVoyage = (path: ShipLaunch, preview = false): void => {
    // If this save is already on the sea theme, let the debug run fade back to the basalt theme first.
    const playing = music.status().track;
    const lead = preview && playing && playing !== MUSIC_SETS[6].background ? -3.1 : 0;
    shipVoyage = { path, preview, t: lead };
    pos = path.from;
    facing = path.facing;
    overviewTime = OVERVIEW_SECONDS;
    snowshoeMusicPreview = false;
    climbMusicPreview = false;
    getaMusicPreview = false;
    lanternMusicPreview = false;
    ashMusicPreview = false;
    shipMusicPreview = false;
  };

  const startTrainRide = (from: StationIndex, preview = false): void => {
    if (!railway) return;
    const visibleState = preview
      ? railway.requiredRegions.reduce((next, id) => restoreShrine(next, world.regionById(id)), state)
      : state;
    trainRide = {
      from, preview, visibleState, t: 0, wait: 0,
      boardingFrom: preview ? railway.stations[from].stand : pos,
    };
    facing = Math.atan2(-railway.across.x, -railway.across.z);
    overviewTime = OVERVIEW_SECONDS;
    trainLoadNotice = 0;
    down.clear();
  };
  const finishTrainRide = (arrived: boolean): void => {
    if (!railway || !trainRide) return;
    if (arrived && !trainRide.preview) {
      parkedTrain = otherStation(trainRide.from);
      pos = railway.stations[parkedTrain].stand;
      facing = Math.atan2(railway.across.x, railway.across.z);
    }
    if (document.activeElement instanceof HTMLButtonElement && document.activeElement.closest(".fuji-ride")) {
      document.activeElement.blur();
    }
    trainRide = null;
    down.clear();
    cues.stop("rail-roll", 0.55);
  };
  const railView = railway && createRailwayView(container, () => finishTrainRide(stage.railwayReady()));

  const stopGearMoments = (): void => {
    pendingCompletion = null;
    completion.close();
    finishTrainRide(false);
    shrineArrival = false;
    gearReveal = null;
    finalMusicPending = false;
    boatVoyage = null;
    shipVoyage = null;
    snowshoeMoment = null;
    climbMoment = null;
    getaMoment = null;
    lanternMoment = null;
    ashMoment = null;
    boatTrial = false;
    shipTrial = false;
    shipMusicPreview = false;
    snowshoeMusicPreview = false;
    climbMusicPreview = false;
    getaMusicPreview = false;
    lanternMusicPreview = false;
    ashMusicPreview = false;
  };
  /** Debug only: fixed sim step per frame (seconds), so slow renderers can step the sequence deterministically. */
  let fixedDt: number | null = null;

  const saveGame = (game: GameState): void => saves.write(slot.id, JSON.stringify(serialize(game)), landmarksRestored(game, world));
  /** Remembers where the player stands, unless a scripted moment is carrying them. */
  const savePosition = (): void => {
    if (momentBusy() || (pos.x === savedAt.x && pos.z === savedAt.z)) return;
    savedAt = pos;
    saves.writePosition(slot.id, pos);
  };

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
    if (g) travelToShrine(standPoint(g.region));
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
    wakes.delete(region.id);
    if (region.landmark) pendingCompletion = null;
    if (finalMusicPending && landmarksRestored(state, world) < PILGRIMS_WAKE_STARS) finalMusicPending = false;
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

    const previewFirstSailing = (): void => {
      const caps = new Set<Capability>(["boat", "ship"]);
      // Trace out from a landmark in the open sea until a clear bank meets enough sea for the ship to berth and sail off.
      for (const region of world.landmarks) {
        if (region.biome !== "sea") continue;
        for (let bearing = 0; bearing < 16; bearing++) {
          const angle = bearing * Math.PI / 8;
          const at = (r: number): Point => ({ x: region.site.x + Math.cos(angle) * r, z: region.site.z + Math.sin(angle) * r });
          for (let r = 4; r < 32; r += 0.35) {
            const from = at(r);
            const entry = at(r + 0.35);
            if (onWater(terrain, from) || terrain.tileAtPoint(entry.x, entry.z).biome !== "sea" || blockerAt(terrain, caps, from.x, from.z)) continue;
            const clear = clearOfObstacles(terrain, caps, obstacles, from);
            if (Math.hypot(clear.x - from.x, clear.z - from.z) > 0.01) continue;
            const path = planShipLaunch(terrain, caps, obstacles, from, entry);
            if (Math.hypot(path.afloat.x - entry.x, path.afloat.z - entry.z) < 3.4) continue;
            beginPreview();
            shipTrial = true;
            startShipVoyage(path, true);
            return;
          }
        }
      }
    };

    const restoreLandmarks = (): void => world.landmarks.forEach((r) => restore(r.id));
    const reset = (next: (s: GameState) => GameState): void => {
      stopGearMoments();
      wakes.clear();
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
      previewGetaUnlock: () => previewGearUnlock("geta"),
      previewLanternUnlock: () => previewGearUnlock("lantern"),
      previewAshSandalsUnlock: () => previewGearUnlock("ashSandals"),
      previewShipUnlock: () => previewGearUnlock("ship"),
      previewShipUse: previewFirstSailing,
      previewPilgrimsWake: () => previewGearUnlock("pilgrimsWake"),
      previewClimbUse: () => {
        beginPreview();
        // If this save is already on the ridge theme, let the preview fade back to the snow theme first.
        const playing = music.status().track;
        const lead = playing && playing !== MUSIC_SETS[2].background ? -3.1 : 0;
        climbMusicPreview = true;
        climbMoment = { t: lead };
      },
      previewGetaUse: () => {
        beginPreview();
        // If this save is already on the marsh theme, let the preview fade back to the ridge theme first.
        const playing = music.status().track;
        const lead = playing && playing !== MUSIC_SETS[3].background ? -3.1 : 0;
        getaMusicPreview = true;
        getaMoment = { t: lead };
      },
      previewLanternUse: () => {
        beginPreview();
        const playing = music.status().track;
        const lead = playing && playing !== MUSIC_SETS[4].background ? -3.1 : 0;
        lanternMusicPreview = true;
        lanternMoment = { t: lead };
      },
      previewAshSandalsUse: () => {
        beginPreview();
        // If this save is already on the basalt theme, let the preview fade back to the lantern theme first.
        const playing = music.status().track;
        const lead = playing && playing !== MUSIC_SETS[5].background ? -3.1 : 0;
        ashMusicPreview = true;
        ashMoment = { t: lead };
      },
      previewFirstVoyage,
      previewFujiRide: railway ? () => {
        beginPreview();
        startTrainRide(0, true);
      } : undefined,
      previewSnowshoeUse: () => {
        beginPreview();
        // If this save is already on the snow theme, let the preview fade back to the sea theme first.
        const playing = music.status().track;
        const lead = playing && playing !== MUSIC_SETS[1].background ? -3.1 : 0;
        snowshoeMusicPreview = true;
        snowshoeMoment = { t: lead };
      },
    };
    debugPanel = createDebugPanel(container, actions, () => down.clear());
    // Also available from the console: window.wayshrine.
    Object.assign(window, {
      wayshrine: { world, railway, railRideTime: () => trainRide?.t ?? null, monuments, obstacles, getPos: () => pos, readMonument, music, cues, setFixedDt: (d: number | null) => (fixedDt = d), teleport: (x: number, z: number) => { stopGearMoments(); pos = { x, z }; }, restore, ...actions },
    });
  }

  const fit = (): void => stage.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", fit);
  fit();

  // Escape closes the expanded map before it can open the settings.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape") return;
      if (trainRide) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) finishTrainRide(stage.railwayReady());
        return;
      }
      if (!minimap.isExpanded() || panel.isOpen()) return;
      e.stopImmediatePropagation();
      if (!e.repeat) minimap.toggleExpanded();
    },
    true,
  );

  const any = (codes: readonly string[]): number => (codes.some((c) => down.has(c)) ? 1 : 0);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    music.unlock(); // browsers allow audio only after a user gesture
    if (trainRide) {
      if (KEY_ACT.includes(e.code) && (e.code === "KeyE" || !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault();
        finishTrainRide(stage.railwayReady());
      } else if (e.code === KEY_MUTE) {
        settings.update({ muted: !settings.get().muted });
      }
      return;
    }
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
          const backgroundTrack = selectedMusicSet().background;
          restore(region.id);
          const kind: AwakeningKind = region.landmark ? "landmark" : "shrine";
          const count = kind === "landmark" ? landmarksRestored(state, world) : 0;
          if (count === world.landmarks.length) pendingCompletion = region;
          const unlocksGear = count === CAPABILITY_THRESHOLDS.boat ? "boat"
            : count === CAPABILITY_THRESHOLDS.snowshoes ? "snowshoes"
            : count === CAPABILITY_THRESHOLDS.climbing ? "climbing"
            : count === CAPABILITY_THRESHOLDS.geta ? "geta"
            : count === CAPABILITY_THRESHOLDS.lantern ? "lantern"
            : count === CAPABILITY_THRESHOLDS.ashSandals ? "ashSandals"
            : count === CAPABILITY_THRESHOLDS.ship ? "ship"
            : count === PILGRIMS_WAKE_STARS ? "pilgrimsWake" : null;
          if (unlocksGear === "pilgrimsWake") finalMusicPending = true;
          const initialZoom = overviewZoomAt(overviewTime);
          overviewTime = OVERVIEW_SECONDS;
          awakening = { regionId: region.id, kind, t: 0, initialZoom, caption: 0, captionOff: false, unlocksGear, backgroundTrack };
          // Each swell is trimmed so its peak lands just before the wave finishes filling the region.
          cues.play(AWAKENING_BURST);
          const useWinterSwell = kind === "shrine" && (
            backgroundTrack === "snowline-walk" || backgroundTrack === "marshwalk" || backgroundTrack === "lantern-trail"
          );
          if (kind === "shrine" && backgroundTrack === "basalt-crossing") cues.play(VOLCANIC_SHRINE_SWELL);
          else if (useWinterSwell) cues.play(WINTER_SHRINE_SWELL, WINTER_SHRINE_FADE_IN);
          else cues.play(AWAKENING_SWELLS[kind]);
        } else {
          const station = stationInReach(railway, pos);
          if (station !== null && railway && railwayPowered(railway, state)) {
            if (minimap.isExpanded()) minimap.toggleExpanded();
            startTrainRide(station);
            return;
          }
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
  let movementCue: CueId | undefined;
  const releaseMovement = (): void => {
    down.clear();
    Object.values(MOVEMENT_CUES).forEach((id) => cues.stop(id));
    cues.stop("walk-water");
    movementCue = undefined;
  };
  function showCompletion(finalLandmark?: Region): void {
    releaseMovement();
    monumentUi.dismissReading();
    if (minimap.isExpanded()) minimap.toggleExpanded();
    completion.show(world.landmarks, settings.get().language, finalLandmark);
  }
  function travelToShrine(destination: Point): boolean {
    if (momentBusy()) return false;
    releaseMovement();
    monumentUi.dismissReading();
    overviewTime = OVERVIEW_SECONDS;
    pos = destination;
    shrineArrival = true;
    return true;
  }

  window.addEventListener("pagehide", savePosition);
  window.addEventListener("blur", releaseMovement);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseMovement();
  });

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = fixedDt ?? Math.min(0.05, (now - last) / 1000);
    last = now;
    stage.tick(dt);
    positionTimer += dt;
    if (positionTimer >= POSITION_SAVE_SECONDS) {
      positionTimer = 0;
      savePosition();
    }

    if (lastRestored !== state.restored) {
      lastRestored = state.restored;
      restoredLandmarks = world.landmarks.filter((region) => isRestored(state, region)).map((region) => region.landmark!.id);
    }
    const caps = capabilitiesForCount(restoredLandmarks.length);
    if (boatTrial && !boatVoyage && !onWater(terrain, pos)) boatTrial = false;
    if (shipTrial && !shipVoyage && !onWater(terrain, pos)) shipTrial = false;
    const sailingCaps = boatTrial || shipTrial ? new Set<Capability>([...caps, ...(boatTrial ? ["boat" as const] : []), ...(shipTrial ? ["ship" as const] : [])]) : caps;
    // Losing a capability (a reset, an old save) must never strand the player.
    if (!boatVoyage && !shipVoyage && !trainRide) pos = clearOfObstacles(terrain, sailingCaps, obstacles, safePosition(terrain, sailingCaps, pos));
    const seen = boatTrial || shipTrial || trainRide ? state : discoverNear(state, world, pos);
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
      if (moving && restoredLandmarks.length >= PILGRIMS_WAKE_STARS && !boatTrial && !shipTrial) {
        const entered = world.regionAt(pos.x, pos.z);
        if (!entered.landmark && !isRestored(state, entered)) {
          wakes.set(entered.id, createRestorationWake(entered, pos));
          restore(entered.id);
        }
      }
      const biomeNow = terrain.tileAtPoint(pos.x, pos.z).biome;
      if (caps.has("boat") && !state.boatLaunched && !boatTrial && !onWater(terrain, from) && biomeNow === "water") {
        startVoyage(planBoatLaunch(terrain, caps, obstacles, from, pos));
      } else if (caps.has("ship") && !state.shipLaunched && !shipTrial && biomeNow === "sea" && terrain.tileAtPoint(from.x, from.z).biome !== "sea") {
        startShipVoyage(planShipLaunch(terrain, caps, obstacles, from, pos));
      } else if (moving && caps.has("lantern") && !state.lanternUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "forest") {
        state = recordLanternUse(state);
        saveGame(state);
        lanternMoment = { t: 0 };
        overviewTime = OVERVIEW_SECONDS;
      } else if (moving && caps.has("ashSandals") && !state.ashSandalsUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "volcanic") {
        state = recordAshSandalsUse(state);
        saveGame(state);
        ashMoment = { t: 0 };
        facing = Math.atan2(dir.x, dir.z);
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

    let voyageFrame: VoyageFrame | undefined;
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
    if (shipVoyage) {
      shipVoyage.t += dt;
      if (shipVoyage.t >= 0) {
        voyageFrame = shipLaunchFrame(shipVoyage.path, shipVoyage.t);
        pos = voyageFrame.rider;
        if (voyageFrame.done) {
          if (!shipVoyage.preview) {
            state = recordShipLaunch(state);
            saveGame(state);
          }
          shipVoyage = null;
        }
      }
    }
    let railFrame: TrainFrame | undefined;
    let railPlayer = pos;
    let boardingHeight: number | undefined;
    let railPreparing = false;
    trainLoadNotice = Math.max(0, trainLoadNotice - dt);
    if (railway && trainRide) {
      const ride = trainRide;
      railPreparing = !stage.railwayReady();
      if (railPreparing) {
        ride.wait += dt;
        if (ride.wait > 8) {
          finishTrainRide(false);
          trainLoadNotice = 4;
        }
      } else {
        const previous = ride.t;
        ride.t += dt;
        if (previous < TRAIN_BOARD_SECONDS && ride.t >= TRAIN_BOARD_SECONDS) cues.play("rail-roll", 1.1);
        const brakeAt = TRAIN_BOARD_SECONDS + TRAIN_RUN_SECONDS - 1.2;
        if (previous < brakeAt && ride.t >= brakeAt) cues.stop("rail-roll", 1.7);
      }
      if (trainRide) {
        railFrame = trainFrame(railway, ride.from, ride.t);
        if (railFrame.done) {
          finishTrainRide(true);
          railPlayer = pos;
          railFrame = undefined;
        } else if (ride.t >= TRAIN_BOARD_SECONDS + TRAIN_RUN_SECONDS) {
          railPlayer = railway.stations[otherStation(ride.from)].stand;
        } else {
          const from = ride.boardingFrom;
          const door = railPoint(railway, railway.stations[ride.from].distance + 1.4, 0.9);
          const step = railFrame.boarding;
          railPlayer = { x: from.x + (door.x - from.x) * step, z: from.z + (door.z - from.z) * step };
          const ground = terrain.groundAt(from.x, from.z);
          boardingHeight = ground + (railway.height + 0.42 - ground) * step;
        }
      }
    }

    if (climbMoment) {
      climbMoment.t += dt;
      if (climbMoment.t >= CLIMB_MOMENT_SECONDS) climbMoment = null;
    }
    if (ashMoment) {
      ashMoment.t += dt;
      if (ashMoment.t >= ASH_MOMENT_SECONDS) ashMoment = null;
    }
    if (getaMoment) {
      getaMoment.t += dt;
      if (getaMoment.t >= GETA_MOMENT_SECONDS) getaMoment = null;
    }
    if (lanternMoment) {
      lanternMoment.t += dt;
      if (lanternMoment.t >= LANTERN_MOMENT_SECONDS) lanternMoment = null;
    }
    if (snowshoeMoment) {
      snowshoeMoment.t += dt;
      if (snowshoeMoment.t >= SNOWSHOE_MOMENT_SECONDS) snowshoeMoment = null;
    }
    if (gearReveal) {
      gearReveal.left -= dt;
      if (gearReveal.left <= 0) gearReveal = null;
    }

    for (const wake of wakes.values()) wake.progress = Math.min(1, wake.progress + dt / PILGRIMS_WAKE_SECONDS);

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

    // Let the final landmark ceremony finish before opening the chart.
    if (pendingCompletion && !momentBusy() && !modalOpen() && !gearReveal && !finalMusicPending) {
      showCompletion(pendingCompletion);
      pendingCompletion = null;
      moving = false;
    }
    completion.update(dt);

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
      !gearReveal && !momentBusy() && !completion.isOpen() && here.landmark && isRestored(state, here) && Math.hypot(pos.x - here.site.x, pos.z - here.site.z) < LANDMARK_NAME_RANGE
        ? here.landmark.id
        : null;
    if (nearLandmark) nearNameId = nearLandmark;
    if (gearReveal) nearName = 0;
    else nearName += Math.max(-dt / CAPTION_FADE, Math.min(dt / CAPTION_FADE, (nearLandmark ? 1 : 0) - nearName));
    const nearModel = nearNameId && nearName > 0 ? { id: nearNameId, label: t.landmarkNames[nearNameId] ?? nearNameId, opacity: nearName, english: prefs.language === "en" } : null;
    const needed = blockedBy ? requirementOf(blockedBy) : null;
    const hint = blockedBy && needed ? t.blocked(t.capability[needed], t.terrain[blockedBy]) : null;
    const reach = shrineInReach(terrain, pos);
    const stone = momentBusy() ? null : monumentInReach(monuments, pos);
    const station = momentBusy() ? null : stationInReach(railway, pos);
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
        : station !== null && railway
          ? railwayPowered(railway, state) ? t.railway.board : t.railway.dormant
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
    const reading = monumentUi.isReading();
    hud.update({
      capabilities: caps,
      restoredLandmarks,
      prompt: reading ? null : prompt,
      hint: reading || momentBusy() ? null : trainLoadNotice > 0 ? t.railway.unavailable : hint,
      gearReveal: gearReveal && { gear: gearReveal.gear, locale: prefs.language },
      landmarkName: nameModel,
      nearLandmarkName: nearModel,
      messages: t,
    });
    minimap.update({ pos, state, target: debug ? guide?.region ?? null : null, visible: prefs.showMinimap, labels: t.map, names: { landmark: (id) => t.landmarkNames[id] ?? id, terrain: t.terrain, capability: t.capability, needs: t.mapNeeds }, monuments: debug ? monuments.all : undefined, travelToAny: debug });

    const movementTile = moving && !voyageFrame && !lanternMoment ? terrain.tileAtPoint(pos.x, pos.z) : undefined;
    let nextMovementCue = movementTile && MOVEMENT_CUES[movementTile.biome];
    if (ginzan && (movementTile?.ginzanSurface === "stream" || movementTile?.ginzanSurface === "bath")
      && ginzanWarmth(ginzan, movementTile.regionId, (id) => Number(state.restored.has(id))) > 0) {
      nextMovementCue = "walk-water";
    }
    if (nextMovementCue !== movementCue) {
      if (movementCue) cues.stop(movementCue, MOVEMENT_FADE_OUT);
      if (nextMovementCue) cues.play(nextMovementCue, MOVEMENT_FADE_IN);
      movementCue = nextMovementCue;
    }
    cues.update(dt);
    const audible = cues.playing();
    const background = selectedMusicSet();
    // The threshold landmark still hands the score off directly from its swell.
    if (finalMusicPending) {
      if (!audible.includes(AWAKENING_SWELLS.landmark)) {
        music.setTrack(FINAL_MUSIC.background, 0.1, "cut");
        finalMusicPending = false;
      }
    } else if (awakening?.unlocksGear !== "pilgrimsWake") {
      // Regular restorations keep the theme captured when their swell began.
      music.setTrack(awakening?.backgroundTrack ?? background.background, !leadingIn() && (momentBusy() || snowshoeMusicPreview || climbMusicPreview || lanternMusicPreview || ashMusicPreview) ? GEAR_FADE_SECONDS : undefined);
    }
    const swellDuck = ALL_AWAKENING_CUES.some((id) => audible.includes(id)) ? SWELL_DUCK : railFrame?.windowView ? 0.3 : 1;
    music.setDuck(swellDuck);
    music.update(dt);
    const playing = musicSetIndex(background);
    const availableThemes = unlockedThemes(earnedMusicSets(), playing);
    const themeNumber = availableThemes.indexOf(playing) + 1;
    const heard = settings.get();
    musicButton.update({
      number: themeNumber,
      total: availableThemes.length,
      label: messagesFor(heard.language).musicTrack(themeNumber, availableThemes.length),
      visible: availableThemes.length > 1 && heard.musicVolume > 0 && !heard.muted,
    });

    const lightingProgress = lanternMoment ? Math.max(0, lanternMoment.t / LANTERN_MOMENT_SECONDS) : undefined;
    const lighting = lightingProgress === undefined ? undefined : {
      progress: lightingProgress,
      flame: Math.min(1, Math.max(0, (lightingProgress - LANTERN_IGNITION_AT) / 0.12)),
    };
    railView?.(railFrame, railPreparing, t.railway);
    stage.render(dt, {
      player: railPlayer, facing, state: trainRide?.visibleState ?? state,
      moving: moving || (railFrame !== undefined && railFrame.boarding > 0 && railFrame.boarding < 1), drawing: climbMoment && climbMoment.t >= 0 ? climbMoment.t / CLIMB_MOMENT_SECONDS : undefined, strapping: snowshoeMoment && snowshoeMoment.t >= 0 ? snowshoeMoment.t / SNOWSHOE_MOMENT_SECONDS : getaMoment && getaMoment.t >= 0 ? getaMoment.t / GETA_MOMENT_SECONDS : ashMoment && ashMoment.t >= 0 ? ashMoment.t / ASH_MOMENT_SECONDS : undefined, strapGear: ashMoment ? "ashSandals" : getaMoment ? "geta" : "snowshoes", character: settings.get().character, capabilities: caps, overviewZoom: overviewZoomAt(overviewTime), awakening: scene, wakes,
      lighting,
      voyage: voyageFrame,
      train: railFrame,
      shrineArrival,
      onShrineShimmer: playShrineTravel,
      parkedTrain: railway?.stations[parkedTrain].distance,
      boardingHeight,
    });
    shrineArrival = false;
    for (const [id, wake] of wakes) if (wake.progress === 1) wakes.delete(id);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
