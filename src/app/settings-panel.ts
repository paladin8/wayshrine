import { LOCALES, LOCALE_NAMES, messagesFor } from "./i18n";
import { CHARACTER_CHOICES, type SettingsStore } from "./settings";
import { UI_FONT, setText } from "./style";

export interface SettingsPanel {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
  /** Removes the dialog and its listeners. */
  destroy(): void;
}

export interface SettingsPanelOptions {
  /** Adds a button that leaves the game for the title screen. */
  readonly onTitle?: () => void;
  /** Whether Esc opens and closes the dialog. Default true. */
  readonly escapeToggles?: boolean;
}

const CSS = `
.hud .gear{width:34px;font-size:18px;line-height:1}
.sp-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#2a242455;pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#2a2424}
.sp-overlay.open{display:flex}
.sp-card{width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:18px 20px 20px;border-radius:16px;background:#fffaf0;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;outline:none}
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
.sp-howto p{margin:6px 0;font-size:13px;line-height:1.45}
.sp-tabs{display:flex;gap:6px;margin:4px 0 6px}
.sp-tab{all:unset;cursor:pointer;flex:1;text-align:center;padding:6px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff;font-size:17px}
.sp-tab[aria-selected=true]{background:#2a2424;border-color:#2a2424;color:#fffaf0}
.sp-tab:focus-visible{outline:2px solid #c8482f;outline-offset:2px}
.sp-controls[hidden],.sp-main[hidden]{display:none}
.sp-controls h3{font-size:14px}
.sp-controls dl{display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin:0;font-size:16px;line-height:1.35}
.sp-controls dt{margin:0}
.sp-controls dd{margin:0;text-align:right;font-weight:600;max-width:230px}
.sp-title-button{all:unset;cursor:pointer;display:block;width:100%;box-sizing:border-box;margin-top:18px;text-align:center;padding:8px 10px;border-radius:10px;border:1px solid #2a242433;background:#fff}
.sp-title-button:hover{background:#f6efe2}
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
export function createSettingsPanel(
  container: HTMLElement,
  actions: HTMLElement | null,
  store: SettingsStore,
  options: SettingsPanelOptions = {},
): SettingsPanel {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const gear = actions ? el("button", "hud-action gear", actions) : null;
  if (gear) {
    gear.type = "button";
    gear.textContent = "⚙";
  }

  const overlay = el("div", "sp-overlay", container);
  const card = el("div", "sp-card", overlay);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.tabIndex = -1;

  const head = el("div", "sp-head", card);
  const title = el("h2", undefined, head);
  const closeButton = el("button", "sp-x", head);
  closeButton.type = "button";
  closeButton.textContent = "✕";

  const tabs = el("div", "sp-tabs", card);
  tabs.setAttribute("role", "tablist");
  const tabSettings = el("button", "sp-tab", tabs);
  const tabControls = el("button", "sp-tab", tabs);
  for (const tab of [tabSettings, tabControls]) {
    tab.type = "button";
    tab.setAttribute("role", "tab");
  }
  const controlsPane = el("div", "sp-controls", card);
  controlsPane.hidden = true;
  const main = el("div", "sp-main", card);
  const showTab = (controls: boolean): void => {
    controlsPane.hidden = !controls;
    main.hidden = controls;
    tabSettings.setAttribute("aria-selected", String(!controls));
    tabControls.setAttribute("aria-selected", String(controls));
  };
  tabSettings.addEventListener("click", () => showTab(false));
  tabControls.addEventListener("click", () => showTab(true));
  showTab(false);

  const howHeading = el("h3", undefined, main);
  const howBody = el("div", "sp-howto", main);

  const audioHeading = el("h3", undefined, main);
  const slider = (): { label: HTMLElement; input: HTMLInputElement; out: HTMLOutputElement } => {
    const row = el("label", "sp-row", main);
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
    const row = el("label", "sp-check", main);
    const input = el("input", undefined, row);
    input.type = "checkbox";
    const label = el("span", undefined, row);
    return { label, input };
  };
  const mute = checkbox();

  const displayHeading = el("h3", undefined, main);
  const minimap = checkbox();

  const characterHeading = el("h3", undefined, main);
  const characters = el("div", "sp-langs", main);
  const characterButtons = CHARACTER_CHOICES.map((choice) => {
    const b = el("button", "sp-lang", characters);
    b.type = "button";
    b.addEventListener("click", () => store.update({ character: choice }));
    return [choice, b] as const;
  });

  const languageHeading = el("h3", undefined, main);
  const langs = el("div", "sp-langs", main);
  const langButtons = LOCALES.map((locale) => {
    const b = el("button", "sp-lang", langs);
    b.type = "button";
    b.textContent = LOCALE_NAMES[locale];
    b.addEventListener("click", () => store.update({ language: locale }));
    return [locale, b] as const;
  });

  const titleButton = options.onTitle ? el("button", "sp-title-button", main) : null;
  if (titleButton) titleButton.type = "button";

  const percent = (v: number): string => `${Math.round(v * 100)}%`;
  const render = (): void => {
    const s = store.get();
    const t = messagesFor(s.language).settings;
    document.documentElement.lang = s.language;
    if (gear) {
      gear.title = t.open;
      gear.setAttribute("aria-label", t.open);
    }
    closeButton.title = t.close;
    closeButton.setAttribute("aria-label", t.close);
    card.setAttribute("aria-label", t.title);
    setText(title, t.title);
    setText(howHeading, t.instructions);
    howBody.replaceChildren(...t.instructionsText.map((line) => {
      const p = document.createElement("p");
      setText(p, line);
      return p;
    }));
    setText(tabSettings, t.tabSettings);
    setText(tabControls, t.tabControls);
    controlsPane.replaceChildren(...t.controlGroups.flatMap((group) => {
      const h = document.createElement("h3");
      setText(h, group.title);
      const list = document.createElement("dl");
      for (const [what, how] of group.rows) {
        const dt = document.createElement("dt");
        setText(dt, what);
        const dd = document.createElement("dd");
        setText(dd, how);
        list.append(dt, dd);
      }
      return [h, list];
    }));
    setText(audioHeading, t.audio);
    setText(music.label, t.music);
    setText(sfx.label, t.soundEffects);
    setText(mute.label, t.muteAll);
    setText(displayHeading, t.display);
    setText(minimap.label, t.minimap);
    setText(characterHeading, t.character);
    for (const [choice, b] of characterButtons) {
      b.textContent = t[choice];
      b.setAttribute("aria-pressed", String(choice === s.character));
    }
    setText(languageHeading, t.language);
    if (titleButton) setText(titleButton, t.returnToTitle);
    music.input.value = String(s.musicVolume);
    sfx.input.value = String(s.sfxVolume);
    setText(music.out, percent(s.musicVolume));
    setText(sfx.out, percent(s.sfxVolume));
    mute.input.checked = s.muted;
    minimap.input.checked = s.showMinimap;
    for (const [locale, b] of langButtons) b.setAttribute("aria-pressed", String(locale === s.language));
  };

  music.input.addEventListener("input", () => store.update({ musicVolume: Number(music.input.value) }));
  sfx.input.addEventListener("input", () => store.update({ sfxVolume: Number(sfx.input.value) }));
  mute.input.addEventListener("change", () => store.update({ muted: mute.input.checked }));
  minimap.input.addEventListener("change", () => store.update({ showMinimap: minimap.input.checked }));
  const unsubscribe = store.subscribe(render);
  render();

  let open = false;
  const setOpen = (next: boolean): void => {
    open = next;
    overlay.classList.toggle("open", open);
    if (open) {
      showTab(false);
      card.focus();
    }
    else (document.activeElement as HTMLElement | null)?.blur(); // hand the keyboard back to the game
  };
  gear?.addEventListener("click", () => setOpen(!open));
  closeButton.addEventListener("click", () => setOpen(false));
  titleButton?.addEventListener("click", () => options.onTitle?.());
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) setOpen(false);
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "Escape" && !e.repeat && (options.escapeToggles ?? true)) setOpen(!open);
  };
  window.addEventListener("keydown", onKey);

  return {
    isOpen: () => open,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    destroy() {
      unsubscribe();
      window.removeEventListener("keydown", onKey);
      overlay.remove();
      gear?.remove();
      style.remove();
    },
  };
}
