import type { Music } from "../audio";
import { messagesFor } from "./i18n";
import { createSettingsPanel } from "./settings-panel";
import { randomSeed, type SaveSlot, type SaveStore } from "./saves";
import type { SettingsStore } from "./settings";
import { UI_FONT, setText } from "./style";

/**
 * The game's logo: set this to an image URL (such as "/images/logo.png") and it replaces the placeholder box.
 */
export const LOGO_URL: string | null = null;

export interface TitleScreen {
  /** Resolves with the journey the player chose to begin or resume. */
  readonly chosen: Promise<SaveSlot>;
  destroy(): void;
}

export interface TitleScreenDeps {
  readonly saves: SaveStore;
  readonly settings: SettingsStore;
  /** Plays the title theme while the screen is up; the game carries on with the same player. */
  readonly music: Music;
}

/** The theme played on the title screen. */
const TITLE_TRACK = "homeward-breeze";

const INK = "#2a2424";
const RED = "#d96b59";

const CSS = `
.ts-root{position:fixed;inset:0;overflow:hidden;background:#f2ede0;font:14px/1.4 ${UI_FONT};color:${INK};z-index:5}
.ts-scene{position:absolute;inset:0;width:100%;height:100%}
.ts-ui{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(14px,3.4vh,34px);padding:16px;box-sizing:border-box}
.ts-logo{width:min(440px,84vw);min-height:clamp(72px,16vh,132px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;border:2px dashed #2a242466;border-radius:14px;background:#fffaf0aa;padding:10px 18px;text-align:center}
.ts-logo .ts-name{font:600 clamp(28px,6.4vh,52px)/1 Georgia,"Hiragino Mincho ProN","Yu Mincho",serif;letter-spacing:.32em;padding-left:.32em}
.ts-logo .ts-note{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.5}
.ts-logo img{display:block;max-width:100%;max-height:clamp(90px,24vh,200px)}
.ts-logo.has-image{border:0;background:none;padding:0}
.ts-panel{width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:18px 20px 20px;border-radius:16px;background:#fffaf0;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 220px);overflow:auto}
.ts-btn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:9px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff;text-align:center;font-size:14px}
.ts-btn small{font-size:12px;opacity:.6}
.ts-btn:hover,.ts-btn:focus-visible{background:#f6efe2}
.ts-btn:focus-visible{outline:2px solid ${RED};outline-offset:1px}
.ts-btn.primary{background:${RED};border-color:${RED};color:#fff}
.ts-btn.primary:hover,.ts-btn.primary:focus-visible{background:#c85d4c;border-color:#c85d4c}
.ts-btn[disabled]{opacity:.4;cursor:default;pointer-events:none}
.ts-btn.quiet{background:transparent;border-color:transparent}
.ts-btn.quiet:hover,.ts-btn.quiet:focus-visible{background:#2a242414}
.ts-field{display:flex;flex-direction:column;gap:6px}
.ts-label{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.6}
.ts-input{box-sizing:border-box;width:100%;padding:8px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff;font:inherit;font-size:14px;color:${INK};outline:none;text-transform:none;letter-spacing:normal}
.ts-input:focus{border-color:${RED}}
.ts-help{margin:0;font-size:12px;opacity:.65}
.ts-credit{margin:8px 0;font-size:13px;line-height:1.45}
.ts-credit.author{font-size:15px;font-weight:600}
.ts-list{display:flex;flex-direction:column;gap:8px}
.ts-save{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;border:1px solid #2a242433;background:#fff}
.ts-save b{font-weight:600;word-break:break-all}
.ts-save span{font-size:12px;opacity:.6}
.ts-row{display:flex;gap:8px}
.ts-row .ts-btn{flex:1;padding:7px 10px}
.ts-empty{margin:6px 0;text-align:center;opacity:.65}
.ts-loading{margin:6px 0;text-align:center}
.ts-sun{animation:ts-breathe 9s ease-in-out infinite;transform-origin:1090px 300px}
.ts-shimmer{stroke-dasharray:28 46;animation:ts-shimmer 7s linear infinite}
.ts-lantern{animation:ts-bob 5s ease-in-out infinite}
.ts-petal{animation:ts-fall linear infinite}
.ts-mist{animation:ts-mist 26s ease-in-out infinite alternate}
@keyframes ts-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
@keyframes ts-shimmer{to{stroke-dashoffset:-148}}
@keyframes ts-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes ts-fall{from{transform:translate(0,-60px) rotate(0)}to{transform:translate(-160px,980px) rotate(320deg)}}
@keyframes ts-mist{from{transform:translateX(-40px)}to{transform:translateX(40px)}}
@media (prefers-reduced-motion:reduce){.ts-sun,.ts-shimmer,.ts-lantern,.ts-petal,.ts-mist{animation:none}}
`;

