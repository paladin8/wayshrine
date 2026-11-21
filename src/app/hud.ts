import { CAPABILITIES, type Capability } from "../world";
import type { Messages } from "./i18n";
import { UI_FONT, setText } from "./style";

export interface CompassModel {
  /** Clockwise angle from screen-up, in radians. */
  readonly angle: number;
  readonly distance: number;
  /** True when the shrine is already within reach. */
  readonly arrived: boolean;
}

export interface HudModel {
  /** Text in the player's language. */
  readonly messages: Messages;
  /** False hides the next-shrine compass (a player setting). */
  readonly showCompass: boolean;
  readonly capabilities: ReadonlySet<Capability>;
  readonly restoredCount: number;
  /** Direction to the nearest reachable unrestored shrine, or null if none. */
  readonly compass: CompassModel | null;
  /** Interaction prompt at the bottom of the screen, or null. */
  readonly prompt: string | null;
  /** Transient hint, e.g. why the player is blocked, or null. */
  readonly hint: string | null;
}

export interface Hud {
  update(model: HudModel): void;
}

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;font:14px/1.3 ${UI_FONT};color:#2a2424}
.hud .chip{display:inline-block;margin-right:6px;padding:4px 10px;border-radius:999px;background:#fffaf0cc;border:1px solid #2a242422}
.hud .chip.off{opacity:.4}
.hud .tl{position:absolute;top:14px;left:14px}
.hud .tr{position:absolute;top:14px;right:14px}
.hud .tc{position:absolute;top:10px;left:50%;transform:translateX(-50%)}
.hud .bc{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);text-align:center}
.hud .msg{display:inline-block;padding:8px 16px;border-radius:10px;background:#2a2424dd;color:#f2ede0}
.hud .compass{display:flex;align-items:center;gap:10px;padding:4px 14px 4px 6px;border-radius:999px;background:#fffaf0cc;border:1px solid #2a242422}
.hud .dial{width:34px;height:34px;border-radius:50%;background:#2a2424;position:relative}
.hud .needle{position:absolute;inset:0;transition:transform .12s linear}
.hud .needle::before{content:"";position:absolute;left:50%;top:4px;margin-left:-5px;border:5px solid transparent;border-bottom:13px solid #ffe9a8;border-top:0}
.hud .dot{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;background:#ffe9a8}
`;

export function createHud(container: HTMLElement): Hud {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "hud";
  const tl = document.createElement("div");
  tl.className = "tl";
  const tr = document.createElement("div");
  tr.className = "tr";
  const tc = document.createElement("div");
  tc.className = "tc";
  const bc = document.createElement("div");
  bc.className = "bc";
  root.append(tl, tr, tc, bc);
  container.appendChild(root);

  const chips = new Map<Capability, HTMLElement>();
  for (const cap of CAPABILITIES) {
    const chip = document.createElement("span");
    chip.className = "chip off";
    tl.appendChild(chip);
    chips.set(cap, chip);
  }
  const count = document.createElement("span");
  count.className = "chip";
  tr.appendChild(count);

  const compass = document.createElement("div");
  compass.className = "compass";
  const dial = document.createElement("div");
  dial.className = "dial";
  const needle = document.createElement("div");
  needle.className = "needle";
  const dot = document.createElement("div");
  dot.className = "dot";
  dial.append(needle, dot);
  const compassText = document.createElement("span");
  compass.append(dial, compassText);
  tc.appendChild(compass);

  const msg = document.createElement("span");
  msg.className = "msg";
  bc.appendChild(msg);

  return {
    update(m) {
      const t = m.messages;
      for (const [cap, chip] of chips) {
        setText(chip, t.capability[cap]);
        chip.classList.toggle("off", !m.capabilities.has(cap));
      }
      setText(count, t.shrinesRestored(m.restoredCount));

      const showCompass = m.showCompass && m.compass !== null;
      compass.style.display = showCompass ? "flex" : "none";
      if (m.compass && showCompass) {
        needle.style.display = m.compass.arrived ? "none" : "block";
        dot.style.display = m.compass.arrived ? "block" : "none";
        needle.style.transform = `rotate(${m.compass.angle}rad)`;
        setText(compassText, m.compass.arrived ? t.compassHere : t.compassNearest(Math.round(m.compass.distance)));
      }

      const text = m.hint ?? m.prompt;
      setText(msg, text ?? "");
      msg.style.display = text ? "inline-block" : "none";
    },
  };
}
