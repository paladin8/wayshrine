import { CAPABILITIES, CAPABILITY_THRESHOLDS, PILGRIMS_WAKE_STARS } from "../world";
import { BACKPACK_ICON, GEAR_ICONS, type GearId } from "./gear-icons";
import type { Messages } from "./i18n";
import { UI_FONT } from "./style";

export interface GearItem {
  readonly id: GearId;
  /** Landmarks to restore before the gear is found. */
  readonly stars: number;
}

/** Every piece of gear in the order it is found: each capability, then Pilgrim’s Wake. */
export const GEAR: readonly GearItem[] = [
  ...CAPABILITIES.map((id) => ({ id, stars: CAPABILITY_THRESHOLDS[id] })),
  { id: "pilgrimsWake" as const, stars: PILGRIMS_WAKE_STARS },
].sort((a, b) => a.stars - b.stars);

export interface BackpackContents {
  /** The gear found so far. */
  readonly held: readonly GearItem[];
  /** The star count at which the next piece is found, or null when all of it has been. Never says which piece. */
  readonly nextStars: number | null;
}

/** What the backpack shows once `restored` landmarks have been restored. */
export function backpackContents(restored: number): BackpackContents {
  const held = GEAR.filter((item) => restored >= item.stars);
  const next = GEAR.find((item) => restored < item.stars);
  return { held, nextStars: next ? next.stars : null };
}

export interface Backpack {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
  /** Keeps the open backpack in step with the language and the star count. Cheap to call every frame. */
  update(model: { readonly messages: Messages; readonly restored: number }): void;
}

const CSS = `
.hud .backpack-button{gap:6px;padding:0 10px;font-variant-numeric:tabular-nums}
.hud .backpack-button svg{width:22px;height:22px;display:block}
.bp-overlay{position:fixed;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 46%,#38261a66,#140c09d9);pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#3a2c26}
.bp-overlay.open{display:flex;animation:bp-in .2s ease-out}
@keyframes bp-in{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.bp-overlay.open{animation:none}}
.bp-card{position:relative;box-sizing:border-box;width:min(560px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:20px 22px 22px;border-radius:16px;outline:none;background:linear-gradient(#f6eedb,#ead9b4);border:2px solid #8f4f2b;box-shadow:inset 0 0 0 4px #f6eedb,inset 0 0 0 5px #b9733f88,0 20px 50px #000a}
.bp-head{display:flex;align-items:center;gap:10px;margin:0 0 14px}
.bp-head svg{width:30px;height:30px}
.bp-head h2{margin:0;flex:1;font-size:19px;letter-spacing:.02em}
.bp-x{all:unset;cursor:pointer;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:19px}
.bp-x:hover,.bp-x:focus-visible{background:#3a2c2619}
.bp-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.bp-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px 9px;border-radius:12px;background:#fffaf0;border:1px solid #8f4f2b33;text-align:center}
.bp-icon{display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:12px;background:radial-gradient(circle at 50% 40%,#fff6df,#efdfba)}
.bp-icon svg{width:56px;height:56px;display:block}
.bp-name{min-height:2.6em;display:flex;align-items:center;font-weight:600;font-size:14px;line-height:1.25}
.bp-stars{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:6px;background:#2a242410;font-size:12px;font-variant-numeric:tabular-nums}
/* The same book as the journal counter in the HUD. */
.bp-stars::before{content:"📖";font-size:12px;line-height:1}
.bp-item.mystery{background:#e6d6b0aa;border:1px dashed #8f4f2b88}
.bp-item.mystery .bp-icon{background:#cdb98d;color:#7a6440;font:700 34px/1 ${UI_FONT}}
.bp-item.mystery .bp-name{color:#7a6440}
.bp-item.mystery .bp-stars::before{filter:grayscale(1) opacity(.7)}
.bp-done{margin:14px 2px 0;text-align:center;font-size:13px;opacity:.75}
`;

