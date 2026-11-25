import { backpackContents } from "./backpack";
import { BACKPACK_ICON } from "./gear-icons";
import type { Locale, Messages } from "./i18n";
import { UI_FONT, setText } from "./style";

export interface HudModel {
  /** Text in the player's language. */
  readonly messages: Messages;
  readonly restoredLandmarks: readonly string[];
  /** Interaction prompt at the bottom of the screen, or null. */
  readonly prompt: string | null;
  /** Transient hint, e.g. why the player is blocked, or null. */
  readonly hint: string | null;
  /** The name of the landmark being restored, or null. */
  readonly landmarkName: LandmarkNameModel | null;
  /** The small name shown near the bottom while the player is close to a restored landmark, or null. */
  readonly nearLandmarkName?: LandmarkNameModel | null;
  readonly gearReveal: { readonly gear: keyof Messages["gearReveal"]; readonly locale: Locale } | null;
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
  /** The buttons at the top right. */
  readonly actions: HTMLElement;
  /** The buttons at the top left: the backpack, the journal and the rubbing box, in that order. */
  readonly topLeft: HTMLElement;
  /** Opens the backpack. */
  readonly backpackButton: HTMLButtonElement;
  /** The landmark counter; clicking it opens the travel notebook. */
  readonly landmarkButton: HTMLButtonElement;
  update(model: HudModel): void;
}

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;font:14px/1.3 ${UI_FONT};color:#2a2424}
.hud .chip{display:inline-block;margin-right:6px;padding:4px 10px;border-radius:999px;background:#fffaf0cc;border:1px solid #2a242422}
.hud .hud-action{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;height:34px;padding:0;border-radius:999px;background:#fffaf0cc;border:1px solid #2a242422;color:inherit;font:inherit;cursor:pointer;pointer-events:auto}
.hud .hud-action:hover,.hud .hud-action[aria-expanded=true]{background:#fffaf0}
.hud .landmark-count{gap:6px;padding:0 10px;font-variant-numeric:tabular-nums}
.hud .landmark-book-icon{font-size:17px;line-height:1}
.hud .tl{position:absolute;top:14px;left:14px;display:flex;align-items:center;gap:8px}
.hud .tr{--actions-top:14px;position:absolute;top:var(--actions-top);right:14px;display:flex;align-items:center;gap:8px}
@media(max-width:600px){.hud .tr{--actions-top:56px}}
.hud .bc{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);text-align:center}
.hud .msg{display:inline-block;padding:8px 16px;border-radius:10px;background:#2a2424dd;color:#f2ede0}
.hud .lname{position:absolute;inset:0;opacity:0;--em:clamp(28px,10vh,100px)}
.hud .lname::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 34% 52% at 50% 52%,#120c0c8c,#120c0c00)}
.hud .lname .ja{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.hud .lname .en{position:absolute;left:50%;top:50%;transform:translate(-50%,calc(var(--ja-half,120px) + clamp(20px,4vh,44px)))}
.hud .lname .ja img{max-height:58vh}
.hud .lname img{display:block;max-width:92vw;filter:drop-shadow(0 0 5px #140c0ccc) drop-shadow(0 2px 3px #140c0c99)}
.hud .lname.near{inset:auto 0 clamp(64px,10vh,110px) 0;display:flex;flex-direction:column;align-items:center;gap:clamp(4px,1vh,10px);pointer-events:none;--em:clamp(11px,3.4vh,34px)}
.hud .lname.near::before{display:none}
.hud .lname.near .ja,.hud .lname.near .en{position:static;transform:none}
.hud .lname.near .ja img{max-height:30vh}
.hud .gear-reveal{position:absolute;bottom:clamp(76px,15vh,132px);left:50%;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:calc(100vw - 38px);padding:12px 20px 14px;text-align:center;border:1px solid #e6c68a85;border-radius:4px;background:#332419ee;color:#fff4d5;box-shadow:0 7px 21px #19100973}
.hud .gear-reveal strong{display:block;margin-bottom:4px;font:400 25px/1.15 "Kaushan Script",cursive;color:#ffdfa3}
.hud .gear-reveal:lang(ja) strong{font-family:"Yuji Syuku",serif}
.hud .gear-reveal:not([hidden]){animation:gear-reveal .25s ease-out}
@keyframes gear-reveal{from{opacity:0;translate:0 6px}to{opacity:1;translate:0 0}}
@media(prefers-reduced-motion:reduce){.hud .gear-reveal:not([hidden]){animation:none}}
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
  const bc = document.createElement("div");
  bc.className = "bc";
  root.append(tl, tr, bc);
  container.appendChild(root);

  const backpackButton = document.createElement("button");
  backpackButton.type = "button";
  backpackButton.className = "hud-action backpack-button";
  const backpackIcon = document.createElement("span");
  backpackIcon.className = "backpack-icon";
  backpackIcon.innerHTML = BACKPACK_ICON;
  const backpackCount = document.createElement("span");
  backpackCount.className = "backpack-count";
  backpackButton.append(backpackIcon, backpackCount);
  tl.appendChild(backpackButton);
  const count = document.createElement("button");
  count.type = "button";
  count.className = "hud-action landmark-count";
  count.setAttribute("aria-haspopup", "dialog");
  const bookIcon = document.createElement("span");
  bookIcon.className = "landmark-book-icon";
  bookIcon.setAttribute("aria-hidden", "true");
  bookIcon.textContent = "📖";
  const countValue = document.createElement("span");
  count.append(bookIcon, countValue);

  tl.appendChild(count);

  let renderedLandmarks: readonly string[] | undefined;
  let renderedLandmarkMessages: Messages | undefined;

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

  // The same name again, smaller and near the bottom, while the player is by a restored landmark.
  const near = document.createElement("div");
  near.className = "lname near";
  near.style.display = "none";
  const nearJaBox = document.createElement("div");
  nearJaBox.className = "ja";
  const nearEnBox = document.createElement("div");
  nearEnBox.className = "en";
  const nearJa = document.createElement("img");
  const nearEn = document.createElement("img");
  nearJaBox.appendChild(nearJa);
  nearEnBox.appendChild(nearEn);
  near.append(nearJaBox, nearEnBox);
  root.appendChild(near);
  let nearShownId: string | null = null;
  const gearReveal = document.createElement("div");
  gearReveal.className = "gear-reveal";
  gearReveal.hidden = true;
  gearReveal.setAttribute("role", "status");
  const gearTitle = document.createElement("strong");
  const gearHint = document.createElement("span");
  gearReveal.append(gearTitle, gearHint);
  root.append(gearReveal);
  /** The images were drawn at a fixed glyph size, so every one is scaled by the same factor (relative to `--em`). */
  const GLYPH_PX = 320;
  const sizeToEm = (img: HTMLImageElement): void => {
    if (!img.naturalHeight) return;
    img.style.height = `calc(${img.naturalHeight / GLYPH_PX} * var(--em))`;
    img.style.width = "auto";
  };
  const placeEnglish = (): void => {
    // Space the English below the Japanese, which stays centred on the screen.
    lname.style.setProperty("--ja-half", `${jaImg.getBoundingClientRect().height / 2}px`);
  };
  jaImg.onload = () => {
    sizeToEm(jaImg);
    placeEnglish();
  };
  enImg.onload = () => sizeToEm(enImg);
  nearJa.onload = () => sizeToEm(nearJa);
  nearEn.onload = () => sizeToEm(nearEn);
  window.addEventListener("resize", placeEnglish);

  return {
    actions: tr,
    topLeft: tl,
    backpackButton,
    landmarkButton: count,
    update(m) {
      const t = m.messages;
      if (m.gearReveal) {
        gearReveal.lang = m.gearReveal.locale;
        const message = t.gearReveal[m.gearReveal.gear];
        setText(gearTitle, message.title);
        setText(gearHint, message.hint);
      }
      gearReveal.hidden = m.gearReveal === null;
      setText(backpackCount, String(backpackContents(m.restoredLandmarks.length).held.length));
      if (renderedLandmarks !== m.restoredLandmarks || renderedLandmarkMessages !== t) {
        renderedLandmarks = m.restoredLandmarks;
        renderedLandmarkMessages = t;
        const landmarkCount = m.restoredLandmarks.length;
        setText(countValue, String(landmarkCount));
        count.title = `${t.notebook.title} (J)`;
        count.setAttribute("aria-label", `${count.title} · ${t.landmarksRestored(landmarkCount)}`);
        count.title = `${t.notebook.title} (J)`;
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

      const nn = m.nearLandmarkName ?? null;
      if (nn) {
        if (nn.id !== nearShownId) {
          nearShownId = nn.id;
          const base = `${import.meta.env.BASE_URL}images/landmark-names/${nn.id}`;
          nearJa.src = `${base}.ja.png`;
          nearEn.src = `${base}.en.png`;
        }
        nearJa.alt = nn.label;
        nearEn.alt = nn.english ? nn.label : "";
        nearEnBox.style.display = nn.english ? "block" : "none";
        near.style.display = "flex";
        near.style.opacity = String(nn.opacity);
      } else if (near.style.display !== "none") {
        near.style.display = "none";
        nearShownId = null;
      }

      const text = m.hint ?? m.prompt;
      setText(msg, text ?? "");
      msg.style.display = text ? "inline-block" : "none";
    },
  };
}
