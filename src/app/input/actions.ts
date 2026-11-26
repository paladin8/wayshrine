/** The game's verbs. Devices produce these; game code never sees a key code, a button or a touch. */
export type Action =
  | "act" | "back" | "menu" | "map" | "journal" | "backpack" | "box"
  | "overview" | "mute" | "pagePrev" | "pageNext";

export type Device = "keyboard" | "gamepad" | "touch";

export type Direction = "up" | "down" | "left" | "right";

export const DEAD_ZONE = 0.2;
/** The slowest walk a light stick push gives, as a share of full speed. */
export const MIN_WALK_SCALE = 0.35;

export interface Move {
  /** Screen-space direction: right and up, each in -1..1, length at most 1. */
  readonly right: number;
  readonly up: number;
}

export const NO_MOVE: Move = { right: 0, up: 0 };

/** Applies a radial dead zone and rescales so the stick ramps up smoothly from the edge of the zone. */
export function stickMove(x: number, y: number, deadZone = DEAD_ZONE): Move {
  const len = Math.hypot(x, y);
  if (!(len > deadZone)) return NO_MOVE;
  const scaled = Math.min(1, (len - deadZone) / (1 - deadZone));
  return { right: (x / len) * scaled, up: (-y / len) * scaled };
}

/** How fast to walk for a move: constant for a digital input, a light push walks. */
export function walkScale(move: Move): number {
  const m = Math.min(1, Math.hypot(move.right, move.up));
  if (m <= 0) return 0;
  return m >= 0.999 ? 1 : MIN_WALK_SCALE + (1 - MIN_WALK_SCALE) * m;
}

/** The larger of two moves, so a held key and a stick do not add up. */
export function strongest(a: Move, b: Move): Move {
  return Math.hypot(b.right, b.up) > Math.hypot(a.right, a.up) ? b : a;
}

export interface FocusRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Spatial navigation: the index of the control nearest to `from` in a direction, or null. Controls that
 * overlap `from` along the travel axis score better than ones far off to the side.
 */
export function nextFocus(rects: readonly FocusRect[], from: number, dir: Direction): number | null {
  if (rects.length === 0) return null;
  if (from < 0 || from >= rects.length) return 0;
  const a = rects[from]!;
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  let best: number | null = null;
  let bestScore = Infinity;
  rects.forEach((r, i) => {
    if (i === from) return;
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const dx = c.x - ac.x;
    const dy = c.y - ac.y;
    const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    if (along <= 0.5) return;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** What to call the act control on a device, for the prompts. */
export function actLabel(device: Device, language: "en" | "ja"): string {
  if (language === "ja") return device === "keyboard" ? "Eキー" : device === "gamepad" ? "Aボタン" : "ボタン";
  return device === "keyboard" ? "E" : device === "gamepad" ? "A" : "the button";
}

/** Fills the `{act}` placeholder of a prompt for the device in use. */
export function formatPrompt(template: string, device: Device, language: "en" | "ja"): string {
  return template.replace("{act}", actLabel(device, language));
}
