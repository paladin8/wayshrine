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
  parkedTrainObstacle,
  PLAYER_SPEED,
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
import { COMPLETION_TRACK, createCuePlayer, createMusic, FINAL_MUSIC, FUJI_RIDE_TRACK, MUSIC_SETS, musicSetFor, nextTheme, unlockedThemes, type CueId, type Music, type MusicSet, type TrackId } from "../audio";
import { createChunkSource, createStage, perfBegin, perfMark, perfEnd } from "../render";
import { monumentSpecs } from "../content";
import { CAPABILITY_THRESHOLDS, PILGRIMS_WAKE_STARS, capabilitiesForCount, createObstacles, createTerrain, createWorld, fujiRailway, ginzanStream, ginzanWarmth, planMonuments, railPoint, standPoint, type Biome, type Capability, type Obstacles, type Point, type Region, type World } from "../world";
import { createDebugPanel } from "./debug";
import { createHud } from "./hud";
import { messagesFor, type Messages } from "./i18n";
import { createJourneyCompletion } from "./journey-completion";
import { createMinimap } from "./minimap";
import { createMonumentUi } from "./monuments-ui";
import { createBackpack } from "./backpack";
import { installCrashOverlay } from "./crash-overlay";
import { activateFocused, createInput, formatPrompt, navigatePanel, pressKey, walkScale, type Action, type ActKind } from "./input";
import { NO_MOVE, strongest } from "./input/actions";
import { createMusicButton } from "./music-button";
import { createNotebook } from "./notebook";
import { projectStarMap } from "./star-map";
import { createRailwayView } from "./railway-view";
import { browserStorage, createSaveStore, withJourneyLock, type SaveSlot, type SaveStore } from "./saves";
import { createSettingsStore, type SettingsStore } from "./settings";
import { createSteamSaveStorage, earnedSteamAchievements } from "./steam";
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
const WELCOME_SECONDS = 8;
const GEAR_THEMES = {
  boat: MUSIC_SETS[1],
  snowshoes: MUSIC_SETS[2],
  climbing: MUSIC_SETS[3],
  geta: MUSIC_SETS[4],
  lantern: MUSIC_SETS[5],
  ashSandals: MUSIC_SETS[6],
  ship: MUSIC_SETS[7],
  pilgrimsWake: FINAL_MUSIC,
} satisfies Record<GearReveal, MusicSet>;
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
const KEY_BACKPACK = "KeyI";
const KEY_MUTE = "KeyN";
/** Debug only. */
const KEY_UNRESTORE = "KeyU";
const KEY_RUBBING = "KeyR";
const KEY_NEXT_SHRINE = "KeyG";

type SaveNotice = keyof Messages["saveNotice"];

function createSaveNotice(container: HTMLElement, settings: SettingsStore) {
  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  alert.style.cssText = "position:fixed;z-index:55;left:50%;top:12px;transform:translateX(-50%);width:max-content;max-width:min(63vw,540px);box-sizing:border-box;padding:8px 14px;border:1px solid #a46b52;border-radius:6px;background:#fff5e4;color:#522e24;font:14px/1.4 system-ui;text-align:center;pointer-events:none";
  container.append(alert);
  let notice: SaveNotice | undefined;
  const render = (): void => {
    alert.hidden = !notice;
    alert.textContent = notice ? messagesFor(settings.get().language).saveNotice[notice] : "";
  };
  settings.subscribe(render);
  render();
  return (next?: SaveNotice): void => {
    if (next === notice) return;
    notice = next;
    render();
  };
}

