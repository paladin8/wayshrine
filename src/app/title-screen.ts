import type { Music } from "../audio";
import { createTitleScene } from "../render";
import { messagesFor } from "./i18n";
import { createGamepadReader } from "./input/gamepad";
import { activateFocused, navigatePanel, pressKey } from "./input/panel-nav";
import { createSettingsPanel } from "./settings-panel";
import { randomSeed, withJourneyLock, type SaveSlot, type SaveStore } from "./saves";
import type { SettingsStore } from "./settings";
import { UI_FONT, setText } from "./style";

/**
 * The game's logo: set this to an image URL (such as "/images/logo.png") and it replaces the placeholder box.
 */
export const LOGO_URL: string | null = `${import.meta.env.BASE_URL}images/wayshrine-logo.png`;

export interface TitleScreen {
  /** Resolves with the journey the player chose to begin or resume. */
  readonly chosen: Promise<{ readonly slot: SaveSlot; readonly isNew: boolean }>;
  destroy(): void;
}

export interface TitleScreenDeps {
  readonly saves: SaveStore;
  readonly onSaveError: () => void;
  readonly flushSaves?: () => Promise<void>;
  readonly canLoad: (slot: SaveSlot) => boolean;
  readonly settings: SettingsStore;
  /** Plays the title theme while the screen is up; the game carries on with the same player. */
  readonly music: Music;
}

/** The theme played on the title screen. */
const TITLE_TRACK = "homeward-breeze";

const INK = "#2a2424";
const RED = "#d96b59";

