import {
  AWAKENING,
  awakeningFrame,
  capabilitiesOf,
  clearOfObstacles,
  collectMonument,
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
  safePosition,
  skipTarget,
  serialize,
  SHRINE_REACH,
  shrineInReach,
  startPosition,
  type GameState,
  type SaveData,
} from "../game";
import { createCuePlayer, createMusic, trackFor } from "../audio";
import { createStage } from "../render";
import { monumentSpecs } from "../content";
import { createObstacles, createTerrain, createWorld, planMonuments, type Biome, type Point } from "../world";
import { createDebugPanel } from "./debug";
import { createHud } from "./hud";
import { messagesFor } from "./i18n";
import { createMinimap } from "./minimap";
import { createMonumentUi } from "./monuments-ui";
import { createSettingsStore } from "./settings";
import { createSettingsPanel } from "./settings-panel";

const HINT_SECONDS = 1.5;
/** Everything that plays for an awakening: the burst at the wave launch and the swell under the whole sequence. */
const AWAKENING_CUES = ["awakening-burst", "dawn-reverence"] as const;
/** How far the music drops while the awakening swell plays, and how long the swell takes to fade if skipped. */
const SWELL_DUCK = 0.04;
const SWELL_SKIP_FADE = 1.5;

const KEY_UP = ["KeyW", "ArrowUp"];
const KEY_DOWN = ["KeyS", "ArrowDown"];
const KEY_LEFT = ["KeyA", "ArrowLeft"];
const KEY_RIGHT = ["KeyD", "ArrowRight"];
const KEY_ACT = ["KeyE", "Space", "Enter"];
const KEY_MAP = "KeyM";
const KEY_BOOK = "KeyB";
const KEY_MUTE = "KeyN";