interface Mountain {
  readonly x: number;
  readonly peak: number;
  readonly half: number;
  readonly lean?: number;
  readonly light: string;
  readonly dark: string;
  readonly snow?: boolean;
}

/** A faceted mountain: a lit left face and a shaded right face meeting along a ridge, with an optional snow cap. */
function mountain({ x, peak, half, lean = 0.12, light, dark, snow }: Mountain, base: number): string {
  const ridge = x + half * lean;
  const parts = [
    `<polygon points="${x - half},${base} ${x},${peak} ${ridge},${base}" fill="${light}"/>`,
    `<polygon points="${ridge},${base} ${x},${peak} ${x + half},${base}" fill="${dark}"/>`,
  ];
  if (snow) {
    const cap = (base - peak) * 0.27;
    const w = (half * cap) / (base - peak);
    parts.push(
      `<polygon points="${x - w},${peak + cap} ${x},${peak} ${x + w * lean},${peak + cap * 0.86}" fill="#fbf6ee"/>`,
      `<polygon points="${x + w * lean},${peak + cap * 0.86} ${x},${peak} ${x + w},${peak + cap}" fill="#dfe3e6"/>`,
    );
  }
  return parts.join("");
}

function pine(x: number, base: number, height: number, width: number, fill: string, shade: string): string {
  const tiers = 4;
  const out = [`<rect x="${x - width * 0.05}" y="${base - height * 0.08}" width="${width * 0.1}" height="${height * 0.1}" fill="${shade}"/>`];
  for (let i = 0; i < tiers; i++) {
    const top = base - height + (i * height * 0.8) / tiers;
    const bottom = top + (height * 0.46);
    const w = width * (0.38 + (i * 0.62) / (tiers - 1)) * 0.5;
    out.push(
      `<polygon points="${x - w},${bottom} ${x},${top} ${x + w * 0.1},${bottom}" fill="${fill}"/>`,
      `<polygon points="${x + w * 0.1},${bottom} ${x},${top} ${x + w},${bottom}" fill="${shade}"/>`,
    );
  }
  return out.join("");
}

function torii(cx: number, waterY: number): string {
  const post = (x: number): string =>
    `<polygon points="${x - 11},${waterY} ${x - 8},${waterY - 168} ${x + 8},${waterY - 168} ${x + 11},${waterY}" fill="${RED}"/>` +
    `<polygon points="${x + 3},${waterY} ${x + 8},${waterY - 168} ${x + 11},${waterY}" fill="#a93a2f"/>`;
  const gate =
    `<polygon points="${cx - 108},${waterY - 188} ${cx - 82},${waterY - 168} ${cx + 82},${waterY - 168} ${cx + 108},${waterY - 188} ${cx + 96},${waterY - 176} ${cx - 96},${waterY - 176}" fill="${INK}"/>` +
    `<polygon points="${cx - 104},${waterY - 188} ${cx + 104},${waterY - 188} ${cx + 92},${waterY - 200} ${cx - 92},${waterY - 200}" fill="#3a3232"/>` +
    `<rect x="${cx - 84}" y="${waterY - 142}" width="168" height="10" fill="${RED}"/>` +
    `<rect x="${cx - 84}" y="${waterY - 132}" width="168" height="4" fill="#a93a2f"/>` +
    `<rect x="${cx - 7}" y="${waterY - 168}" width="14" height="26" fill="#a93a2f"/>`;
  return post(cx - 62) + post(cx + 62) + gate;
}