function loadGame(saves: SaveStore, slot: SaveSlot): { raw: string | null; state: GameState; world: World } {
  const raw = saves.read(slot.id);
  const world = createWorld(slot.seed);
  if (raw === null) {
    if (slot.restored > 0) throw new Error("Missing journey body");
    return { raw, state: newGame(slot.seed), world };
  }
  const data = JSON.parse(raw) as SaveData;
  const strings = (value: unknown): boolean => Array.isArray(value) && value.every((item) => typeof item === "string");
  if (data?.seed !== slot.seed || !strings(data.restored)
    || (data.v >= 2 && !strings((data as Extract<SaveData, { explored: unknown }>).explored))
    || (data.v >= 3 && !strings((data as Extract<SaveData, { collected: unknown }>).collected))) {
    throw new Error("Invalid journey body");
  }
  return { raw, state: deserialize(data, world), world };
}

/** How often the player's position is written to the save. */
const POSITION_SAVE_SECONDS = 1;
const PLAYTIME_SAVE_MS = 10_000;

/**
 * Browser entry: the title screen, then the game. ?seed=anything skips the title and plays that world
 * (the same seed always builds the same world).
 */
export async function startApp(container: HTMLElement): Promise<void> {
  const settings = createSettingsStore(undefined, navigator.languages);
  installCrashOverlay(container, () => settings.get().language);
  const desktop = window.wayshrineDesktop;
  const showNotice = createSaveNotice(container, settings);
  let steamUnavailable = false;
  const notify = (notice?: SaveNotice): void => showNotice(notice ?? (steamUnavailable ? "cloud" : undefined));
  const local = browserStorage();
  let cloud: ReturnType<typeof createSteamSaveStorage> | undefined;
  if (desktop) {
    try {
      const boot = await desktop.loadSteamSaves();
      if (boot) cloud = createSteamSaveStorage(boot, desktop.writeSteamSaves, local);
    } catch (error) {
      console.error("Could not load Steam saves. Using the standalone profile.", error);
      steamUnavailable = true;
      notify();
    }
  }
  const reportAchievements = cloud && desktop?.reportSteamAchievements;
  const saves = await withJourneyLock(() => createSaveStore(cloud?.storage ?? local, undefined, undefined, (seed, ids) => {
    const world = createWorld(seed);
    return ids.filter((id) => world.regionById(id).landmark).length;
  }, cloud?.persist));
  if (cloud?.imported) {
    cloud.persist();
    void cloud.flush().catch(() => notify("write"));
  }
  let saveBeforeClose = async (): Promise<boolean> => {
    await cloud?.flush();
    return true;
  };
  desktop?.saveBeforeClose?.(async () => {
    try {
      if (await saveBeforeClose()) return null;
    } catch (error) {
      console.error("Could not save before closing", error);
      notify("write");
    }
    const t = messagesFor(settings.get().language);
    return { message: t.saveNotice.write, stay: t.settings.keepPlaying, discard: t.settings.leaveWithoutSaving };
  });
  const seed = new URLSearchParams(window.location.search).get("seed");
  const music = createMusic({ duckReleaseSeconds: MUSIC_RETURN_SECONDS });
  let prepared: ReturnType<typeof loadGame> | undefined;
  const canLoad = (slot: SaveSlot): boolean => {
    try {
      prepared = loadGame(saves, slot);
      return true;
    } catch (error) {
      console.error("Could not open journey", error);
      notify("load");
      return false;
    }
  };
  const play = (slot: SaveSlot, isNew: boolean): void => {
    const loaded = isNew ? { raw: null, state: newGame(slot.seed), world: createWorld(slot.seed) } : prepared!;
    saveBeforeClose = startGame(container, slot, settings, saves, music, isNew, loaded, notify, !!(cloud || local), reportAchievements, cloud?.flush);
  };
  if (seed !== null) {
    const slot = saves.forSeed(seed);
    const isNew = !saves.list().some((saved) => saved.id === slot.id);
    if (isNew || canLoad(slot)) {
      play(slot, isNew);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("seed");
    window.history.replaceState(null, "", url);
  }
  const title = createTitleScreen(container, { saves, settings, music, canLoad, onSaveError: () => notify("write"), flushSaves: cloud?.flush });
  void title.chosen.then(({ slot, isNew }) => {
    title.destroy();
    play(slot, isNew);
  });
}

/** Browser wiring: input, the game loop, the HUD and saving. */
function startGame(
  container: HTMLElement, slot: SaveSlot, settings: SettingsStore, saves: SaveStore, music: Music, isNew: boolean,
  loaded: ReturnType<typeof loadGame>, notify: (notice?: SaveNotice) => void, durable: boolean,
  reportAchievements?: (ids: readonly string[]) => void,
  flushSaves?: () => Promise<void>,
): () => Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const world = loaded.world;
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
  }, railway, createChunkSource(world.seed, monumentSpecs));
  const obstacles: Obstacles = {
    near(x, z, reach) {
      const nearby = sceneryObstacles.near(x, z, reach);
      stage.appendObstaclesNear(x, z, reach, nearby);
      if (railway && !trainRide && railwayPowered(railway, state)) {
        const train = parkedTrainObstacle(railway, parkedTrain, { x, z }, reach);
        if (train) nearby.push(train);
      }
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

  let state = loaded.state;
  let savedBody = loaded.raw;
  let saveConflict = false;
  const reported = new Set<string>();
  const reportProgress = (game: GameState, count: number): void => {
    if (!reportAchievements || debug) return;
    const earned = earnedSteamAchievements(game, count, world.landmarks.length).filter((id) => !reported.has(id));
    earned.forEach((id) => reported.add(id));
    if (earned.length) reportAchievements(earned);
  };
  reportProgress(state, landmarksRestored(state, world));
  const monumentUi = createMonumentUi(container, hud.topLeft, {
    collected: () => state.collected,
    language: () => settings.get().language,
    sound: (cue) => cues.play(cue),
  });
  const musicButton = createMusicButton(hud.actions, () => cycleMusic());
  let leaving = false;
  const leave = async (exit: () => void): Promise<void> => {
    if (leaving) return;
    leaving = true;
    try {
      // Run behind any queued autosaves, keeping the current position and progress together.
      const saved = await saveGame(state, true);
      if (saved) exit();
      else panel.allowLeavingWithoutSaving(exit);
    } finally {
      leaving = false;
    }
  };
  const desktop = window.wayshrineDesktop;
  const panel = createSettingsPanel(container, hud.actions, settings, {
    onTitle: () => { void leave(() => { window.location.href = window.location.pathname; }); },
    onQuit: desktop && (() => { void leave(() => desktop.quit()); }),
  });
  const backpack = createBackpack(container, hud.backpackButton, () => cues.play("backpack-open"));
  const completion = createJourneyCompletion(container, stage.groundDirection);
  const notebook = createNotebook(container, hud.landmarkButton, {
    all: world.landmarks.map((region) => region.landmark!.id),
    restored: () => world.landmarks.filter((region) => isRestored(state, region)).map((region) => region.landmark!.id),
    starMap: () => projectStarMap(world.landmarks, stage.groundDirection),
    debug,
    language: () => settings.get().language,
    sound: (cue) => cues.play(cue),
    onTravel: (id) => {
      const region = world.landmarks.find((r) => r.landmark?.id === id);
      if (region) travelToShrine(standPoint(region));
    },
  });
  /** Dialogs own the keyboard while open. */
  const modalOpen = (): boolean => completion.isOpen() || panel.isOpen() || monumentUi.isBoxOpen() || notebook.isOpen() || backpack.isOpen() || debugPanel?.isOpen() === true;
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
  let playtimeSince = document.hidden ? null : performance.now();
  let pendingPlaytimeMs = 0;
  const samplePlaytime = (): void => {
    const now = performance.now();
    if (playtimeSince !== null) pendingPlaytimeMs += Math.max(0, now - playtimeSince);
    playtimeSince = document.hidden ? null : now;
  };
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
  let welcomeLeft = isNew ? WELCOME_SECONDS : 0;
  let gearReveal: { gear: GearReveal; left: number } | null = null;
  let pendingCompletion: Region | null = null;
  const wakes = new Map<string, RestorationWake>();
  let finalMusicPending = false;
  let boatVoyage: { readonly path: BoatLaunch; readonly preview: boolean; t: number } | null = null;
  let shipVoyage: { readonly path: ShipLaunch; readonly preview: boolean; t: number } | null = null;
  let trainRide: {
    readonly from: StationIndex;
    readonly boardingFrom: Point;
    readonly approachSeconds: number;
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
  let snowshoeMoment: { t: number } | null = null;
  let climbMoment: { t: number } | null = null;
  let getaMoment: { t: number } | null = null;
  let lanternMoment: { t: number } | null = null;
  let ashMoment: { t: number } | null = null;
  let gearMusic: { from: MusicSet; to: MusicSet; switchAt: number; t: number } | null = null;
  const gearAnimating = (): boolean => boatVoyage !== null || shipVoyage !== null || snowshoeMoment !== null
    || climbMoment !== null || getaMoment !== null || lanternMoment !== null || ashMoment !== null;
  const momentBusy = (): boolean => trainRide !== null || awakening !== null || gearAnimating()
    || (gearReveal !== null && gearReveal.gear !== "pilgrimsWake");
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
    if (gearMusic) return gearMusic.t < gearMusic.switchAt ? gearMusic.from : gearMusic.to;
    if (track === null) return progression;
    const earned = earnedMusicSets();
    return MUSIC_SETS.find((set, i) => set.background === track && earned[i]) ?? progression;
  };
  /** Moves on to the next unlocked theme, and back to following progression after the newest one. */
  const cycleMusic = (): void => {
    music.unlock();
    if (momentBusy() || gearMusic || finalMusicPending) return;
    const progression = progressionMusicSet();
    const playing = musicSetIndex(selectedMusicSet(progression));
    const next = MUSIC_SETS[nextTheme(unlockedThemes(earnedMusicSets(), playing), playing)] ?? progression;
    settings.update({ musicTrack: next === progression ? null : next.background });
  };
  const progressionMusicSet = (): MusicSet => musicSetFor(
    state.boatLaunched, state.snowshoesUsed, state.climbingUsed, state.getaUsed,
    state.lanternUsed, state.ashSandalsUsed, state.shipLaunched, restoredLandmarks.length >= PILGRIMS_WAKE_STARS,
  );
  const startGearMusic = (gear: GearReveal, switchAt = 0, preview = false): number => {
    const to = GEAR_THEMES[gear];
    const playing = music.status().track;
    const from = preview ? MUSIC_SETS[musicSetIndex(to) - 1] : MUSIC_SETS.find((set) => set.background === playing);
    const source = from ?? MUSIC_SETS[0];
    // Let a debug preview establish the preceding theme before starting the animation.
    const lead = preview && playing !== source.background ? -3.1 : 0;
    gearMusic = { from: source, to, switchAt, t: lead };
    return lead;
  };

  const startVoyage = (path: BoatLaunch, preview = false): void => {
    // If this save is already on the later score, let the debug run fade back to theme one first.
    const lead = startGearMusic("boat", BOAT_PUSH_OFF_SECONDS, preview);
    boatVoyage = { path, preview, t: lead };
    pos = path.from;
    facing = path.facing;
    overviewTime = OVERVIEW_SECONDS;
  };

  const startShipVoyage = (path: ShipLaunch, preview = false): void => {
    // If this save is already on the sea theme, let the debug run fade back to the basalt theme first.
    const lead = startGearMusic("ship", SHIP_PUSH_OFF_SECONDS, preview);
    shipVoyage = { path, preview, t: lead };
    pos = path.from;
    facing = path.facing;
    overviewTime = OVERVIEW_SECONDS;
  };

  const startTrainRide = (from: StationIndex, preview = false): void => {
    if (!railway) return;
    const visibleState = preview
      ? railway.requiredRegions.reduce((next, id) => restoreShrine(next, world.regionById(id)), state)
      : state;
    const stand = railway.stations[from].stand;
    const boardingFrom = preview ? stand : pos;
    const dx = stand.x - boardingFrom.x;
    const dz = stand.z - boardingFrom.z;
    const approachSeconds = Math.hypot(dx, dz) / PLAYER_SPEED;
    trainRide = { from, preview, visibleState, t: -approachSeconds, wait: 0, boardingFrom, approachSeconds };
    facing = approachSeconds > 0 ? Math.atan2(dx, dz) : Math.atan2(-railway.across.x, -railway.across.z);
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
    welcomeLeft = 0;
    gearMusic = null;
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
  };
  /** Debug only: fixed sim step per frame (seconds), so slow renderers can step the sequence deterministically. */
  let fixedDt: number | null = null;

  const checkSave = (): boolean => {
    if (!durable) {
      notify("write");
      return false;
    }
    if (saves.read(slot.id) !== savedBody || !saves.has(slot.id)) {
      saveConflict = true;
      notify("conflict");
    }
    return !saveConflict;
  };
  const writePosition = (position: Point): void => {
    if (position.x === savedAt.x && position.z === savedAt.z) return;
    saves.writePosition(slot.id, position);
    savedAt = position;
  };
  const writePlaytime = (): void => {
    const elapsed = Math.floor(pendingPlaytimeMs);
    if (elapsed === 0) return;
    saves.recordPlaytime(slot.id, elapsed);
    pendingPlaytimeMs -= elapsed;
  };
  const saveGame = async (game: GameState, exiting = false): Promise<boolean> => {
    if (exiting) samplePlaytime();
    const count = landmarksRestored(game, world);
    reportProgress(game, count);
    const body = JSON.stringify(serialize(game));
    try {
      const saved = await withJourneyLock(() => {
        if (!checkSave()) return false;
        saves.write(slot.id, body, count, () => { savedBody = body; });
        if (exiting) {
          writePlaytime();
          if (!momentBusy()) writePosition(pos);
        }
        return true;
      });
      if (saved) {
        await flushSaves?.();
        if (!saveConflict) {
          notify();
          panel.allowLeavingWithoutSaving(null);
        }
      }
      return saved;
    } catch (error) {
      console.error("Could not save journey", error);
      notify("write");
      return false;
    }
  };
  /** Saves foreground playtime, and position when a scripted moment is not carrying the player. */
  const saveCheckpoint = (forceTime = false): void => {
    samplePlaytime();
    const position = !momentBusy() && (pos.x !== savedAt.x || pos.z !== savedAt.z) ? pos : null;
    const saveTime = pendingPlaytimeMs >= (forceTime ? 1 : PLAYTIME_SAVE_MS);
    if (saveConflict || (!position && !saveTime)) return;
    void withJourneyLock(() => {
      if (!checkSave()) return;
      if (position) writePosition(position);
      if (saveTime) writePlaytime();
    }).then(() => flushSaves?.()).catch((error) => {
      console.error("Could not save journey checkpoint", error);
      notify("write");
    });
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
      backpack.close();
      if (monumentUi.isBoxOpen()) monumentUi.toggleBox();
      else monumentUi.dismissReading();
      if (minimap.isExpanded()) minimap.toggleExpanded();
      music.unlock();
    };
    const previewGearUnlock = (gear: GearReveal): void => {
      beginPreview();
      gearReveal = { gear, left: GEAR_REVEAL_SECONDS };
      if (gear === "pilgrimsWake") finalMusicPending = true;
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
        climbMoment = { t: startGearMusic("climbing", 0, true) };
      },
      previewGetaUse: () => {
        beginPreview();
        getaMoment = { t: startGearMusic("geta", 0, true) };
      },
      previewLanternUse: () => {
        beginPreview();
        lanternMoment = { t: startGearMusic("lantern", LANTERN_MOMENT_SECONDS * LANTERN_IGNITION_AT, true) };
      },
      previewAshSandalsUse: () => {
        beginPreview();
        ashMoment = { t: startGearMusic("ashSandals", 0, true) };
      },
      previewFirstVoyage,
      previewFujiRide: railway ? () => {
        beginPreview();
        startTrainRide(0, true);
      } : undefined,
      previewSnowshoeUse: () => {
        beginPreview();
        snowshoeMoment = { t: startGearMusic("snowshoes", 0, true) };
      },
    };
    debugPanel = createDebugPanel(container, { ...actions, quality: { get: () => stage.quality(), set: (c) => stage.setQuality(c) } }, () => down.clear());
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

  /** The act verb: skip a sequence, restore a shrine, board the train or read a stone. */
  const act = (): void => {
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
        welcomeLeft = 0;
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
  };
  const any = (codes: readonly string[]): number => (codes.some((c) => down.has(c)) ? 1 : 0);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.isTrusted) input.keyboardUsed();
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
    if (e.code === KEY_BACKPACK && !momentBusy() && !e.metaKey && !e.ctrlKey && !e.altKey) backpack.toggle();
    if (debug && e.code === KEY_UNRESTORE) unrestoreHere();
    if (debug && e.code === KEY_RUBBING) readRubbingHere();
    if (debug && e.code === KEY_NEXT_SHRINE && !e.metaKey && !e.ctrlKey && !e.altKey) goToNextShrine();
    if (e.code === KEY_MUTE) settings.update({ muted: !settings.get().muted });
    if (KEY_ACT.includes(e.code)) {
      if (e.code !== "KeyE" && e.target instanceof HTMLButtonElement) return;
      act();
    }
  });
  window.addEventListener("pointerdown", () => music.unlock());
  window.addEventListener("keyup", (e) => down.delete(e.code));
  /** Verbs from a gamepad or the touch buttons. Panels still receive Escape and the arrows as key events, so they behave as with a keyboard. */
  const handleAction = (action: Action): void => {
    music.unlock();
    if (trainRide) {
      if (action === "act" || action === "back" || action === "menu") finishTrainRide(stage.railwayReady());
      return;
    }
    if (completion.isOpen() && (action === "back" || action === "menu")) {
      completion.close();
      return;
    }
    const modal = modalOpen();
    switch (action) {
      case "menu":
        pressKey("Escape");
        return;
      case "back":
        if (modal || minimap.isExpanded()) pressKey("Escape");
        return;
      case "pagePrev":
        if (modal) pressKey("ArrowLeft");
        return;
      case "pageNext":
        if (modal) pressKey("ArrowRight");
        return;
      case "box":
        if (minimap.isExpanded()) return; // the trigger zooms the map
        if (!momentBusy() && (monumentUi.isBoxOpen() || !modal)) {
          down.clear();
          monumentUi.toggleBox();
        }
        return;
      case "journal":
        if (!momentBusy() && (notebook.isOpen() || !modal)) notebook.toggle();
        return;
      case "backpack":
        if (!momentBusy() && (backpack.isOpen() || !modal)) backpack.toggle();
        return;
      case "act":
        if (modal) activateFocused();
        else if (minimap.isExpanded()) minimap.travelToReticle();
        else act();
        return;
      case "map":
        if (!modal) minimap.toggleExpanded();
        return;
      case "overview":
        if (!modal && !momentBusy() && overviewTime >= OVERVIEW_SECONDS) overviewTime = 0;
        return;
      case "mute":
        settings.update({ muted: !settings.get().muted });
        return;
    }
  };
  const input = createInput(container, {
    onAction: (action) => handleAction(action),
    onNav: (dir) => {
      if (modalOpen() && !trainRide) navigatePanel(dir);
    },
    onUse: () => music.unlock(),
  });
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

  window.addEventListener("pagehide", () => saveCheckpoint(true));
  window.addEventListener("blur", releaseMovement);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseMovement();
    saveCheckpoint(true);
  });

  let last = performance.now();
  const frame = (now: number): void => {
    const perfDt = perfBegin(now);
    const perfT0 = performance.now();
    const dt = fixedDt ?? Math.min(0.05, (now - last) / 1000);
    last = now;
    perfMark("appPre");
    stage.tick(dt);
    perfMark("stageTick");
    positionTimer += dt;
    if (positionTimer >= POSITION_SAVE_SECONDS) {
      positionTimer = 0;
      saveCheckpoint();
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
    const padInput = input.poll(now / 1000);
    const mapOpen = minimap.isExpanded();
    const live = !modalOpen() && !mapOpen; // the map freezes walking
    const wanted = live ? strongest({ right: any(KEY_RIGHT) - any(KEY_LEFT), up: any(KEY_UP) - any(KEY_DOWN) }, padInput.move) : NO_MOVE;
    const right = wanted.right;
    const up = wanted.up;
    const walk = walkScale(wanted);
    if (mapOpen && !modalOpen() && input.device() === "gamepad") minimap.pad(strongest(padInput.pad.look, padInput.pad.move), padInput.pad.zoom, dt); // either stick or the D-pad pans
    let moving = false;
    if (!momentBusy() && (right !== 0 || up !== 0)) {
      monumentUi.dismissReading();
      const dir = stage.groundDirection(right, up);
      const from = pos;
      const moved = movePlayer(pos, dir, dt * walk, terrain, sailingCaps, obstacles);
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
        lanternMoment = { t: startGearMusic("lantern", LANTERN_MOMENT_SECONDS * LANTERN_IGNITION_AT) };
        overviewTime = OVERVIEW_SECONDS;
      } else if (moving && caps.has("ashSandals") && !state.ashSandalsUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "volcanic") {
        state = recordAshSandalsUse(state);
        saveGame(state);
        ashMoment = { t: startGearMusic("ashSandals") };
        facing = Math.atan2(dir.x, dir.z);
      } else if (moving && caps.has("snowshoes") && !state.snowshoesUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "snow") {
        state = recordSnowshoeUse(state);
        saveGame(state);
        snowshoeMoment = { t: startGearMusic("snowshoes") };
        facing = Math.atan2(dir.x, dir.z);
      } else if (moving && caps.has("geta") && !state.getaUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "marsh") {
        state = recordGetaUse(state);
        saveGame(state);
        getaMoment = { t: startGearMusic("geta") };
        facing = Math.atan2(dir.x, dir.z);
      } else if (moving && caps.has("climbing") && !state.climbingUsed && terrain.tileAtPoint(pos.x, pos.z).biome === "mountain") {
        state = recordClimbUse(state);
        saveGame(state);
        climbMoment = { t: startGearMusic("climbing") };
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
    let railWalking = false;
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
        } else if (ride.t < 0) {
          const stand = railway.stations[ride.from].stand;
          const from = ride.boardingFrom;
          const remaining = -ride.t / ride.approachSeconds;
          railPlayer = { x: stand.x + (from.x - stand.x) * remaining, z: stand.z + (from.z - stand.z) * remaining };
          railWalking = !railPreparing;
        } else {
          const from = railway.stations[ride.from].stand;
          facing = Math.atan2(-railway.across.x, -railway.across.z);
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
    if (welcomeLeft > 0 && !modalOpen()) welcomeLeft = Math.max(0, welcomeLeft - dt);
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
    completion.update(dt, music.playbackTime(COMPLETION_TRACK));

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
    const device = input.device();
    const promptRaw = awakening
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
    const prompt = promptRaw && formatPrompt(promptRaw, device, prefs.language);
    // On touch the act button carries the verb, so it follows the same conditions as the prompt.
    const actKind: ActKind | null = awakening
      ? awakening.t > timingOf(awakening.kind).zoomOut ? "skip" : null
      : momentBusy() ? null
      : reach && !isRestored(state, reach) ? "restore"
      : station !== null && railway && railwayPowered(railway, state) ? "board"
      : stone && isLegible(state, stone) ? "read"
      : null;
    input.touch.setText({ rotate: t.controls.rotate, act: t.controls.act, map: t.controls.map, box: t.controls.box, overview: t.controls.overview });
    input.touch.setVisible(device === "touch" && !modalOpen() && !monumentUi.isReading());
    input.touch.setAct(actKind);
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
    backpack.update({ messages: t, restored: restoredLandmarks.length });
    const notice = gearReveal ? t.gearReveal[gearReveal.gear] : welcomeLeft > 0 && !modalOpen() ? { ...t.welcome, hint: device === "gamepad" ? t.controls.welcomeGamepad : device === "touch" ? t.controls.welcomeTouch : t.welcome.hint } : null;
    hud.update({
      restoredLandmarks,
      prompt: reading ? null : prompt,
      hint: reading || momentBusy() ? null : trainLoadNotice > 0 ? t.railway.unavailable : hint,
      notice: notice && { ...notice, locale: prefs.language },
      landmarkName: nameModel,
      nearLandmarkName: nearModel,
      messages: t,
    });
    minimap.update({ pos, state, target: debug ? guide?.region ?? null : null, visible: prefs.showMinimap, labels: device === "keyboard" ? t.map : t.map[device], showOverview: device === "keyboard", names: { landmark: (id) => t.landmarkNames[id] ?? id, terrain: t.terrain, capability: t.capability, needs: t.mapNeeds }, monuments: debug ? monuments.all : undefined, travelToAny: debug });

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
    if (gearMusic) {
      gearMusic.t += dt;
      // Let the new theme finish fading in before returning to the saved selection.
      const unlockingWake = awakening?.unlocksGear === "pilgrimsWake" || gearReveal?.gear === "pilgrimsWake";
      if (!gearAnimating() && !unlockingWake && gearMusic.t >= gearMusic.switchAt + GEAR_FADE_SECONDS) gearMusic = null;
    }
    // The threshold landmark hands the score off directly from its swell.
    if (finalMusicPending && !audible.includes(AWAKENING_SWELLS.landmark)) {
      startGearMusic("pilgrimsWake");
      music.setTrack(FINAL_MUSIC.background, 0.1, "cut");
      finalMusicPending = false;
    }
    const background = selectedMusicSet();
    if (completion.isOpen()) {
      music.setTrack(COMPLETION_TRACK, 0.8);
    } else if (trainRide && (railFrame?.windowView || trainRide.t >= TRAIN_BOARD_SECONDS)) {
      // Start with the window reveal and keep the one-shot selected until disembarking.
      music.setTrack(FUJI_RIDE_TRACK, 0.8);
    } else if (!finalMusicPending) {
      const restorationTrack = awakening?.unlocksGear === "pilgrimsWake" ? undefined : awakening?.backgroundTrack;
      const switching = gearMusic && gearMusic.t >= gearMusic.switchAt;
      music.setTrack(restorationTrack ?? background.background, switching ? GEAR_FADE_SECONDS : undefined);
    }
    const swellDuck = ALL_AWAKENING_CUES.some((id) => audible.includes(id)) ? SWELL_DUCK : 1;
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
      moving: moving || railWalking || (railFrame !== undefined && railFrame.boarding > 0 && railFrame.boarding < 1), drawing: climbMoment && climbMoment.t >= 0 ? climbMoment.t / CLIMB_MOMENT_SECONDS : undefined, strapping: snowshoeMoment && snowshoeMoment.t >= 0 ? snowshoeMoment.t / SNOWSHOE_MOMENT_SECONDS : getaMoment && getaMoment.t >= 0 ? getaMoment.t / GETA_MOMENT_SECONDS : ashMoment && ashMoment.t >= 0 ? ashMoment.t / ASH_MOMENT_SECONDS : undefined, strapGear: ashMoment ? "ashSandals" : getaMoment ? "geta" : "snowshoes", character: settings.get().character, capabilities: caps, overviewZoom: overviewZoomAt(overviewTime), awakening: scene, wakes,
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
    perfMark("appPost");
    perfEnd(perfDt, perfT0);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => saveGame(state, true);
}