const WASHI_FIBRES = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85 .35' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .52  0 0 0 0 .40  0 0 0 0 .26  0 0 0 .26 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const CSS = `
@font-face{font-family:"Cormorant Garamond";font-style:italic;font-weight:600;src:url("${import.meta.env.BASE_URL}fonts/cormorant-garamond-600-italic.woff2") format("woff2");font-display:swap}
@font-face{font-family:"Yuji Syuku";src:url("${import.meta.env.BASE_URL}fonts/yuji-syuku-subset.woff2") format("woff2");font-display:swap}
.ts-root{--ts-font:"Cormorant Garamond","Iowan Old Style","Palatino Linotype",Georgia,serif;--ts-track:.03em;--ts-size:23px;font-style:italic;font-weight:600;position:fixed;inset:0;overflow:hidden;background:linear-gradient(#e9b9aa,#f7d9c2 55%,#f8e9d6);font:14px/1.4 ${UI_FONT};color:${INK};z-index:5}
.ts-root:lang(ja){--ts-font:"Yuji Syuku","Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif;--ts-track:.14em;--ts-size:18px;font-style:normal;font-weight:400}
.ts-scene{position:absolute;inset:0;width:100%;height:100%}
.ts-ui{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(14px,3.4vh,34px);padding:16px;box-sizing:border-box}
.ts-logo{width:min(484px,84vw);min-height:clamp(72px,16vh,132px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;border:2px dashed #2a242466;border-radius:14px;background:#fffaf0aa;padding:10px 18px;text-align:center}
.ts-logo .ts-name{font:italic 600 clamp(26px,min(8vh,9vw),64px)/1 "Cormorant Garamond","Iowan Old Style",Georgia,serif;letter-spacing:.06em}
.ts-logo .ts-note{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.5}
.ts-logo img{display:block;max-width:100%;max-height:clamp(90px,24vh,200px)}
.ts-logo.has-image{border:0;background:none;padding:0;min-height:0}
.ts-logo img{filter:drop-shadow(0 1px 0 #fff6e6aa) drop-shadow(0 0 14px #fff1dc99)}
.ts-panel{position:relative;width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:34px 26px 32px;background:${WASHI_FIBRES},linear-gradient(#f8f1e0,#f3e9d2);color:${INK};font-family:var(--ts-font);box-shadow:0 14px 34px #3a22184d,inset 0 0 0 1px #8a654033,inset 0 0 26px #b8946020;display:flex;flex-direction:column;gap:2px}
.ts-panel::before,.ts-panel::after{content:"";position:absolute;left:-11px;right:-11px;height:15px;border-radius:8px;background:linear-gradient(#8a6a4a,#5a4030 55%,#3b2a1f);box-shadow:0 3px 7px #2a1a1470}
.ts-panel::before{top:-9px}
.ts-panel::after{bottom:-9px}
.ts-root .ts-panel .ts-btn{border:0;border-radius:0;background:transparent;padding:10px 8px 9px;font-size:var(--ts-size);letter-spacing:var(--ts-track);position:relative}
.ts-root .ts-panel .ts-btn+.ts-btn{background-image:linear-gradient(90deg,#0000,#5a443655 18%,#5a443655 82%,#0000);background-size:100% 1px;background-repeat:no-repeat;background-position:top}
.ts-root .ts-panel .ts-btn small{font-size:max(12px,calc(var(--ts-size) - 8px));letter-spacing:.08em;opacity:.62}
.ts-root .ts-panel .ts-btn:is(:hover,:focus-visible,[data-controller-focus] :focus){background-color:#d96b5920;color:#a93a2f}
.ts-root .ts-panel .ts-btn:is(:hover,:focus-visible,[data-controller-focus] :focus)::before{content:"";position:absolute;left:12px;top:50%;width:9px;height:9px;margin-top:-4px;background:#c8473a;border-radius:2px;transform:rotate(45deg)}
/* The title menu uses its diamond as the focus cue. Keep the system ring in forced colors. */
@media(forced-colors:none){
  body .ts-root .ts-panel .ts-btn:is(:focus-visible,[data-controller-focus] :focus){outline:none;box-shadow:none}
}
.ts-root .ts-panel .ts-btn.primary{background-color:transparent;color:#a93a2f}
.ts-root .ts-panel .ts-btn.primary::after{content:"";position:absolute;right:12px;top:50%;width:11px;height:11px;margin-top:-5px;border-radius:3px;background:#c8473a;box-shadow:inset 0 0 0 2px #f8f1e0,inset 0 0 0 3px #c8473a}
.ts-root .ts-panel .ts-btn.quiet{color:#5a4436}
.ts-root .ts-panel .ts-btn.quiet:hover,.ts-panel .ts-btn.quiet:focus-visible{background-color:#5a443614;color:${INK}}
.ts-panel .ts-loading{margin:0;text-align:center;font-size:var(--ts-size);letter-spacing:var(--ts-track)}
.ts-btn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:9px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff;text-align:center;font-size:14px}
.ts-btn small{font-size:12px;opacity:.6}
.ts-btn:hover,.ts-btn:focus-visible{background:#f6efe2}
.ts-btn.primary{background:${RED};border-color:${RED};color:#fff}
.ts-btn.primary:hover,.ts-btn.primary:focus-visible{background:#c85d4c;border-color:#c85d4c}
.ts-btn[disabled]{opacity:.4;cursor:default;pointer-events:none}
.ts-btn.quiet{background:transparent;border-color:transparent}
.ts-btn.danger,.ts-root .sp-card .ts-btn.danger{background:#c4140b;border-color:#6e0a05;color:#fff;font-weight:700;text-shadow:0 1px 0 #4d0804;box-shadow:inset 0 1px 0 #ff8a80aa,0 2px 10px #c4140b88}
.ts-btn.danger:hover,.ts-btn.danger:focus-visible,.ts-root .sp-card .ts-btn.danger:hover,.ts-root .sp-card .ts-btn.danger:focus-visible{background:#e3170d;border-color:#6e0a05;color:#fff;box-shadow:inset 0 1px 0 #ffb0a8cc,0 2px 14px #e3170dcc}
.ts-btn.quiet:hover,.ts-btn.quiet:focus-visible{background:#2a242414}
/* the dialogs: the same washi paper, with the rods as bands at the top and bottom */
.ts-root .sp-overlay{background:#2a242466;font-family:var(--ts-font);font-size:calc(var(--ts-size) - 3px)}
.ts-root .sp-card{width:min(600px,calc(100vw - 32px));border:0;border-radius:6px;padding:40px 26px 38px;color:${INK};font-family:var(--ts-font);background:${WASHI_FIBRES},linear-gradient(#8a6a4a,#5a4030 55%,#3b2a1f) top/100% 16px no-repeat,linear-gradient(#8a6a4a,#5a4030 55%,#3b2a1f) bottom/100% 16px no-repeat,linear-gradient(#f8f1e0,#f3e9d2);background-origin:border-box;box-shadow:0 18px 44px #2a1a1470,inset 0 0 0 1px #8a654033}
.ts-root .sp-head{margin-bottom:10px;padding-bottom:8px;background:linear-gradient(90deg,#0000,#5a443666 15%,#5a443666 85%,#0000) bottom/100% 1px no-repeat}
.ts-root .sp-head h2{font:400 calc(var(--ts-size) + 4px)/1.2 var(--ts-font);letter-spacing:var(--ts-track)}
.ts-root .sp-card{line-height:1.3}
.ts-root .sp-howto p{margin:4px 0}
.ts-root .sp-card h3{font:400 calc(var(--ts-size) - 3px)/1.2 var(--ts-font);letter-spacing:var(--ts-track);text-transform:none;opacity:.7;margin:12px 0 6px;color:#a93a2f}
.ts-root .sp-x{border-radius:4px;color:#5a4436}
.ts-root .sp-x:hover{background:#5a443618}
.ts-root .sp-row output,.ts-root .sp-check,.ts-root .sp-row label{letter-spacing:var(--ts-track)}
.ts-root .sp-lang,.ts-root .sp-title-button,.ts-root .sp-card .ts-btn{font-family:var(--ts-font);letter-spacing:var(--ts-track);border:1px solid #5a443655;border-radius:4px;background:#fffaf0b0;color:${INK};font-size:calc(var(--ts-size) - 2px)}
.ts-root .sp-lang:hover,.ts-root .sp-card .ts-btn:hover,.ts-root .sp-card .ts-btn:focus-visible{background:#d96b5926;color:#a93a2f}
.ts-root .sp-lang[aria-pressed=true],.ts-root .sp-card .ts-btn.primary{background:${RED};border-color:#a93a2f;color:#fbf4e4}
.ts-root .sp-card .ts-btn.primary:hover,.ts-root .sp-card .ts-btn.primary:focus-visible{background:#c85d4c;color:#fff}
.ts-root .sp-card .ts-input{font-family:var(--ts-font);font-size:calc(var(--ts-size) - 2px);letter-spacing:var(--ts-track);border:0;border-bottom:1px solid #5a4436;border-radius:2px;background:#fffaf0b0;padding:9px 10px}
.ts-root .sp-card .ts-input:focus{box-shadow:0 1px 0 ${RED};border-bottom-color:${RED}}
.ts-root .ts-label{font-size:calc(var(--ts-size) - 4px);text-transform:none;letter-spacing:var(--ts-track);opacity:.75;color:#a93a2f}
.ts-root .ts-help,.ts-root .ts-credit,.ts-root .sp-howto p{font-size:calc(var(--ts-size) - 5px);opacity:1;color:#4a3a30}
.ts-root .ts-credit.author{font-size:calc(var(--ts-size) - 1px);font-weight:400}
.ts-root .ts-save{border-radius:4px;border:1px solid #5a443640;background:#fffaf0a0}
.ts-root .ts-save b{font-weight:400;font-size:calc(var(--ts-size) - 2px)}
.ts-root .ts-save span{font-size:calc(var(--ts-size) - 6px)}
.ts-dialog-body{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.ts-field{display:flex;flex-direction:column;gap:6px}
.ts-label{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.6}
.ts-input{box-sizing:border-box;width:100%;padding:8px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff;font:inherit;font-size:14px;color:${INK};outline:none;text-transform:none;letter-spacing:normal}
.ts-input:focus{border-color:${RED}}
.ts-help{margin:0;font-size:12px;opacity:.65}
.ts-credit{margin:0;font-size:14px;line-height:1.45}
.ts-credit.author{font-size:15px;font-weight:600}
.ts-credit a{color:#793b29;text-underline-offset:3px}
.ts-notice{margin:0;padding:10px;border-radius:6px;background:#fffbf3;font:14px/1.45 ${UI_FONT};white-space:pre-wrap;overflow-wrap:anywhere}
.ts-list{display:flex;flex-direction:column;gap:8px}
.ts-save{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;border:1px solid #2a242433;background:#fff}
.ts-save b{font-weight:600;word-break:break-all}
.ts-save span{font-size:12px;opacity:.6}
.ts-row{display:flex;gap:8px}
.ts-row .ts-btn{flex:1;padding:7px 10px}
.ts-empty{margin:6px 0;text-align:center;opacity:.65}
.ts-loading{margin:6px 0;text-align:center}
.ts-spinner{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2a242426;border-top-color:${RED};animation:ts-spin .9s linear infinite;transition:opacity .4s ease}
.ts-spinner.done{opacity:0}
.ts-version{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));font-size:14px;letter-spacing:.06em;opacity:.75;pointer-events:none;user-select:none}
.ts-fail{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px}
.ts-fail .ts-panel{text-align:center;line-height:1.5}
@keyframes ts-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ts-spinner{animation-duration:2.4s}}
.ts-vignette{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 1.4s ease;background:linear-gradient(#2a24242e,#2a242400 30%,#2a242400 75%,#2a24244d)}
.ts-vignette.shown{opacity:1}
/* Wide screens: the island, the peak and the sun fill the left of the view, and the logo and menu sit
   in the open water on the right, left of the far-shore pagoda, one above the other at the same width so they share a centre line. */
@media (min-width:760px) and (min-aspect-ratio:5/4){
  .ts-ui{align-items:flex-end;padding:16px clamp(24px,24vw,440px)}
  .ts-panel{width:min(360px,32vw)}
  .ts-logo{width:min(484px,42vw);margin-right:calc((min(360px,32vw) - min(484px,42vw)) / 2)}
  .ts-logo .ts-name{font-size:clamp(18px,min(6.4vh,2.5vw),52px)}
}
@media (orientation:landscape) and (max-height:500px){
  .ts-ui{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);align-items:safe center;gap:clamp(12px,4vw,36px);padding:16px max(23px,env(safe-area-inset-right)) 16px max(23px,env(safe-area-inset-left));overflow:auto}
  .ts-logo,.ts-panel{width:100%;margin:0}
  .ts-logo img{max-height:42dvh;object-fit:contain}
  .ts-panel{padding:14px 12px}
  .ts-root .ts-panel .ts-btn{min-height:40px;padding:4px 12px;font-size:min(var(--ts-size),20px)}
}
`;

/** A dialog like the settings one. `build` fills the body and is run again whenever the language changes. */
interface Dialog {
  isOpen(): boolean;
  open(): void;
  close(): void;
  destroy(): void;
}

function createDialog(
  container: HTMLElement,
  settings: SettingsStore,
  build: (body: HTMLElement, heading: HTMLElement, closeButton: HTMLElement) => void,
): Dialog {
  const overlay = document.createElement("div");
  overlay.className = "sp-overlay";
  const card = document.createElement("div");
  card.className = "sp-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.tabIndex = -1;
  const head = document.createElement("div");
  head.className = "sp-head";
  const heading = document.createElement("h2");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "sp-x";
  close.textContent = "✕";
  head.append(heading, close);
  const body = document.createElement("div");
  body.className = "ts-dialog-body";
  card.append(head, body);
  overlay.appendChild(card);
  container.appendChild(overlay);
  const isOpen = (): boolean => overlay.classList.contains("open");
  let opener: HTMLElement | null = null;
  const render = (): void => build(body, heading, close);
  const api: Dialog = {
    isOpen,
    open() {
      if (!isOpen()) opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      render();
      overlay.classList.add("open");
      (body.querySelector<HTMLElement>("[data-autofocus]") ?? card).focus();
    },
    close() {
      if (!isOpen()) return;
      overlay.classList.remove("open");
      opener?.focus();
      opener = null;
    },
    destroy: () => {
      unsubscribe();
      overlay.remove();
    },
  };
  close.addEventListener("click", api.close);
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) api.close();
  });
  const unsubscribe = settings.subscribe(() => isOpen() && render());
  return api;
}

export function createTitleScreen(container: HTMLElement, { saves, settings, music, canLoad, onSaveError, flushSaves }: TitleScreenDeps): TitleScreen {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "ts-root";
  // The root gradient stays visible until the live backdrop is ready.
  let backdrop = createTitleScene(root, { reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, character: settings.get().character });
  const unsubscribeCharacter = settings.subscribe((s) => backdrop?.setCharacter(s.character));
  const vignette = document.createElement("div");
  vignette.className = "ts-vignette";
  const spinner = document.createElement("div");
  spinner.className = "ts-spinner";
  spinner.setAttribute("role", "status");
  root.append(vignette, spinner);
  const failed = (): void => {
    spinner.remove();
    vignette.remove();
    ui.remove();
    const fail = document.createElement("div");
    fail.className = "ts-fail";
    const box = document.createElement("div");
    box.className = "ts-panel";
    box.textContent = messagesFor(settings.get().language).title.webglRequired;
    fail.appendChild(box);
    root.appendChild(fail);
  };
  const ui = document.createElement("div");
  void (backdrop ? backdrop.ready : Promise.resolve(false)).then((shown) => {
    if (!root.isConnected) return;
    if (!backdrop) {
      failed();
      return;
    }
    if (!shown) {
      backdrop.destroy();
      backdrop = null;
    } else {
      vignette.classList.add("shown");
    }
    spinner.classList.add("done");
    setTimeout(() => spinner.remove(), 500);
  });
  ui.className = "ts-ui";
  const logo = document.createElement("div");
  logo.className = "ts-logo";
  if (LOGO_URL) {
    logo.classList.add("has-image");
    const img = document.createElement("img");
    img.src = LOGO_URL;
    img.alt = "Wayshrine";
    logo.appendChild(img);
  } else {
    const name = document.createElement("div");
    name.className = "ts-name";
    name.textContent = "Wayshrine";
    const note = document.createElement("div");
    note.className = "ts-note";
    logo.append(name, note);
  }
  const panel = document.createElement("div");
  panel.className = "ts-panel";
  ui.append(logo, panel);
  const version = document.createElement("div");
  version.className = "ts-version";
  version.textContent = `v${import.meta.env.WAYSHRINE_VERSION as string}`;
  root.append(ui, version);
  container.appendChild(root);

  const options = createSettingsPanel(root, null, settings, { escapeToggles: false });

  let busy = false;
  let resolve!: (choice: Awaited<TitleScreen["chosen"]>) => void;
  const chosen = new Promise<Awaited<TitleScreen["chosen"]>>((r) => (resolve = r));
  const t = () => messagesFor(settings.get().language).title;

  const button = (label: string, onClick: () => void, className = "", detail?: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `ts-btn ${className}`.trim();
    b.textContent = label;
    if (detail) {
      const small = document.createElement("small");
      small.textContent = detail;
      b.appendChild(small);
    }
    b.addEventListener("click", onClick);
    return b;
  };

  /** Hands the chosen journey on after the screen has had a chance to show that it is loading. */
  const begin = (slot: SaveSlot, isNew = false): void => {
    if (busy || (!isNew && !canLoad(slot))) return;
    busy = true;
    dialogs.forEach((d) => d.close());
    panel.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "ts-loading";
    loading.textContent = t().loading;
    panel.appendChild(loading);
    requestAnimationFrame(() => setTimeout(() => resolve({ slot, isNew }), 30));
  };

  const dateOf = (at: number): string =>
    new Date(at).toLocaleDateString(settings.get().language, { year: "numeric", month: "short", day: "numeric" });

  const credits = createDialog(root, settings, (body, heading, close) => {
    const m = t();
    heading.textContent = m.credits;
    close.setAttribute("aria-label", m.back);
    body.replaceChildren(
      ...m.creditsLines.map((line, i) => {
        const p = document.createElement("p");
        p.className = i === 0 ? "ts-credit author" : "ts-credit";
        p.textContent = line;
        return p;
      }),
      ...(["NOTICE.txt", "LICENSE.txt", "content-license.txt"] as const).flatMap((file, i) => {
        const row = document.createElement("p");
        row.className = "ts-credit";
        const link = document.createElement("a");
        link.href = `${import.meta.env.BASE_URL}notices/${file}`;
        link.textContent = m.creditNotices[i]!;
        const notice = document.createElement("pre");
        notice.className = "ts-notice";
        notice.id = `credit-notice-${i}`;
        notice.hidden = true;
        link.setAttribute("aria-controls", notice.id);
        link.setAttribute("aria-expanded", "false");
        let loaded = false;
        link.addEventListener("click", async (event) => {
          event.preventDefault();
          notice.hidden = !notice.hidden;
          link.setAttribute("aria-expanded", String(!notice.hidden));
          if (notice.hidden || loaded) return;
          notice.textContent = m.loading;
          try {
            const response = await fetch(link.href);
            if (!response.ok) throw new Error(`Notice request failed: ${response.status}`);
            notice.textContent = await response.text();
            loaded = true;
          } catch {
            notice.textContent = m.noticeUnavailable;
          }
        });
        row.appendChild(link);
        return [row, notice];
      }),
    );
  });

  const newGame = createDialog(root, settings, (body, heading, close) => {
    const m = t();
    heading.textContent = m.newGame;
    close.setAttribute("aria-label", m.back);
    const keep = body.querySelector<HTMLInputElement>("input")?.value ?? "";
    const input = document.createElement("input");
    input.className = "ts-input";
    input.type = "text";
    input.placeholder = m.seedPlaceholder;
    input.setAttribute("aria-label", m.seedPlaceholder);
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 64;
    input.value = keep;
    const start = (): void => begin(saves.create(input.value.trim() || randomSeed()), true);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) start();
    });
    const play = button(m.begin, start, "primary");
    play.dataset.autofocus = "";
    body.replaceChildren(input, play);
  });

  const loadGame = createDialog(root, settings, (body, heading, close) => {
    const m = t();
    heading.textContent = m.loadGame;
    close.setAttribute("aria-label", m.back);
    const list = document.createElement("div");
    list.className = "ts-list";
    const all = saves.list();
    if (all.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ts-empty";
      empty.textContent = m.noSaves;
      list.appendChild(empty);
    }
    for (const slot of all) {
      const row = document.createElement("div");
      row.className = "ts-save";
      const title = document.createElement("b");
      title.textContent = m.saveSummary(slot.seed, slot.restored);
      const when = document.createElement("span");
      const time = slot.playtimeMs;
      const minutes = typeof time === "number" && Number.isFinite(time) && time >= 0 ? Math.floor(time / 60_000) : null;
      const playtime = minutes === null ? m.playtimeUnknown : m.playtime(Math.floor(minutes / 60), minutes % 60);
      when.textContent = `${dateOf(slot.playedAt)} · ${playtime}`;
      const actions = document.createElement("div");
      actions.className = "ts-row";
      actions.append(
        button(m.play, () => begin(slot), "primary"),
        button(m.delete, () => {
          row.replaceChildren();
          const ask = document.createElement("b");
          ask.textContent = m.confirmDelete(slot.seed);
          const confirm = document.createElement("div");
          confirm.className = "ts-row";
          // Cancel (plain) on the left, the red delete on the right. Focus starts on the safe choice.
          const cancel = button(m.cancel, () => loadGame.open());
          confirm.append(
            cancel,
            button(m.deleteIt, () => {
              void withJourneyLock(() => saves.remove(slot.id)).then(() => flushSaves?.()).then(() => {
                if (!loadGame.isOpen()) return;
                if (saves.list().length === 0) loadGame.close();
                else loadGame.open();
                renderMenu();
              }).catch(onSaveError);
            }, "danger"),
          );
          row.append(ask, when, confirm);
          cancel.focus();
        }),
      );
      row.append(title, when, actions);
      list.appendChild(row);
    }
    const first = list.querySelector<HTMLElement>(".ts-btn.primary");
    if (first) first.dataset.autofocus = "";
    body.replaceChildren(list);
  });

  const dialogs: readonly Dialog[] = [credits, newGame, loadGame];

  const renderMenu = (): void => {
    root.lang = settings.get().language;
    if (busy) return;
    const m = t();
    const note = logo.querySelector<HTMLElement>(".ts-note");
    if (note) setText(note, m.logoNote);
    panel.replaceChildren();
    const last = saves.last();
    const cont = button(m.continue, () => last && begin(last), "primary", last ? m.continueDetail(last.seed, last.restored) : undefined);
    if (!last) cont.disabled = true;
    const load = button(m.loadGame, () => loadGame.open());
    if (saves.list().length === 0) load.disabled = true;
    const fresh = button(m.newGame, () => newGame.open(), last ? "" : "primary");
    panel.append(cont, fresh, load, button(m.options, () => options.toggle()), button(m.credits, () => credits.open()));
    const desktop = window.wayshrineDesktop;
    if (desktop) panel.append(button(messagesFor(settings.get().language).settings.quitGame, () => { void Promise.resolve().then(() => flushSaves?.()).then(() => desktop.quit()).catch(onSaveError); }, "quiet"));
    if (!options.isOpen() && !dialogs.some((dialog) => dialog.isOpen())) (last ? cont : fresh).focus();
  };

  const onKey = (e: KeyboardEvent): void => {
    music.unlock();
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.code === "KeyN" && !e.repeat && !typing && !busy) settings.update({ muted: !settings.get().muted });
    if (e.code !== "Escape" || e.repeat || busy) return;
    const open = dialogs.find((d) => d.isOpen());
    if (open) open.close();
    else if (options.isOpen()) options.close();
    if (!panel.contains(document.activeElement)) panel.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  };
  const onPointer = (): void => music.unlock();
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", onPointer);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === "wayshrine:slots" || event.key === "wayshrine:lastSlot") renderMenu();
  };
  window.addEventListener("storage", onStorage);
  const unsubscribe = settings.subscribe(renderMenu);
  renderMenu();

  // The theme plays under the menu; the game takes the same player over when it starts.
  music.setVolume(settings.get().musicVolume);
  music.setMuted(settings.get().muted);
  const unsubscribeAudio = settings.subscribe((s) => {
    music.setVolume(s.musicVolume);
    music.setMuted(s.muted);
  });
  music.setTrack(TITLE_TRACK);
  music.unlock();
  let frameId = 0;
  let last = performance.now();
  const pads = createGamepadReader(() => (typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()] : []));
  let enteringSeed = false;
  const tick = (now: number): void => {
    // A controller drives the menu: stick or D-pad moves focus, A presses, B or Menu goes back.
    const pad = pads.poll(now / 1000);
    if (pad.active) music.unlock();
    if (!busy && !enteringSeed) {
      if (pad.nav) navigatePanel(pad.nav, document, root);
      if (pad.pressed.includes("act")) {
        const active = document.activeElement;
        const enterSeed = window.wayshrineDesktop?.enterSeed;
        if (enterSeed && active instanceof HTMLInputElement && active.classList.contains("ts-input")) {
          enteringSeed = true;
          void enterSeed(t().seedPlaceholder, active.value).then((seed) => {
            if (typeof seed === "string" && active.isConnected) active.value = seed.slice(0, active.maxLength);
          }).catch((error) => console.error("Could not open the Steam keyboard", error)).finally(() => { enteringSeed = false; });
        } else activateFocused(document, root);
      }
      if (pad.pressed.includes("back") || pad.pressed.includes("menu")) pressKey("Escape");
    }
    music.update(Math.min(0.1, Math.max(0, now - last) / 1000));
    last = now;
    frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);

  return {
    chosen,
    destroy() {
      cancelAnimationFrame(frameId);
      unsubscribe();
      unsubscribeAudio();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("storage", onStorage);
      options.destroy();
      dialogs.forEach((d) => d.destroy());
      unsubscribeCharacter();
      backdrop?.destroy();
      root.remove();
      style.remove();
    },
  };
}
