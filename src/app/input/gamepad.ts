import { NO_MOVE, stickMove, type Action, type Direction, type Move } from "./actions";

/** The subset of the browser's Gamepad the reader needs. */
export interface PadLike {
  readonly id: string;
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value?: number }[];
}

export interface GamepadFrame {
  /** Left stick or D-pad, in screen space. */
  readonly move: Move;
  /** Buttons that went down this frame. */
  readonly pressed: readonly Action[];
  /** Menu navigation: fires on a press, then repeats while held. */
  readonly nav: Direction | null;
  /** Right stick, for panning the map. */
  readonly look: Move;
  /** Trigger pressure for zooming the map, -1 (zoom out, LT) to 1 (zoom in, RT) when held with the map open. */
  readonly zoom: number;
  /** Any button, stick or D-pad was used this frame. */
  readonly active: boolean;
  /** Whether the pad id looks like a PlayStation controller. */
  readonly playstation: boolean;
}

/** Standard-mapping button indices. */
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, VIEW = 8, MENU = 9, L3 = 10, R3 = 11;
const DPAD_UP = 12, DPAD_DOWN = 13, DPAD_LEFT = 14, DPAD_RIGHT = 15;

const BUTTON_ACTIONS: readonly (readonly [number, Action])[] = [
  [A, "act"], [B, "back"], [Y, "journal"], [X, "backpack"], [LB, "pagePrev"], [RB, "pageNext"],
  [VIEW, "map"], [MENU, "menu"], [L3, "overview"], [R3, "overview"], [RT, "box"],
];

const NAV_FIRST_DELAY = 0.4;
const NAV_REPEAT = 0.12;
const NAV_THRESHOLD = 0.55;

export const isPlaystation = (id: string): boolean => /054c|dualsense|dualshock|playstation/i.test(id);

export interface GamepadReader {
  /** Reads the first connected pad. `now` is in seconds. */
  poll(now: number): GamepadFrame;
}

const IDLE: GamepadFrame = { move: NO_MOVE, pressed: [], nav: null, look: NO_MOVE, zoom: 0, active: false, playstation: false };

export function createGamepadReader(getPads: () => readonly (PadLike | null)[]): GamepadReader {
  let down = new Set<number>();
  let navDir: Direction | null = null;
  let navNext = 0;

  return {
    poll(now) {
      const pad = getPads().find((p): p is PadLike => p !== null && p !== undefined && p.connected);
      if (!pad) {
        down = new Set();
        navDir = null;
        return IDLE;
      }
      const held = new Set<number>();
      pad.buttons.forEach((b, i) => {
        if (b.pressed) held.add(i);
      });
      const pressed: Action[] = [];
      for (const [index, action] of BUTTON_ACTIONS) {
        if (held.has(index) && !down.has(index) && !pressed.includes(action)) pressed.push(action);
      }
      down = held;

      const stick = stickMove(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const dx = (held.has(DPAD_RIGHT) ? 1 : 0) - (held.has(DPAD_LEFT) ? 1 : 0);
      const dy = (held.has(DPAD_UP) ? 1 : 0) - (held.has(DPAD_DOWN) ? 1 : 0);
      const dpad: Move = dx !== 0 || dy !== 0 ? { right: dx / Math.hypot(dx, dy), up: dy / Math.hypot(dx, dy) } : NO_MOVE;
      const move = Math.hypot(dpad.right, dpad.up) >= Math.hypot(stick.right, stick.up) && (dx !== 0 || dy !== 0) ? dpad : stick;

      // Menu navigation picks the dominant axis of whichever of stick or D-pad is pushed hardest.
      let want: Direction | null = null;
      const nx = dx !== 0 || dy !== 0 ? dpad.right : (pad.axes[0] ?? 0);
      const ny = dx !== 0 || dy !== 0 ? -dpad.up : (pad.axes[1] ?? 0);
      if (Math.max(Math.abs(nx), Math.abs(ny)) >= NAV_THRESHOLD) {
        want = Math.abs(nx) >= Math.abs(ny) ? (nx > 0 ? "right" : "left") : ny > 0 ? "down" : "up";
      }
      let nav: Direction | null = null;
      if (want === null) navDir = null;
      else if (want !== navDir) {
        navDir = want;
        nav = want;
        navNext = now + NAV_FIRST_DELAY;
      } else if (now >= navNext) {
        nav = want;
        navNext = now + NAV_REPEAT;
      }

      const look = stickMove(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const zoom = (pad.buttons[RT]?.value ?? 0) - (pad.buttons[LT]?.value ?? 0);
      const active = pressed.length > 0 || held.size > 0 || Math.hypot(move.right, move.up) > 0 || Math.hypot(look.right, look.up) > 0;
      return { move, pressed, nav, look, zoom, active, playstation: isPlaystation(pad.id) };
    },
  };
}
