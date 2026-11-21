import {
  capabilitiesOf,
  deserialize,
  isRestored,
  movePlayer,
  newGame,
  requirementOf,
  restoreShrine,
  serialize,
  shrineInReach,
  startPosition,
  type GameState,
  type SaveData,
} from "../game";
import { createStage } from "../render";
import { createTerrain, createWorld, type Biome, type Point } from "../world";
import { createHud, labelOf } from "./hud";

const HINT_SECONDS = 1.5;

const KEY_UP = ["KeyW", "ArrowUp"];
const KEY_DOWN = ["KeyS", "ArrowDown"];
const KEY_LEFT = ["KeyA", "ArrowLeft"];
const KEY_RIGHT = ["KeyD", "ArrowRight"];
const KEY_ACT = ["KeyE", "Space", "Enter"];

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
  const stage = createStage(container, terrain);
  const hud = createHud(container);

  let state = loadGame(seed);
  let pos: Point = startPosition(terrain);
  let facing = 0;
  let hint: string | null = null;
  let hintLeft = 0;

  const restore = (id: string): void => {
    state = restoreShrine(state, world.regionById(id));
    saveGame(state);
  };

  if (params.has("debug")) {
    // Developer hooks: ?debug exposes window.wayshrine for teleporting and restoring.
    Object.assign(window, {
      wayshrine: {
        world,
        teleport: (x: number, z: number) => (pos = { x, z }),
        restore,
        restoreSpine: () => world.spine.forEach((r) => restore(r.id)),
      },
    });
  }

  const fit = (): void => stage.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", fit);
  fit();

  const down = new Set<string>();
  const any = (codes: readonly string[]): number => (codes.some((c) => down.has(c)) ? 1 : 0);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    down.add(e.code);
    if (KEY_ACT.includes(e.code)) {
      const region = shrineInReach(terrain, pos);
      if (region && !isRestored(state, region)) restore(region.id);
    }
  });
  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());

  const blockedMessage = (biome: Biome): string => {
    const needed = requirementOf(biome);
    return needed ? `You need the ${labelOf(needed).toLowerCase()} to cross ${biome}.` : "";
  };

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const caps = capabilitiesOf(state, world);
    const right = any(KEY_RIGHT) - any(KEY_LEFT);
    const up = any(KEY_UP) - any(KEY_DOWN);
    if (right !== 0 || up !== 0) {
      const dir = stage.groundDirection(right, up);
      const moved = movePlayer(pos, dir, dt, terrain, caps);
      pos = moved.pos;
      facing = Math.atan2(dir.x, dir.z);
      if (moved.blockedBy) {
        hint = blockedMessage(moved.blockedBy);
        hintLeft = HINT_SECONDS;
      }
    }
    hintLeft = Math.max(0, hintLeft - dt);
    if (hintLeft === 0) hint = null;

    const reach = shrineInReach(terrain, pos);
    const prompt = reach && !isRestored(state, reach) ? "Press E to restore the shrine" : null;
    hud.update({ capabilities: caps, restoredCount: state.restored.size, prompt, hint });

    stage.render(dt, { player: pos, facing, state });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
