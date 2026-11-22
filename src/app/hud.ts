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
  /** The name of the landmark being restored, or null. */
  readonly landmarkName: LandmarkNameModel | null;
}

/**
 * A landmark's name, as the pre-rendered brush images in `public/images/landmark-names`: the Japanese
 * name set vertically in the middle of the screen and, in English, the translation beneath it.
 */
export interface LandmarkNameModel {
  readonly id: string;
  /** The name as text, for the images' alt text. */
  readonly label: string;
  /** 0 (invisible) to 1. */
  readonly opacity: number;
  /** Also show the English image below the Japanese one. */
  readonly english: boolean;
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
.hud .lname{position:absolute;inset:0;opacity:0;--em:clamp(28px,10vh,100px)}
.hud .lname::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 34% 52% at 50% 52%,#120c0c8c,#120c0c00)}
.hud .lname .ja{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.hud .lname .en{position:absolute;left:50%;top:50%;transform:translate(-50%,calc(var(--ja-half,120px) + 10px))}
.hud .lname .ja img{max-height:58vh}
.hud .lname img{display:block;max-width:92vw;filter:drop-shadow(0 0 5px #140c0ccc) drop-shadow(0 2px 3px #140c0c99)}
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

  const lname = document.createElement("div");
  lname.className = "lname";
  lname.style.display = "none";
  const jaBox = document.createElement("div");
  jaBox.className = "ja";
  const enBox = document.createElement("div");
  enBox.className = "en";
  const jaImg = document.createElement("img");
  const enImg = document.createElement("img");
  jaBox.appendChild(jaImg);
  enBox.appendChild(enImg);
  lname.append(jaBox, enBox);
  root.appendChild(lname);
  let shownId: string | null = null;
  /** The images were drawn at a fixed glyph size, so every one is scaled by the same factor (relative to `--em`). */
  const GLYPH_PX = 320;
  const sizeToEm = (img: HTMLImageElement): void => {
    if (!img.naturalHeight) return;
    img.style.height = `calc(${img.naturalHeight / GLYPH_PX} * var(--em))`;
    img.style.width = "auto";
  };
  const placeEnglish = (): void => {
    // Sit the English just beneath the Japanese, which stays centred on the screen.
    lname.style.setProperty("--ja-half", `${jaImg.getBoundingClientRect().height / 2}px`);
  };
  jaImg.onload = () => {
    sizeToEm(jaImg);
    placeEnglish();
  };
  enImg.onload = () => sizeToEm(enImg);
  window.addEventListener("resize", placeEnglish);

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

      const n = m.landmarkName;
      if (n) {
        if (n.id !== shownId) {
          shownId = n.id;
          const base = `${import.meta.env.BASE_URL}images/landmark-names/${n.id}`;
          jaImg.src = `${base}.ja.png`;
          enImg.src = `${base}.en.png`;
        }
        jaImg.alt = n.label;
        enImg.alt = n.english ? n.label : "";
        enBox.style.display = n.english ? "block" : "none";
        lname.style.display = "block";
        lname.style.opacity = String(n.opacity);
        if (n.opacity > 0) placeEnglish();
      } else if (lname.style.display !== "none") {
        lname.style.display = "none";
        shownId = null;
      }

      const text = m.hint ?? m.prompt;
      setText(msg, text ?? "");
      msg.style.display = text ? "inline-block" : "none";
    },
  };
}