function loadGame(seed: string): GameState {
  try {
    const raw = window.localStorage.getItem(`wayshrine:save:${seed}`);
    if (raw) return deserialize(JSON.parse(raw) as SaveData);
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
  const obstacles = createObstacles(terrain, monuments);
  const stage = createStage(container, terrain, monuments);
  const hud = createHud(container);
  const minimap = createMinimap(container, world, (right, up) => stage.groundDirection(right, up), (region) => {
    if (awakening) return;
    // Land on the shrine's plateau, within reach of its gate.
    pos = { x: region.site.x, z: region.site.z + 2 };
    minimap.toggleExpanded();
  });

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
  const panel = createSettingsPanel(container, settings);

  let state = loadGame(seed);
  const monumentUi = createMonumentUi(container, {
    collected: () => state.collected,
    language: () => settings.get().language,
  });
  /** Dialogs own the keyboard while open. */
  const modalOpen = (): boolean => panel.isOpen() || monumentUi.isOpen();
  let drawnCollected = state.collected.length;
  let drawnLanguage = settings.get().language;
  let pos: Point = startPosition(terrain);
  let facing = 0;
  /** The terrain the player just walked into without the means to cross it; shown briefly as a hint. */
  let blockedBy: Biome | null = null;
  let hintLeft = 0;
  /** The restoration sequence in progress, if any; `t` is seconds since it began. */
  let awakening: { regionId: string; t: number } | null = null;
  /** Debug only: fixed sim step per frame (seconds), so slow renderers can step the sequence deterministically. */
  let fixedDt: number | null = null;

  const restore = (id: string): void => {
    state = restoreShrine(state, world.regionById(id));
    saveGame(state);
  };

  if (params.has("debug")) {
    const restoreSpine = (): void => world.spine.forEach((r) => restore(r.id));
    const reset = (next: (s: GameState) => GameState): void => {
      state = next(state);
      saveGame(state);
    };
    const actions = {
      restoreSpine,
      resetShrines: () => {
        awakening = null;
        AWAKENING_CUES.forEach((id) => cues.stop(id, 0.3));
        reset(resetShrines);
        pos = startPosition(terrain); // land reached with lost capabilities may now be cut off
      },
      resetAll: () => {
        awakening = null;
        AWAKENING_CUES.forEach((id) => cues.stop(id, 0.3));
        reset(resetGame);
        pos = startPosition(terrain);
      },
      goToTarget: () => {
        const g = nextShrine(world, state, pos);
        if (g) pos = { x: g.region.site.x, z: g.region.site.z + 3 };
      },
    };
    createDebugPanel(container, actions);
    // Also available from the console: window.wayshrine.
    Object.assign(window, {
      wayshrine: { world, monuments, obstacles, getPos: () => pos, readMonument: (id: string) => { state = collectMonument(state, id); saveGame(state); monumentUi.read(id); }, music, cues, setFixedDt: (d: number | null) => (fixedDt = d), teleport: (x: number, z: number) => (pos = { x, z }), restore, ...actions },
    });
  }

  const fit = (): void => stage.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", fit);
  fit();

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
    if (e.code === KEY_BOOK && !awakening) monumentUi.toggleBook();
    if (e.code === KEY_MUTE) settings.update({ muted: !settings.get().muted });
    if (KEY_ACT.includes(e.code)) {
      if (awakening) {
        // Once the camera has pulled back, the sequence can be skipped to its end.
        if (awakening.t > AWAKENING.zoomOut) {
          awakening.t = skipTarget(awakening.t);
          AWAKENING_CUES.forEach((id) => cues.stop(id, SWELL_SKIP_FADE));
        }
      } else {
        const region = shrineInReach(terrain, pos);
        if (region && !isRestored(state, region)) {
          restore(region.id);
          awakening = { regionId: region.id, t: 0 };
          // Trimmed so the swell peaks at about 8 s, just before the wave finishes filling the region.
          AWAKENING_CUES.forEach((id) => cues.play(id));
        } else {
          const stone = monumentInReach(monuments, pos);
          if (stone && isLegible(state, stone)) {
            state = collectMonument(state, stone.id);
            saveGame(state);
            monumentUi.read(stone.id);
            cues.play("monument-read");
          }
        }
      }
    }
  });
  window.addEventListener("pointerdown", () => music.unlock());
  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = fixedDt ?? Math.min(0.05, (now - last) / 1000);
    last = now;

    const caps = capabilitiesOf(state, world);
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

    let scene: { regionId: string; progress: number; zoom: number } | undefined;
    if (awakening) {
      awakening.t += dt;
      const f = awakeningFrame(awakening.t);
      if (f.done) awakening = null;
      else scene = { regionId: awakening.regionId, progress: f.progress, zoom: f.zoom };
    }

    const prefs = settings.get();
    const t = messagesFor(prefs.language);
    const needed = blockedBy ? requirementOf(blockedBy) : null;
    const hint = blockedBy && needed ? t.blocked(t.capability[needed], t.terrain[blockedBy]) : null;
    const reach = shrineInReach(terrain, pos);
    const stone = awakening ? null : monumentInReach(monuments, pos);
    const prompt = awakening
      ? awakening.t > AWAKENING.zoomOut
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
    }
    const guide = nextShrine(world, state, pos);
    let compass = null;
    if (guide) {
      const s = stage.screenDirection(guide.dx, guide.dz);
      compass = { angle: Math.atan2(s.right, s.up), distance: guide.distance, arrived: guide.distance <= SHRINE_REACH };
    }
    hud.update({
      capabilities: caps,
      restoredCount: state.restored.size,
      compass,
      prompt,
      hint,
      messages: t,
      showCompass: prefs.showCompass,
    });
    minimap.update({ pos, state, target: guide?.region ?? null, visible: prefs.showMinimap, labels: t.map, monuments: debug ? monuments.all : undefined, travelToAny: debug });

    music.setTrack(trackFor(world.regionAt(pos.x, pos.z).biome));
    cues.update(dt);
    // Only the awakening swell ducks the music; the monument chime sits under it at its normal level.
    music.setDuck(AWAKENING_CUES.some((id) => cues.playing().includes(id)) ? SWELL_DUCK : 1);
    music.update(dt);

    stage.render(dt, { player: pos, facing, state, awakening: scene });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