/** The backpack: the gear collected so far, each with an icon, a name and the star count it was found at. */
export function createBackpack(container: HTMLElement, opener: HTMLButtonElement): Backpack {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.className = "bp-overlay";
  const card = document.createElement("div");
  card.className = "bp-card";
  card.id = "backpack-view";
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  const head = document.createElement("div");
  head.className = "bp-head";
  const headIcon = document.createElement("span");
  headIcon.setAttribute("aria-hidden", "true");
  headIcon.innerHTML = BACKPACK_ICON;
  const title = document.createElement("h2");
  title.id = "backpack-title";
  card.setAttribute("aria-labelledby", title.id);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "bp-x";
  closeButton.textContent = "×";
  head.append(headIcon, title, closeButton);
  const grid = document.createElement("ul");
  grid.className = "bp-grid";
  const done = document.createElement("p");
  done.className = "bp-done";
  card.append(head, grid, done);
  overlay.appendChild(card);
  container.appendChild(overlay);

  opener.setAttribute("aria-haspopup", "dialog");
  opener.setAttribute("aria-expanded", "false");
  opener.setAttribute("aria-controls", card.id);
  opener.setAttribute("aria-keyshortcuts", "I");

  let open = false;
  let messages: Messages | undefined;
  let restored = 0;
  let drawn: { messages: Messages; restored: number } | undefined;

  const item = (gear: GearItem | null, nextStars: number, t: Messages): HTMLLIElement => {
    const li = document.createElement("li");
    li.className = gear ? "bp-item" : "bp-item mystery";
    const icon = document.createElement("div");
    icon.className = "bp-icon";
    // Static, trusted markup from gear-icons.ts. The mystery slot gets a question mark, never a silhouette.
    if (gear) icon.innerHTML = GEAR_ICONS[gear.id];
    else icon.textContent = "?";
    const name = document.createElement("div");
    name.className = "bp-name";
    name.textContent = gear ? (gear.id === "pilgrimsWake" ? t.pilgrimsWake : t.capability[gear.id]) : t.backpack.mystery;
    const stars = document.createElement("div");
    stars.className = "bp-stars";
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", t.gearRequirement(gear ? gear.stars : nextStars, gear ? "unlocked" : "locked"));
    stars.textContent = String(gear ? gear.stars : nextStars);
    li.append(icon, name, stars);
    return li;
  };

  const render = (): void => {
    if (!messages) return;
    const t = messages;
    const contents = backpackContents(restored);
    title.textContent = t.backpack.title;
    closeButton.setAttribute("aria-label", t.backpack.close);
    closeButton.title = t.backpack.close;
    const tiles = contents.held.map((gear) => item(gear, 0, t));
    if (contents.nextStars !== null) tiles.push(item(null, contents.nextStars, t));
    grid.replaceChildren(...tiles);
    done.textContent = contents.nextStars === null ? t.backpack.complete : "";
    done.hidden = contents.nextStars !== null;
    drawn = { messages: t, restored };
  };

  const sync = (): void => {
    if (!open || !messages) return;
    if (drawn?.messages !== messages || drawn.restored !== restored) render();
  };

  function show(): void {
    open = true;
    overlay.classList.add("open");
    opener.setAttribute("aria-expanded", "true");
    drawn = undefined;
    sync();
    card.focus({ preventScroll: true });
  }

  function close(): void {
    if (!open) return;
    open = false;
    overlay.classList.remove("open");
    opener.setAttribute("aria-expanded", "false");
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && overlay.contains(focused)) focused.blur();
  }

  opener.addEventListener("click", () => {
    if (open) close();
    else show();
    // Keep keyboard focus off the button so Space and Enter stay free for the game.
    opener.blur();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });
  // The backpack owns the keyboard while it is open.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!open) return;
      if (e.code === "Escape" || (e.code === "KeyI" && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.stopImmediatePropagation();
        if (!e.repeat) close();
      }
    },
    true,
  );

  return {
    isOpen: () => open,
    toggle: () => (open ? close() : show()),
    close,
    update(model) {
      if (messages !== model.messages) {
        messages = model.messages;
        opener.title = `${messages.backpack.title} (I)`;
        opener.setAttribute("aria-label", opener.title);
      }
      restored = model.restored;
      sync();
    },
  };
}