function lantern(x: number, y: number, delay: number): string {
  return `<g class="ts-lantern" style="animation-delay:${delay}s"><rect x="${x - 7}" y="${y - 9}" width="14" height="14" rx="2" fill="#f6c36a"/><rect x="${x - 7}" y="${y - 9}" width="14" height="14" rx="2" fill="#fff3c8" opacity=".55"/><rect x="${x - 9}" y="${y + 4}" width="18" height="3" fill="${INK}" opacity=".7"/><circle cx="${x}" cy="${y - 2}" r="22" fill="#f6c36a" opacity=".2"/></g>`;
}

function scene(): string {
  const horizon = 610;
  const far: Mountain[] = [
    { x: 160, peak: 400, half: 260, light: "#c4ced4", dark: "#aebbc3" },
    { x: 540, peak: 440, half: 240, light: "#c4ced4", dark: "#aebbc3" },
    { x: 1330, peak: 410, half: 300, light: "#c4ced4", dark: "#aebbc3" },
    { x: 1580, peak: 470, half: 220, light: "#c4ced4", dark: "#aebbc3" },
  ];
  const mid: Mountain[] = [
    { x: 820, peak: 330, half: 400, lean: 0.1, light: "#9fb0ba", dark: "#8195a2", snow: true },
    { x: 330, peak: 500, half: 260, light: "#8fa2ad", dark: "#75899a" },
    { x: 1260, peak: 520, half: 290, light: "#8fa2ad", dark: "#75899a" },
  ];
  const ripples = Array.from({ length: 12 }, (_, i) => {
    const y = horizon + 26 + i * 22;
    const x = (i * 211) % 900;
    return `<line class="ts-shimmer" x1="${x}" y1="${y}" x2="${x + 560}" y2="${y}" stroke="#fffaf0" stroke-opacity=".34" stroke-width="2" stroke-linecap="round" style="animation-delay:${-i * 0.9}s"/>`;
  }).join("");
  const petals = Array.from({ length: 14 }, (_, i) => {
    const x = 120 + ((i * 197) % 1500);
    return `<ellipse class="ts-petal" cx="${x}" cy="0" rx="7" ry="4" fill="#f4b9c0" opacity=".85" style="animation-duration:${14 + (i % 5) * 3}s;animation-delay:${-i * 2.3}s"/>`;
  }).join("");
  return `<svg class="ts-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efc4b4"/><stop offset=".55" stop-color="#f7ddc6"/><stop offset="1" stop-color="#f6eedd"/></linearGradient>
    <linearGradient id="ts-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9bbcc0"/><stop offset="1" stop-color="#5e8f98"/></linearGradient>
    <linearGradient id="ts-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2424" stop-opacity=".18"/><stop offset=".3" stop-color="#2a2424" stop-opacity="0"/><stop offset=".75" stop-color="#2a2424" stop-opacity="0"/><stop offset="1" stop-color="#2a2424" stop-opacity=".3"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#ts-sky)"/>
  <g class="ts-sun"><circle cx="1090" cy="300" r="210" fill="#f6b79d" opacity=".28"/><circle cx="1090" cy="300" r="150" fill="#f2a08a" opacity=".4"/><circle cx="1090" cy="300" r="104" fill="#e0574a"/></g>
  ${far.map((m) => mountain(m, horizon + 6)).join("")}
  ${mid.map((m) => mountain(m, horizon + 6)).join("")}
  <g class="ts-mist" opacity=".6"><rect x="-120" y="${horizon - 70}" width="1500" height="26" rx="13" fill="#fffaf0"/><rect x="260" y="${horizon - 36}" width="1500" height="22" rx="11" fill="#fffaf0" opacity=".8"/></g>
  <rect x="0" y="${horizon}" width="1600" height="${900 - horizon}" fill="url(#ts-lake)"/>
  <g opacity=".3" transform="translate(0 ${2 * 700}) scale(1 -1)">${torii(520, 700)}</g>
  ${ripples}
  <polygon points="380,704 430,690 470,700 590,694 650,706 700,712 360,712" fill="#3d4a44"/>
  <polygon points="470,700 590,694 650,706 560,712 470,712" fill="#2f3b36"/>
  ${torii(520, 700)}
  ${lantern(900, 770, 0)}${lantern(1030, 810, 1.6)}${lantern(760, 840, 3.1)}${lantern(1210, 790, 2.2)}
  ${pine(70, 930, 520, 230, "#34463f", "#27352f")}${pine(210, 940, 360, 170, "#3b4f47", "#2b3a34")}${pine(-30, 960, 360, 190, "#27352f", "#1f2a26")}
  ${pine(1540, 930, 560, 250, "#34463f", "#27352f")}${pine(1410, 945, 330, 160, "#3b4f47", "#2b3a34")}${pine(1640, 960, 380, 200, "#27352f", "#1f2a26")}
  ${petals}
  <rect width="1600" height="900" fill="url(#ts-vignette)"/>
</svg>`;
}

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
  card.append(head, body);
  overlay.appendChild(card);
  container.appendChild(overlay);
  const isOpen = (): boolean => overlay.classList.contains("open");
  const render = (): void => build(body, heading, close);
  const api: Dialog = {
    isOpen,
    open() {
      render();
      overlay.classList.add("open");
      (body.querySelector<HTMLElement>("[data-autofocus]") ?? card).focus();
    },
    close: () => overlay.classList.remove("open"),
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

export function createTitleScreen(container: HTMLElement, { saves, settings, music }: TitleScreenDeps): TitleScreen {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "ts-root";
  root.innerHTML = scene();
  const ui = document.createElement("div");
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
    name.textContent = "WAYSHRINE";
    const note = document.createElement("div");
    note.className = "ts-note";
    logo.append(name, note);
  }
  const panel = document.createElement("div");
  panel.className = "ts-panel";
  ui.append(logo, panel);
  root.appendChild(ui);
  container.appendChild(root);

  const options = createSettingsPanel(root, null, settings, { escapeToggles: false });

  let busy = false;
  let resolve!: (slot: SaveSlot) => void;
  const chosen = new Promise<SaveSlot>((r) => (resolve = r));
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
  const begin = (slot: SaveSlot): void => {
    if (busy) return;
    busy = true;
    dialogs.forEach((d) => d.close());
    panel.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "ts-loading";
    loading.textContent = t().loading;
    panel.appendChild(loading);
    requestAnimationFrame(() => setTimeout(() => resolve(slot), 30));
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
    );
  });

  const newGame = createDialog(root, settings, (body, heading, close) => {
    const m = t();
    heading.textContent = m.newGame;
    close.setAttribute("aria-label", m.back);
    const keep = body.querySelector<HTMLInputElement>("input")?.value ?? "";
    const label = document.createElement("label");
    label.className = "ts-label ts-field";
    label.textContent = m.seedLabel;
    const input = document.createElement("input");
    input.className = "ts-input";
    input.type = "text";
    input.placeholder = m.seedPlaceholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 64;
    input.value = keep;
    input.dataset.autofocus = "";
    label.appendChild(input);
    const help = document.createElement("p");
    help.className = "ts-help";
    help.textContent = m.seedHelp;
    const start = (): void => begin(saves.create(input.value.trim() || randomSeed()));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") start();
    });
    body.replaceChildren(label, help, button(m.begin, start, "primary"));
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
      when.textContent = dateOf(slot.playedAt);
      const actions = document.createElement("div");
      actions.className = "ts-row";
      actions.append(
        button(m.play, () => begin(slot), "primary"),
        button(m.delete, () => {
          row.replaceChildren();
          const ask = document.createElement("b");
          ask.textContent = m.confirmDelete;
          const confirm = document.createElement("div");
          confirm.className = "ts-row";
          confirm.append(
            button(m.delete, () => {
              saves.remove(slot.id);
              if (saves.list().length === 0) loadGame.close();
              else loadGame.open();
              renderMenu();
            }),
            button(m.keep, () => loadGame.open(), "primary"),
          );
          row.append(ask, confirm);
          (confirm.lastElementChild as HTMLElement).focus();
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
    panel.append(cont, fresh, load, button(m.options, () => options.toggle()), button(m.credits, () => credits.open(), "quiet"));
    (last ? cont : fresh).focus();
  };

  const onKey = (e: KeyboardEvent): void => {
    music.unlock();
    if (e.code !== "Escape" || e.repeat || busy) return;
    const open = dialogs.find((d) => d.isOpen());
    if (open) open.close();
    else if (options.isOpen()) options.close();
  };
  const onPointer = (): void => music.unlock();
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", onPointer);
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
  const tick = (now: number): void => {
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
      options.destroy();
      dialogs.forEach((d) => d.destroy());
      root.remove();
      style.remove();
    },
  };
}
