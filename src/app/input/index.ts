import { NO_MOVE, strongest, type Action, type Device, type Direction, type Move } from "./actions";
import { createGamepadReader, type GamepadFrame } from "./gamepad";
import { createTouchControls, type TouchControls } from "./touch";

export { actLabel, formatPrompt, walkScale, type Action, type Device, type Direction, type Move } from "./actions";
export { activateFocused, modalRoot, navigatePanel, pressKey } from "./panel-nav";
export type { ActKind, TouchText } from "./touch";

export interface InputHandlers {
  /** A verb fired by a gamepad button or a touch button. Keyboard verbs stay with the keyboard handler. */
  onAction(action: Action, device: Device): void;
  /** Menu navigation from a gamepad stick or D-pad. */
  onNav(dir: Direction): void;
  /** Any user gesture, for unlocking audio. */
  onUse(): void;
}

export interface Input {
  /** The device that produced input most recently. */
  device(): Device;
  /** True when the pad in use looks like a PlayStation controller. */
  playstation(): boolean;
  onDeviceChange(cb: (device: Device) => void): () => void;
  /** Reads the gamepad; call once per frame before game logic. Returns the analog move from pad and touch. */
  poll(now: number): { readonly move: Move; readonly pad: GamepadFrame };
  readonly touch: TouchControls;
  /** Records that the keyboard was used. */
  keyboardUsed(): void;
}

export function createInput(container: HTMLElement, handlers: InputHandlers): Input {
  let device: Device = window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "keyboard";
  let playstation = false;
  const listeners = new Set<(d: Device) => void>();
  const setDevice = (d: Device): void => {
    if (d === device) return;
    device = d;
    listeners.forEach((cb) => cb(d));
  };
  const reader = createGamepadReader(() => (typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()] : []));
  const touch = createTouchControls(container, (a) => handlers.onAction(a, "touch"), () => {
    setDevice("touch");
    handlers.onUse();
  });
  return {
    device: () => device,
    playstation: () => playstation,
    onDeviceChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    keyboardUsed: () => setDevice("keyboard"),
    touch,
    poll(now) {
      const pad = reader.poll(now);
      if (pad.active) {
        playstation = pad.playstation;
        setDevice("gamepad");
        handlers.onUse();
      }
      for (const a of pad.pressed) handlers.onAction(a, "gamepad");
      if (pad.nav) handlers.onNav(pad.nav);
      return { move: strongest(pad.move, device === "touch" ? touch.move() : NO_MOVE), pad };
    },
  };
}
