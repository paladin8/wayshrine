import { CAPABILITIES, CAPABILITY_THRESHOLDS, PILGRIMS_WAKE_STARS } from "../world";
import { GEAR_ICONS, type GearId } from "./gear-icons";
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
.bp-overlay{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;box-sizing:border-box;z-index:5;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 46%,#38261a66,#140c09d9);pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#f6e7c9}
.bp-overlay::backdrop{background:transparent}
.bp-overlay[open]{display:flex;animation:bp-in .22s ease-out}
@keyframes bp-in{from{opacity:0}to{opacity:1}}
.bp-overlay[open] .bp-well::after{animation:bp-unfold .42s both}
@keyframes bp-unfold{
  0%,18%{transform:perspective(780px) rotateX(0);opacity:1}
  /* The snap releases the flap about 130 ms into the cue. */
  31%{transform:perspective(780px) rotateX(-9deg);opacity:1;animation-timing-function:cubic-bezier(.2,.72,.3,1)}
  83%{transform:perspective(780px) rotateX(-86deg);opacity:1}
  100%{transform:perspective(780px) rotateX(-90deg);opacity:0}
}
@media(prefers-reduced-motion:reduce){.bp-overlay[open],.bp-overlay[open] .bp-well::after{animation:none}}

.bp-pack{--weave:repeating-linear-gradient(0deg,#20150910 0 1px,transparent 1px 3px),
    repeating-linear-gradient(90deg,#fff0b50e 0 1px,transparent 1px 3px);
  position:relative;width:min(730px,calc(100vw - 20px));margin-top:12px}
.bp-pack::before{content:"";position:absolute;top:-19px;left:50%;width:94px;height:43px;transform:translateX(-50%) rotate(-3deg);
  box-sizing:border-box;border:8px solid #6e4d35;border-top-color:#91704d;border-radius:44% 44% 23% 23%;
  box-shadow:inset 0 2px 2px #2f1d18a8,0 3px 8px #170f08a8;pointer-events:none}
.bp-card{position:relative;box-sizing:border-box;max-height:calc(100dvh - 44px);overflow:auto;overscroll-behavior:contain;
  padding:clamp(12px,3vw,26px);border:1px solid #3f2a20;border-radius:46px 43px 34px 37px;outline:none;
  background:var(--weave),radial-gradient(ellipse at 18% 12%,#a17c50,transparent 55%),linear-gradient(115deg,#68523a,#866648 55%,#5d4333);
  box-shadow:inset 0 0 0 5px #543824, inset 0 0 0 7px #b88f606b,inset 0 0 27px #352317a0,0 7px 0 #38261f,0 27px 55px #000a;
  scrollbar-width:thin;scrollbar-color:#b4936e #49372b}
.bp-card [hidden]{display:none}
.bp-flap{position:sticky;top:0;display:grid;place-items:center;margin:0 0 -5px;padding:11px 54px 17px;min-height:40px;text-align:center;
  border:1px solid #3d3025;border-radius:27px 27px 33% 34% / 25px 25px 14px 13px;
  background:var(--weave),radial-gradient(ellipse at 25% 6%,#9a7952,transparent 70%),linear-gradient(110deg,#71543c,#8a6848 54%,#654835);
  box-shadow:inset 0 2px 3px #d6ae6c69,inset 0 -3px #4b3426,0 4px 7px #25190ec4;z-index:2}
.bp-flap::after{content:"";position:absolute;inset:5px 6px 7px;border:1px dashed #ecce9188;border-radius:inherit;pointer-events:none}
.bp-flap h2{margin:0;color:#fff0ce;font:400 clamp(29px,5vw,43px)/1.05 "Kaushan Script","Segoe Script","Brush Script MT",cursive;text-shadow:0 2px 3px #382018}
.bp-flap h2:lang(ja){font-family:"Yuji Syuku","Hiragino Mincho ProN","Yu Mincho",serif;font-size:clamp(25px,5vw,36px)}
.bp-x{position:absolute;z-index:2;top:50%;right:13px;transform:translateY(-50%) rotate(4deg);display:grid;place-items:center;
  width:44px;height:44px;padding:0;border:1px solid #443323;border-radius:11px 9px 11px 9px;cursor:pointer;color:#ffebbe;
  background:linear-gradient(145deg,#876647,#503629);box-shadow:inset 0 0 0 2px #bc965e80,0 2px 4px #28190eaa;font:24px/1 ${UI_FONT}}
.bp-x:hover{background:linear-gradient(145deg,#9f7d53,#634936)}
.bp-x:focus-visible{outline:2px solid #ffedc1;outline-offset:2px}
.bp-well{position:relative;padding:clamp(16px,3.5vw,25px) clamp(10px,2.7vw,20px) clamp(17px,3vw,22px);
  border:1px solid #302d22;border-radius:11px 12px 28px 28px;
  background:var(--weave),radial-gradient(ellipse at 46% 87%,#6e7154 0,#565942 52%,#373b30 100%);
  box-shadow:inset 0 11px 15px #201b16c4,inset 0 -8px 18px #27282088,0 2px #bf965e88}
.bp-well::before{content:"";position:absolute;inset:8px 6px 6px;border:1px dashed #cbbb8a68;border-radius:inherit;pointer-events:none}
/* The leather cover swings up from the seam just beneath the open pack's header. */
.bp-well::after{content:"";position:absolute;z-index:1;inset:-2px -1px 0;pointer-events:none;opacity:0;
  transform-origin:50% 0;backface-visibility:hidden;border:1px solid #3e2c20;border-radius:9px 9px 32px 33px;
  background:
    radial-gradient(circle at 50% 50%,#6d482a 0 2px,#edc982 3px,#aa773f 7px,transparent 8px) center calc(100% - 18px)/20px 20px no-repeat,
    linear-gradient(90deg,#503524,#7b5337 48%,#543824) center bottom/26px 72px no-repeat,
    var(--weave),radial-gradient(ellipse at 28% 10%,#ad8758,transparent 66%),linear-gradient(124deg,#836344,#6b4e38);
  outline:1px dashed #ead1a58c;outline-offset:-8px;
  box-shadow:inset 0 0 0 5px #694934,inset 0 -6px 16px #402819a6,0 4px 10px #21160ca6}
.bp-grid{--gap:clamp(9px,2vw,15px);list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:var(--gap)}
.bp-item{--tilt:-6deg;position:relative;isolation:isolate;box-sizing:border-box;flex:0 0 calc((100% - 3 * var(--gap)) / 4);
  min-width:0;padding:4px 5px 8px;display:grid;grid-template-rows:69px minmax(2.25em,auto) auto;justify-items:center;text-align:center}
.bp-item::before{content:"";position:absolute;z-index:-1;inset:48px 0 0;border:1px solid #363b2a;border-top:3px solid #929576;border-radius:9px 8px 19px 17px;
  background:var(--weave),linear-gradient(109deg,#73775a,#555b44 68%,#474e3c);box-shadow:0 4px 4px #29261b73,inset 0 -1px 5px #25281c8c}
.bp-item::after{content:"";position:absolute;z-index:-1;inset:54px 4px 4px;border:1px dashed #d6c69a78;border-radius:5px 5px 15px 13px;pointer-events:none}
.bp-item:nth-child(even){--tilt:6deg}
.bp-item:nth-child(3n){--tilt:-3deg}
.bp-icon{display:grid;place-items:center;width:min(100%,69px);height:66px;transform:rotate(var(--tilt));filter:drop-shadow(2px 4px 2px #211a13b3)}
.bp-icon svg{display:block;width:100%;height:100%;max-width:65px;overflow:visible}
.bp-name{align-self:center;box-sizing:border-box;max-width:100%;padding:3px 5px 4px;margin:0 0 3px;
  border-radius:4px 3px 4px 2px;background:var(--weave),linear-gradient(105deg,#e1cfaa,#f2e1bb 66%,#d2bf96);
  box-shadow:0 2px 2px #27221673,inset 0 0 0 1px #b995656a;color:#34291f;
  font:600 14px/1.18 Georgia,"Hiragino Mincho ProN","Yu Mincho",serif;overflow-wrap:anywhere}
.bp-stars{display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:14px;font-variant-numeric:tabular-nums}
.bp-stars::before{content:"📖";font-size:12px;line-height:1}
.bp-empty,.bp-done{margin:0;text-align:center;color:#f3e6c5;font:16px/1.35 Georgia,"Hiragino Mincho ProN","Yu Mincho",serif}
.bp-empty{display:grid;min-height:118px;place-items:center;padding:10px 0}
.bp-done{margin:12px 8px 0}
.bp-pouch{position:relative;display:flex;align-items:center;justify-content:center;gap:12px;box-sizing:border-box;width:min(440px,100%);min-height:50px;margin:11px auto 1px;padding:5px 12px;
  border:1px solid #39271e;border-radius:12px 13px 21px 19px;
  background:var(--weave),linear-gradient(180deg,#8c684a 0 43%,#514132 45%,#704e36 52%,#613f2d 100%);
  box-shadow:inset 0 0 0 4px #d7ab702c,0 4px 5px #36261988}
.bp-pouch::before{content:"";position:absolute;inset:5px;border:1px dashed #e3bb7d9a;border-radius:inherit;pointer-events:none}
.bp-pouch .bp-name{margin:0;transform:rotate(-3deg)}
.bp-pouch .bp-lock{width:12px;height:13px;flex:none;border:1px solid #4a3321;border-radius:4px;transform:rotate(10deg);
  background:radial-gradient(ellipse at 50% 57%,#64472b 0 1px,transparent 2px),linear-gradient(140deg,#edc982,#a77842);box-shadow:0 1px 3px #372719}
@media(max-width:560px){
  .bp-card{border-radius:34px 31px 28px 29px}
  .bp-flap{padding-inline:48px}
  .bp-x{right:8px}
  .bp-item{flex-basis:calc((100% - var(--gap)) / 2);max-width:160px}
}
@media(forced-colors:active){
  .bp-flap h2{text-shadow:none}
  .bp-icon{filter:none}
  .bp-x{border-color:ButtonText}
  .bp-x:focus-visible{outline-color:Highlight}
}
`;

/** The backpack: the gear collected so far, each with an icon, a name and the star count it was found at. */
export function createBackpack(container: HTMLElement, opener: HTMLButtonElement, onOpen: () => void): Backpack {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const overlay = document.createElement("dialog");
  overlay.className = "bp-overlay";
  overlay.id = "backpack-view";
  const pack = document.createElement("div");
  pack.className = "bp-pack";
  const card = document.createElement("div");
  card.className = "bp-card";
  const head = document.createElement("div");
  head.className = "bp-flap";
  const title = document.createElement("h2");
  title.id = "backpack-title";
  overlay.setAttribute("aria-labelledby", title.id);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "bp-x";
  closeButton.textContent = "×";
  head.append(title, closeButton);

  const well = document.createElement("div");
  well.className = "bp-well";
  const grid = document.createElement("ul");
  grid.className = "bp-grid";
  grid.setAttribute("role", "list");
  const empty = document.createElement("p");
  empty.className = "bp-empty";
  well.append(grid, empty);

  const pouch = document.createElement("div");
  pouch.className = "bp-pouch";
  const lock = document.createElement("span");
  lock.className = "bp-lock";
  lock.setAttribute("aria-hidden", "true");
  const nextLabel = document.createElement("span");
  nextLabel.className = "bp-name";
  const nextRequirement = document.createElement("span");
  nextRequirement.className = "bp-stars";
  nextRequirement.setAttribute("role", "img");
  pouch.append(lock, nextLabel, nextRequirement);

  const done = document.createElement("p");
  done.className = "bp-done";
  card.append(head, well, pouch, done);
  pack.appendChild(card);
  overlay.appendChild(pack);
  container.appendChild(overlay);

  opener.setAttribute("aria-haspopup", "dialog");
  opener.setAttribute("aria-expanded", "false");
  opener.setAttribute("aria-controls", overlay.id);
  opener.setAttribute("aria-keyshortcuts", "I");

  let messages: Messages | undefined;
  let restored = 0;
  let drawn: { messages: Messages; restored: number } | undefined;

  const item = (gear: GearItem, t: Messages): HTMLLIElement => {
    const li = document.createElement("li");
    li.className = "bp-item";
    const icon = document.createElement("div");
    icon.className = "bp-icon";
    icon.innerHTML = GEAR_ICONS[gear.id];
    const name = document.createElement("div");
    name.className = "bp-name";
    name.textContent = gear.id === "pilgrimsWake" ? t.pilgrimsWake : t.capability[gear.id];
    const stars = document.createElement("div");
    stars.className = "bp-stars";
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", t.gearRequirement(gear.stars, "unlocked"));
    stars.textContent = String(gear.stars);
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
    grid.replaceChildren(...contents.held.map((gear) => item(gear, t)));
    grid.hidden = contents.held.length === 0;
    empty.textContent = t.backpack.empty;
    empty.hidden = !grid.hidden;
    pouch.hidden = contents.nextStars === null;
    if (contents.nextStars !== null) {
      nextLabel.textContent = t.backpack.mystery;
      nextRequirement.textContent = String(contents.nextStars);
      nextRequirement.setAttribute("aria-label", t.gearRequirement(contents.nextStars, "locked"));
    }
    done.textContent = contents.nextStars === null ? t.backpack.complete : "";
    done.hidden = contents.nextStars !== null;
    drawn = { messages: t, restored };
  };

  const sync = (): void => {
    if (!overlay.open || !messages) return;
    if (drawn?.messages !== messages || drawn.restored !== restored) render();
  };

  function show(): void {
    overlay.showModal();
    opener.setAttribute("aria-expanded", "true");
    drawn = undefined;
    sync();
    closeButton.focus({ preventScroll: true });
    if (getComputedStyle(well, "::after").animationName === "none") onOpen();
  }

  function close(): void {
    if (!overlay.open) return;
    overlay.close();
    opener.setAttribute("aria-expanded", "false");
    opener.focus({ preventScroll: true });
  }

  opener.addEventListener("click", show);
  well.addEventListener("animationstart", (e) => {
    if (overlay.open && e.target === well && e.animationName === "bp-unfold") onOpen();
  });
  closeButton.addEventListener("click", close);
  overlay.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay || e.target === pack) close();
  });
  // The backpack owns the keyboard while it is open.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!overlay.open) return;
      // Close is the sole tab stop. Keep focus in the game on repeated Tab presses.
      if (e.code === "Tab") {
        e.preventDefault();
        closeButton.focus({ preventScroll: true });
      }
      if (e.code === "Escape" || (e.code === "KeyI" && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) close();
      }
    },
    true,
  );

  return {
    isOpen: () => overlay.open,
    toggle: () => (overlay.open ? close() : show()),
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
