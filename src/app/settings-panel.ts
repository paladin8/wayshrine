import { LOCALES, LOCALE_NAMES, messagesFor } from "./i18n";
import type { SettingsStore } from "./settings";
import { UI_FONT, setText } from "./style";

export interface SettingsPanel {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
}

const CSS = `
.gear{position:fixed;top:52px;right:14px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;padding:0;border-radius:50%;background:#fffaf0cc;border:1px solid #2a242422;font-size:18px;line-height:1;color:#2a2424;cursor:pointer;pointer-events:auto}
.gear:hover{background:#fffaf0}
.sp-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#2a242455;pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#2a2424}
.sp-overlay.open{display:flex}
.sp-card{width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:18px 20px 20px;border-radius:16px;background:#fffaf0;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;outline:none}
.sp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.sp-head h2{margin:0;font-size:18px}
.sp-card h3{margin:16px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.6}
.sp-x{all:unset;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:18px}
.sp-x:hover{background:#2a242414}
.sp-row{display:grid;grid-template-columns:1fr auto 38px;align-items:center;gap:10px;margin:8px 0}
.sp-row input[type=range]{width:140px;accent-color:#d96b59}
.sp-row output{text-align:right;font-variant-numeric:tabular-nums;opacity:.7}
.sp-check{display:flex;align-items:center;gap:10px;margin:8px 0;cursor:pointer}
.sp-check input{width:16px;height:16px;accent-color:#d96b59}
.sp-langs{display:flex;gap:8px}
.sp-lang{all:unset;cursor:pointer;flex:1;text-align:center;padding:7px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff}
.sp-lang[aria-pressed=true]{background:#d96b59;border-color:#d96b59;color:#fff}
.sp-lang:focus-visible,.sp-x:focus-visible,.gear:focus-visible{outline:2px solid #d96b59;outline-offset:2px}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  parent?.appendChild(e);
  return e;
}

/** The settings dialog and its gear button. All changes go through the store. */
export function createSettingsPanel(container: HTMLElement, store: SettingsStore): SettingsPanel {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const gear = el("button", "gear", container);
  gear.type = "button";
  gear.textContent = "⚙";

  const overlay = el("div", "sp-overlay", container);
  const card = el("div", "sp-card", overlay);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.tabIndex = -1;

  const head = el("div", "sp-head", card);
  const title = el("h2", undefined, head);
  const closeButton = el("button", "sp-x", head);
  closeButton.type = "button";
  closeButton.textContent = "×";

  const audioHeading = el("h3", undefined, card);
  const slider = (): { label: HTMLElement; input: HTMLInputElement; out: HTMLOutputElement } => {
    const row = el("label", "sp-row", card);
    const label = el("span", undefined, row);
    const input = el("input", undefined, row);
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = "0.05";
    const out = el("output", undefined, row);
    return { label, input, out };
  };
  const music = slider();
  const sfx = slider();
  const checkbox = (): { label: HTMLElement; input: HTMLInputElement } => {
    const row = el("label", "sp-check", card);
    const input = el("input", undefined, row);
    input.type = "checkbox";
    const label = el("span", undefined, row);
    return { label, input };
  };
  const mute = checkbox();

  const displayHeading = el("h3", undefined, card);
  const minimap = checkbox();
  const compass = checkbox();

  const languageHeading = el("h3", undefined, card);
  const langs = el("div", "sp-langs", card);
  const langButtons = LOCALES.map((locale) => {
    const b = el("button", "sp-lang", langs);
    b.type = "button";
    b.textContent = LOCALE_NAMES[locale];
    b.addEventListener("click", () => store.update({ language: locale }));
    return [locale, b] as const;
  });

  const percent = (v: number): string => `${Math.round(v * 100)}%`;
  const render = (): void => {
    const s = store.get();
    const t = messagesFor(s.language).settings;
    document.documentElement.lang = s.language;
    gear.title = t.open;
    gear.setAttribute("aria-label", t.open);
    closeButton.title = t.close;
    closeButton.setAttribute("aria-label", t.close);
    card.setAttribute("aria-label", t.title);
    setText(title, t.title);
    setText(audioHeading, t.audio);
    setText(music.label, t.music);
    setText(sfx.label, t.soundEffects);
    setText(mute.label, t.muteAll);
    setText(displayHeading, t.display);
    setText(minimap.label, t.minimap);
    setText(compass.label, t.compass);
    setText(languageHeading, t.language);
    music.input.value = String(s.musicVolume);
    sfx.input.value = String(s.sfxVolume);
    setText(music.out, percent(s.musicVolume));
    setText(sfx.out, percent(s.sfxVolume));
    mute.input.checked = s.muted;
    minimap.input.checked = s.showMinimap;
    compass.input.checked = s.showCompass;
    for (const [locale, b] of langButtons) b.setAttribute("aria-pressed", String(locale === s.language));
  };

  music.input.addEventListener("input", () => store.update({ musicVolume: Number(music.input.value) }));
  sfx.input.addEventListener("input", () => store.update({ sfxVolume: Number(sfx.input.value) }));
  mute.input.addEventListener("change", () => store.update({ muted: mute.input.checked }));
  minimap.input.addEventListener("change", () => store.update({ showMinimap: minimap.input.checked }));
  compass.input.addEventListener("change", () => store.update({ showCompass: compass.input.checked }));
  store.subscribe(render);
  render();

  let open = false;
  const setOpen = (next: boolean): void => {
    open = next;
    overlay.classList.toggle("open", open);
    if (open) card.focus();
    else (document.activeElement as HTMLElement | null)?.blur(); // hand the keyboard back to the game
  };
  gear.addEventListener("click", () => setOpen(!open));
  closeButton.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) setOpen(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !e.repeat) setOpen(!open);
  });

  return { isOpen: () => open, toggle: () => setOpen(!open), close: () => setOpen(false) };
}
