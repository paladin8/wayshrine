import { nextFocus, type Direction } from "./actions";

const FOCUSABLE = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/** The topmost open modal dialog, or null. */
export function modalRoot(doc: Document = document): HTMLElement | null {
  const native = [...doc.querySelectorAll<HTMLDialogElement>("dialog:modal")].at(-1);
  if (native) return native;
  const dialogs = [...doc.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].filter((d) => d.getClientRects().length > 0);
  return dialogs.at(-1) ?? null;
}

function controls(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !(el as HTMLButtonElement).disabled && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
  );
}

/** Scripted controller focus still needs a visible cue after the last pointer interaction. */
function showControllerFocus(doc: Document): void {
  const root = doc.documentElement;
  if (root.hasAttribute("data-controller-focus")) return;
  root.setAttribute("data-controller-focus", "");
  doc.addEventListener("pointerdown", () => root.removeAttribute("data-controller-focus"), { capture: true, once: true });
}

/** Moves keyboard focus to the nearest control in a direction inside the top dialog. Returns whether anything is open. */
export function navigatePanel(dir: Direction, doc: Document = document, fallback: HTMLElement | null = null): boolean {
  const root = modalRoot(doc) ?? fallback;
  if (!root) return false;
  const list = controls(root);
  if (list.length === 0) return true;
  const active = doc.activeElement;
  if (active instanceof HTMLInputElement && active.type === "range" && (dir === "left" || dir === "right")) {
    if (dir === "left") active.stepDown();
    else active.stepUp();
    active.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  const from = list.findIndex((el) => el === doc.activeElement);
  const rects = list.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const to = nextFocus(rects, from, dir);
  if (to !== null) {
    showControllerFocus(doc);
    list[to]!.focus({ preventScroll: false });
  }
  return true;
}

/** Activates the focused control in the top dialog (a controller's A button). */
export function activateFocused(doc: Document = document, fallback: HTMLElement | null = null): boolean {
  const root = modalRoot(doc) ?? fallback;
  const el = doc.activeElement;
  if (!root || !(el instanceof HTMLElement) || !root.contains(el) || el === root) return false;
  showControllerFocus(doc);
  el.click();
  return true;
}

/** Dispatches a key press to the window so existing panels handle it as they handle the keyboard. */
export function pressKey(code: string, win: Window = window): void {
  win.dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true, cancelable: true }));
  win.dispatchEvent(new KeyboardEvent("keyup", { code, key: code, bubbles: true, cancelable: true }));
}
