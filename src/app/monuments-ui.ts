import { TEXT_COUNT, loadTexts, type TextEntry } from "../content";
import { messagesFor, type Locale } from "./i18n";
import { UI_FONT, setText } from "./style";

export interface MonumentUi {
  isBoxOpen(): boolean;
  isReading(): boolean;
  /** Displays the inscription over the scene. */
  read(id: string): void;
  toggleBox(): void;
  /** Dismisses a reading overlay and returns whether one was visible. */
  dismissReading(): boolean;
  /** Re-draws after a language change or a new discovery. */
  refresh(): void;
}

const JA_SCRIPT = '"Yuji Syuku","Wayshrine Repeat Marks","Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif';
const SHEETS_PER_BATCH = 6;
const EN_SCRIPT = '"Kaushan Script","Brush Script MT",cursive';

const CSS = `
@font-face{font-family:"Yuji Syuku";src:url("${import.meta.env.BASE_URL}fonts/yuji-syuku-subset.woff2") format("woff2");font-display:swap}
@font-face{font-family:"Wayshrine Repeat Marks";src:url("${import.meta.env.BASE_URL}fonts/noto-serif-cjk-jp-repeat-marks.woff2") format("woff2");unicode-range:U+3033,U+3035;font-display:swap}
@font-face{font-family:"Kaushan Script";src:url("${import.meta.env.BASE_URL}fonts/kaushan-script.ttf") format("truetype");font-display:swap}
.hud .mu-box-button{gap:6px;padding:0 10px;line-height:1}
.mu-paper-icon{position:relative;display:block;width:18px;height:18px;color:#775540}
.mu-paper-icon::before,.mu-paper-icon::after{content:"";position:absolute;width:10px;height:12px;border:1px solid currentColor;border-radius:1px}
.mu-paper-icon::before{top:2px;left:2px;background:#ecd7b5;transform:rotate(-15deg)}
.mu-paper-icon::after{top:3px;left:6px;background:linear-gradient(currentColor,currentColor) 2px 4px/6px 1px no-repeat,linear-gradient(currentColor,currentColor) 2px 7px/4px 1px no-repeat,#fff8e7;transform:rotate(9deg)}
.hud .mu-box-button .mu-count{font-size:14px;font-variant-numeric:tabular-nums}
.mu-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#2a242466;pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#2a2424}
.mu-overlay.open{display:flex}
.mu-overlay.reading{color:#fff;pointer-events:none;background:radial-gradient(ellipse at 50% 52%,#120c0cc7,#120c0c80 40%,#120c0c00 77%);animation:mu-reveal .2s ease-out}
@keyframes mu-reveal{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.mu-overlay.reading{animation:none}}
.mu-card{position:relative;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:22px 24px 24px;border-radius:14px;background:#f4ecd8;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;outline:none}
.mu-overlay.reading.collection{pointer-events:auto}
.mu-overlay.collection:not(.reading){background:radial-gradient(ellipse at 50% 46%,#38261a66,#140c09d9)}
.mu-card.box{--peg:radial-gradient(circle at 46% 43%,#654b37 0 1px,#331d12 2px 3px,#c5926555 3.6px 4.1px,transparent 4.5px);
  box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) 45px;width:min(820px,calc(100vw - 24px));height:min(620px,calc(100dvh - 28px));max-height:none;overflow:hidden;padding:clamp(13px,3.2vw,26px);border:1px solid #362218;border-radius:8px 10px 7px 10px;color:#f4e3ba;
  background:
    var(--peg) left 4px top 4px/13px 13px no-repeat,var(--peg) right 4px top 4px/13px 13px no-repeat,
    var(--peg) left 4px bottom 4px/13px 13px no-repeat,var(--peg) right 4px bottom 4px/13px 13px no-repeat,
    linear-gradient(45deg,transparent 45%,#2c170d99 47% 51%,#d9a37944 53% 55%,transparent 57%) left top/25px 25px no-repeat,
    linear-gradient(-45deg,transparent 45%,#2c170d99 47% 51%,#d9a37944 53% 55%,transparent 57%) right top/25px 25px no-repeat,
    linear-gradient(-45deg,transparent 45%,#2c170d99 47% 51%,#d9a37944 53% 55%,transparent 57%) left bottom/25px 25px no-repeat,
    linear-gradient(45deg,transparent 45%,#2c170d99 47% 51%,#d9a37944 53% 55%,transparent 57%) right bottom/25px 25px no-repeat,
    linear-gradient(7deg,transparent 37%,#d3a47869 42% 46%,#3e251b8c 49% 54%,transparent 60%) right 36px top 4px/57px 8px no-repeat,
    linear-gradient(-5deg,transparent 32%,#24160f59 40% 47%,#c0916059 50% 55%,transparent 63%) left 24px bottom 5px/66px 9px no-repeat,
    radial-gradient(ellipse 68px 13px at 14% 97%,transparent 27%,#2e170c5c 30% 39%,#cf956538 42% 45%,transparent 55%),
    radial-gradient(ellipse 110px 14px at 83% 4%,#3b201485,transparent 68%),
    repeating-linear-gradient(3deg,transparent 0 8px,#d0a47723 9px,#10060425 10px 12px,transparent 14px 23px,#cd996414 24px 25px,transparent 27px 32px),
    linear-gradient(108deg,#936248,#634026 33%,#75482e 72%,#4c2c20);
  box-shadow:inset 2px 2px 0 #d7a77677,inset -3px -4px 0 #351a12bb,inset 0 0 0 6px #2e190d50,0 3px 0 #533326,0 7px 0 #2f1b13,0 25px 48px #000a}
.mu-card.box .mu-x{top:9px;right:9px;color:#f4e3ba;background:#3b221e85}
.mu-card.box .mu-x:hover{background:#39201c}
.mu-overlay.reading .mu-card{width:min(700px,calc(100vw - 48px));max-height:calc(100svh - 64px);padding:0;overflow:visible;border:0;border-radius:0;background:none;box-shadow:none;text-shadow:0 1px 4px #120c0c,0 0 18px #120c0c99}
.mu-overlay.reading .mu-x{top:-6px;right:0;pointer-events:auto;background:#120c0c80}
.mu-overlay.reading .mu-x:hover{background:#120c0cbb}
.mu-overlay.reading .mu-back{pointer-events:auto}
.mu-overlay.reading .mu-kind{opacity:.8;margin-bottom:clamp(12px,3vh,28px)}
.mu-x{all:unset;position:absolute;top:10px;right:10px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:18px}
.mu-x:hover{background:#2a242414}
.mu-kind{font-size:12px;letter-spacing:.08em;opacity:.6;text-align:center;margin-bottom:12px}
.mu-ja,.mu-by:lang(ja){font-family:${JA_SCRIPT}}
.mu-ja{font-size:clamp(24px,5.2vmin,56px);line-height:1.4;text-align:center;letter-spacing:.06em;margin:0 0 clamp(16px,3vh,30px);overflow-wrap:anywhere}
.mu-ja.v{writing-mode:vertical-rl;white-space:nowrap;width:fit-content;margin:0 auto clamp(16px,3vh,30px);font-size:clamp(16px,4svh,38px);line-height:1.6;letter-spacing:.08em}
.mu-line{display:block;margin-left:.5em}
.mu-line:nth-child(2){margin-top:1.2em}
.mu-line:nth-child(3){margin-top:2.4em}
.mu-en,.mu-item .e,.mu-by:lang(en){font-family:${EN_SCRIPT}}
.mu-en{text-align:center;font-size:clamp(18px,3.2vmin,34px);line-height:1.35;white-space:pre-line;margin:0 auto;max-width:40ch;overflow-wrap:anywhere}
.mu-by-ja{font-family:${JA_SCRIPT};margin-left:.3em}
.mu-by{text-align:center;font-size:clamp(14px,2.3vmin,21px);opacity:.84;margin:clamp(8px,2vh,18px) 0 0}
.mu-bar{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;column-gap:14px;row-gap:2px;margin:0 25px 12px 4px}
.mu-bar h2{margin:0;color:#f8e6bd;font:400 clamp(25px,4.2vw,37px)/1.12 ${EN_SCRIPT};text-shadow:0 2px 3px #2a140e}
.mu-bar h2:lang(ja){font-family:${JA_SCRIPT}}
.mu-prog{font-size:12px;color:#ead4ad;font-variant-numeric:tabular-nums}
.mu-well{min-height:0;overflow:auto;overscroll-behavior:contain;padding:clamp(12px,3vw,25px);border:1px solid #ba86575c;border-radius:3px 5px 2px 4px;background:
  radial-gradient(ellipse at 9% 82%,#1f1410bb,transparent 52%),
  repeating-linear-gradient(1deg,transparent 0 9px,#8c604a33 10px,#1d100a55 12px 14px,transparent 16px 24px),
  radial-gradient(ellipse at 40% 33%,#5b3e2f,#352720 74%);
  box-shadow:inset 0 4px 14px #160c09d9,inset 0 -1px 0 #a6744e77;scrollbar-color:#8e654a #31221c;scrollbar-width:thin}
.mu-deck{height:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(168px,1fr));column-gap:clamp(13px,3vw,28px);row-gap:clamp(14px,2.8vw,24px);animation:mu-leaf-in .18s ease-out}
@keyframes mu-leaf-in{from{opacity:.75;transform:translateY(3px)}to{opacity:1;transform:none}}
.mu-item{all:unset;--tilt:-2deg;--paper:#f1e2bf;--mark-x:12%;--mark-y:90%;--fold:119deg;--fold-at:57%;--edge:polygon(1% 2%,18% 1%,38% 2%,56% 0,79% 1%,96% 0,100% 5%,99% 27%,100% 51%,98% 74%,99% 98%,73% 99%,53% 98%,26% 100%,2% 98%,0 74%,1% 45%,0 16%);
  cursor:pointer;box-sizing:border-box;isolation:isolate;position:relative;display:flex;flex-direction:column;align-items:flex-start;min-width:0;padding:clamp(10px,1.7vw,15px);color:#302939;overflow-wrap:anywhere;
  transform:rotate(var(--tilt));filter:drop-shadow(2px 5px 3px #160d09a0);transition:transform .17s ease}
.mu-item::before,.mu-item::after{content:"";position:absolute;inset:0;z-index:-1;clip-path:var(--edge);pointer-events:none}
.mu-item::before{
  background:
    radial-gradient(ellipse at var(--mark-x) var(--mark-y),#75421748,transparent 45%),
    linear-gradient(var(--fold),transparent calc(var(--fold-at) - .8%),#6a421818 var(--fold-at) calc(var(--fold-at) + .4%),#fff8dd81 calc(var(--fold-at) + .6%) calc(var(--fold-at) + 1.1%),transparent calc(var(--fold-at) + 2%)),
    repeating-linear-gradient(94deg,#8053300b 0 1px,transparent 1px 4px),
    radial-gradient(ellipse at 76% 13%,#fff7d9a6,transparent 69%),var(--paper);
  box-shadow:inset 0 0 10px #a16d3a82}
.mu-item::after{z-index:-2;transform:translate(1px,3px) rotate(.7deg);background:#a1855c}
.mu-item:nth-child(2n){--tilt:2deg;--paper:#e8d6ac;--mark-x:90%;--mark-y:23%;--fold:82deg;--fold-at:70%}
.mu-item:nth-child(3n){--tilt:-.9deg;--paper:#efe1bf;--mark-x:70%;--mark-y:100%;--fold:158deg;--fold-at:36%}
.mu-item:nth-child(5n){--tilt:2.8deg;--paper:#eedcb4;--mark-x:4%;--mark-y:40%;--fold:37deg;--fold-at:49%}
.mu-item:hover{z-index:1;transform:translateY(-3px) rotate(0deg)}
.mu-item .j{font:400 clamp(16px,2.45vw,23px)/1.24 ${JA_SCRIPT}}
.mu-item .e{font-size:clamp(13px,2vw,16px);line-height:1.18;margin-top:5px;color:#504343}
.mu-item.long .j{font-size:clamp(15px,2.15vw,20px)}
.mu-item.long .e{font-size:clamp(14px,1.85vw,16px)}
.mu-item .mu-seal{margin-top:auto;padding:8px 0 0;transform:rotate(-3.5deg);color:#943b32;font:14px/1.2 ${UI_FONT}}
.mu-seal span{display:inline-block;border:1px solid #a94438;border-radius:2px;padding:2px 4px}
.mu-rail{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:7px 0 0;font-variant-numeric:tabular-nums;font-size:12px}
.mu-turn{all:unset;cursor:pointer;min-height:34px;padding:0 8px;border-radius:3px;color:inherit;font-size:13px}
.mu-turn:not(:disabled):hover{background:#21130f75;color:#fff4d4}
.mu-turn:disabled{opacity:.45;cursor:default}
.mu-empty{text-align:center;opacity:.75;padding:18px 0}
.box .mu-empty{max-width:32ch;min-height:80px;display:grid;place-items:center;margin:0 auto;color:#f4e3ba;font:clamp(17px,3vw,23px)/1.4 ${EN_SCRIPT}}
.box .mu-empty:lang(ja){font-family:${JA_SCRIPT}}
@media(max-width:620px){
  .mu-card.box{height:min(660px,calc(100dvh - 28px))}
  .mu-deck{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(157px,1fr))}
}
@media(max-width:374px){
  .mu-deck{grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(6,minmax(132px,1fr))}
}
@media(prefers-reduced-motion:reduce){.mu-deck{animation:none}.mu-item{transition:none}}
.mu-back{all:unset;cursor:pointer;font-size:12px;opacity:.65;margin-bottom:6px;display:inline-block}
.mu-back:hover{opacity:1}
@media(max-width:480px){
  .mu-overlay.reading{box-sizing:border-box;padding-bottom:10svh}
  .mu-ja.v{font-size:clamp(14px,3.4svh,30px)}
}
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

/** The inscription overlay and rubbing box. */
export function createMonumentUi(
  container: HTMLElement,
  actions: HTMLElement,
  source: {
    collected(): readonly string[];
    language(): Locale;
    /** Plays a sound as the box opens or a page of the box turns. */
    sound(cue: "box-open" | "box-flip"): void;
  },
): MonumentUi {
  const style = el("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const boxButton = el("button", "hud-action mu-box-button", actions);
  boxButton.type = "button";
  boxButton.setAttribute("aria-haspopup", "dialog");
  boxButton.setAttribute("aria-controls", "rubbing-box-view");
  boxButton.setAttribute("aria-keyshortcuts", "B");
  el("span", "mu-paper-icon", boxButton).setAttribute("aria-hidden", "true");
  const boxCount = el("span", "mu-count", boxButton);

  const overlay = el("div", "mu-overlay", container);
  const card = el("div", "mu-card", overlay);
  card.id = "rubbing-box-view";
  card.tabIndex = -1;

  let texts: ReadonlyMap<string, TextEntry> | null = null;
  void loadTexts().then((loaded) => {
    texts = loaded;
    if (open) render();
  });

  type View = { kind: "box" } | { kind: "text"; id: string; fromBox: boolean };
  let view: View = { kind: "box" };
  let open = false;
  let batch = 0;
  const isBoxOpen = (): boolean => open && (view.kind === "box" || view.fromBox);

  function renderText(t: ReturnType<typeof messagesFor>, language: Locale, v: Extract<View, { kind: "text" }>): void {
    const entry = texts?.get(v.id);
    if (v.fromBox) {
      const back = el("button", "mu-back", card);
      back.type = "button";
      back.textContent = `← ${t.monuments.box}`;
      back.addEventListener("click", () => returnToBox(v.id));
    }
    if (!entry) {
      setText(el("p", "mu-empty", card), t.monuments.loading);
      return;
    }
    setText(el("div", "mu-kind", card), t.monuments.kind[entry.kind]);
    const ja = el("div", entry.kind === "haiku" ? "mu-ja v" : "mu-ja", card);
    ja.lang = "ja";
    if (entry.lines) for (const line of entry.lines) setText(el("div", "mu-line", ja), line);
    else setText(ja, entry.ja);
    // The Japanese text stands alone in Japanese; the English rendering appears only in English.
    if (language === "en") {
      const english = el("p", "mu-en", card);
      english.lang = "en";
      setText(english, entry.en);
    }
    if (entry.by) {
      const by = el("p", "mu-by", card);
      by.lang = language;
      setText(by, `— ${entry.by[language]}`);
      if (language === "en") {
        // The Japanese name always appears, in the Japanese typeface, beside the English one.
        const ja = el("span", "mu-by-ja", by);
        ja.lang = "ja";
        setText(ja, `（${entry.by.ja}）`);
      }
    }
  }

  function lastBatch(count: number): number {
    return Math.max(0, Math.ceil(count / SHEETS_PER_BATCH) - 1);
  }

  function leaf(direction: number): void {
    const next = Math.max(0, Math.min(lastBatch(source.collected().length), batch + direction));
    if (next === batch) return;
    batch = next;
    source.sound("box-flip");
    render();
    card.scrollTop = 0;
    const turn = card.querySelector<HTMLButtonElement>(direction < 0 ? ".mu-newer" : ".mu-older");
    (turn && !turn.disabled ? turn : card).focus({ preventScroll: true });
  }

  function renderBox(t: ReturnType<typeof messagesFor>, language: Locale): void {
    const found = source.collected();
    const bar = el("div", "mu-bar", card);
    const title = el("h2", undefined, bar);
    title.lang = language;
    setText(title, t.monuments.box);
    setText(el("span", "mu-prog", bar), t.monuments.progress(found.length, TEXT_COUNT));
    const well = el("div", "mu-well", card);
    if (found.length === 0 || !texts) {
      const message = el("p", "mu-empty", well);
      message.lang = language;
      setText(message, found.length === 0 ? t.monuments.empty : t.monuments.loading);
      return;
    }

    batch = Math.min(batch, lastBatch(found.length));
    const end = found.length - batch * SHEETS_PER_BATCH;
    const start = Math.max(0, end - SHEETS_PER_BATCH);
    const deck = el("div", "mu-deck", well);
    for (const id of found.slice(start, end).reverse()) {
      const entry = texts.get(id);
      if (!entry) continue;
      const long = entry.ja.length > 15 || (language === "en" && entry.en.length > 72);
      const item = el("button", long ? "mu-item long" : "mu-item", deck);
      item.type = "button";
      item.dataset.rubbing = entry.id;
      const ja = el("span", "j", item);
      ja.lang = "ja";
      setText(ja, entry.ja);
      if (language === "en") {
        const english = el("span", "e", item);
        english.lang = "en";
        setText(english, entry.en.replace(/\n/g, " / "));
      }
      const seal = el("span", "mu-seal", item);
      setText(el("span", undefined, seal), t.monuments.kind[entry.kind]);
      item.addEventListener("click", () => show({ kind: "text", id: entry.id, fromBox: true }));
    }

    if (lastBatch(found.length) === 0) return;
    const rail = el("div", "mu-rail", card);
    const newer = el("button", "mu-turn mu-newer", rail);
    newer.type = "button";
    newer.disabled = batch === 0;
    setText(newer, `← ${t.monuments.newer}`);
    newer.addEventListener("click", () => leaf(-1));
    setText(el("span", undefined, rail), `${batch + 1} / ${lastBatch(found.length) + 1}`);
    const older = el("button", "mu-turn mu-older", rail);
    older.type = "button";
    older.disabled = start === 0;
    setText(older, `${t.monuments.older} →`);
    older.addEventListener("click", () => leaf(1));
  }

  function render(): void {
    const language = source.language();
    const t = messagesFor(language);
    const count = source.collected().length;
    const collectionOpen = isBoxOpen();
    setText(boxCount, String(count));
    boxButton.title = t.monuments.boxOpen;
    boxButton.setAttribute("aria-label", `${t.monuments.boxOpen} · ${t.monuments.progress(count, TEXT_COUNT)}`);
    boxButton.setAttribute("aria-expanded", String(collectionOpen));
    card.replaceChildren();
    const reading = view.kind === "text";
    overlay.classList.toggle("reading", reading);
    overlay.classList.toggle("collection", collectionOpen);
    card.classList.toggle("box", !reading);
    card.setAttribute("role", collectionOpen ? "dialog" : "region");
    if (collectionOpen) card.setAttribute("aria-modal", "true");
    else card.removeAttribute("aria-modal");
    card.setAttribute("aria-label", reading ? t.monuments.inscription : t.monuments.box);
    const x = el("button", "mu-x", card);
    x.type = "button";
    x.textContent = "×";
    x.title = t.monuments.close;
    x.setAttribute("aria-label", t.monuments.close);
    x.addEventListener("click", close);
    if (view.kind === "text") renderText(t, language, view);
    else renderBox(t, language);
  }

  function show(next: View): void {
    view = next;
    open = true;
    overlay.classList.add("open");
    render();
    card.scrollTop = 0;
    card.focus({ preventScroll: true });
  }

  function returnToBox(id: string): void {
    show({ kind: "box" });
    const item = card.querySelector<HTMLButtonElement>(`.mu-item[data-rubbing="${globalThis.CSS.escape(id)}"]`);
    item?.focus();
  }

  function close(): void {
    if (!open) return;
    const fromBox = isBoxOpen();
    open = false;
    overlay.classList.remove("open");
    boxButton.setAttribute("aria-expanded", "false");
    if (fromBox) {
      boxButton.focus({ preventScroll: true });
      return;
    }
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && card.contains(focused)) focused.blur();
  }

  const toggleBox = (): void => {
    if (isBoxOpen()) close();
    else {
      source.sound("box-open");
      show({ kind: "box" });
    }
  };
  boxButton.addEventListener("click", toggleBox);
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });
  // Capture Escape while the box or a rubbing is open.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!open || e.repeat) return;
      if (view.kind === "box" && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        leaf(e.code === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.code !== "Escape") return;
      e.stopImmediatePropagation();
      if (view.kind === "text" && view.fromBox) returnToBox(view.id);
      else close();
    },
    true,
  );
  render();

  const isReading = (): boolean => open && view.kind === "text";
  return {
    isBoxOpen,
    isReading,
    read: (id) => {
      batch = 0;
      show({ kind: "text", id, fromBox: false });
    },
    toggleBox,
    dismissReading: () => {
      if (!isReading()) return false;
      close();
      return true;
    },
    refresh: () => {
      render();
    },
  };
}
