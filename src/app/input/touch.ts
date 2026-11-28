import { NO_MOVE, type Action, type Move } from "./actions";
import { UI_FONT } from "../style";

export type ActKind = "restore" | "read" | "board" | "skip";

export interface TouchText {
  readonly rotate: string;
  readonly act: Readonly<Record<ActKind, string>>;
  readonly map: string;
  readonly box: string;
  readonly overview: string;
}

export interface TouchControls {
  /** The joystick's current push, in screen space (analog). */
  move(): Move;
  /** Shows the contextual act button with its verb, or hides it. */
  setAct(kind: ActKind | null): void;
  /** Shows or hides all touch controls (hidden while a dialog is open, or when touch is not in use). */
  setVisible(visible: boolean): void;
  setText(text: TouchText): void;
  dispose(): void;
}

const RADIUS = 56;

const CSS = `
.tc{position:fixed;inset:0;pointer-events:none;z-index:5;font:600 15px/1 ${UI_FONT};color:#2a2424;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none}
.tc[hidden]{display:none}
.tc button{touch-action:none;-webkit-tap-highlight-color:transparent;pointer-events:auto}
.tc-act{position:absolute;right:calc(28px + env(safe-area-inset-right,0px));bottom:calc(28px + env(safe-area-inset-bottom,0px));min-width:96px;height:96px;padding:0 18px;border-radius:48px;border:2px solid #2a242433;background:#fffaf0e6;color:inherit;font:inherit;font-size:17px;box-shadow:0 2px 10px #0003}
.tc-act:active{background:#ffe6ad}
.tc-act[hidden]{display:none}
.tc-side{position:absolute;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(140px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px}
@media (orientation:landscape) and (max-height:360px),
       (orientation:landscape) and (max-width:600px) and (max-height:404px){
  .tc-side{top:calc(var(--hud-actions-top,14px) + 44px);bottom:auto;flex-direction:row}
}
.tc-small{min-width:48px;height:48px;padding:0 12px;border-radius:24px;border:1px solid #2a242433;background:#fffaf0d9;color:inherit;font:inherit;font-size:14px}
.tc-small:active{background:#ffe6ad}
.tc-stick{position:absolute;width:${RADIUS * 2}px;height:${RADIUS * 2}px;margin:-${RADIUS}px 0 0 -${RADIUS}px;border-radius:50%;border:2px solid #fffaf0cc;background:#2a242426}
.tc-stick[hidden]{display:none}
.tc-knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:#fffaf0e6;box-shadow:0 1px 6px #0004}
.tc-rotate{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;background:#f2ede0;color:#2a2424;font:600 20px/1.4 ${UI_FONT};text-align:center;pointer-events:auto}
@media (orientation:portrait) and (pointer:coarse) and (max-width:700px){.tc-rotate{display:flex}}
`;

/**
 * Touch controls: a floating joystick under the left thumb, one contextual act button at the bottom right and
 * small buttons for the toggles the HUD does not already have. `onAction` receives the same verbs as the other devices.
 */
export function createTouchControls(container: HTMLElement, onAction: (action: Action) => void, onUse: () => void): TouchControls {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const root = document.createElement("div");
  root.className = "tc";
  root.hidden = true;
  const stick = document.createElement("div");
  stick.className = "tc-stick";
  stick.hidden = true;
  const knob = document.createElement("div");
  knob.className = "tc-knob";
  stick.append(knob);
  const actButton = document.createElement("button");
  actButton.type = "button";
  actButton.className = "tc-act";
  actButton.hidden = true;
  const side = document.createElement("div");
  side.className = "tc-side";
  const mk = (action: Action, glyph: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tc-small";
    b.textContent = glyph;
    b.addEventListener("click", () => onAction(action));
    return b;
  };
  const mapButton = mk("map", "🗺");
  const boxButton = mk("box", "拓");
  const overviewButton = mk("overview", "⌖");
  side.append(mapButton, boxButton, overviewButton);
  actButton.addEventListener("click", () => onAction("act"));
  root.append(stick, side, actButton);
  const rotate = document.createElement("div");
  rotate.className = "tc-rotate";
  container.append(root, rotate);

  let actText: Readonly<Record<ActKind, string>> | undefined;
  let vector: Move = NO_MOVE;
  let pointer: number | null = null;
  let anchor = { x: 0, y: 0 };

  const release = (): void => {
    pointer = null;
    vector = NO_MOVE;
    stick.hidden = true;
  };
  const onDown = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    onUse();
    if (pointer !== null || e.clientX > window.innerWidth * 0.6) return;
    const target = e.target as HTMLElement | null;
    if (!target || !(target instanceof HTMLCanvasElement)) return; // only the world starts a stick, never a panel
    pointer = e.pointerId;
    anchor = { x: e.clientX, y: e.clientY };
    stick.style.left = `${anchor.x}px`;
    stick.style.top = `${anchor.y}px`;
    knob.style.transform = "translate(0,0)";
    stick.hidden = false;
    e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    const dx = e.clientX - anchor.x;
    const dy = e.clientY - anchor.y;
    const len = Math.hypot(dx, dy);
    const k = len > RADIUS ? RADIUS / len : 1;
    knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    const m = Math.min(1, len / RADIUS);
    // A small slop at the centre so a resting thumb does not creep.
    vector = len < 8 ? NO_MOVE : { right: (dx / len) * m, up: (-dy / len) * m };
  };
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId === pointer) release();
  };
  window.addEventListener("pointerdown", onDown, { passive: false });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  // iOS only counts touchend as a gesture that unlocks audio.
  const unlock = (): void => onUse();
  window.addEventListener("touchend", unlock, { passive: true });
  // Stop double-tap zoom and the long-press callout on the playfield.
  const stop = (e: Event): void => {
    if ((e.target as HTMLElement | null)?.closest("input,textarea,[contenteditable]")) return;
    e.preventDefault();
  };
  root.addEventListener("contextmenu", stop);
  container.addEventListener("gesturestart", stop as EventListener);

  return {
    move: () => vector,
    setAct(kind) {
      if (kind === null) {
        if (!actButton.hidden) actButton.hidden = true;
        delete actButton.dataset.kind;
      } else if (actButton.dataset.kind !== kind) {
        actButton.hidden = false;
        actButton.dataset.kind = kind;
        actButton.textContent = actText?.[kind] ?? kind;
      } else if (actButton.hidden) actButton.hidden = false;
    },
    setVisible(visible) {
      if (root.hidden === !visible) return;
      root.hidden = !visible;
      if (!visible) release();
    },
    setText(text) {
      if (actText === text.act && rotate.textContent === text.rotate) return;
      actText = text.act;
      rotate.textContent = text.rotate;
      mapButton.setAttribute("aria-label", text.map);
      boxButton.setAttribute("aria-label", text.box);
      overviewButton.setAttribute("aria-label", text.overview);
      if (!actButton.hidden && actButton.dataset.kind) actButton.textContent = text.act[actButton.dataset.kind as ActKind];
    },
    dispose() {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchend", unlock);
      root.remove();
      rotate.remove();
      style.remove();
    },
  };
}
