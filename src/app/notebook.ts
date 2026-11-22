import { landmarkNotes } from "../content";
import { messagesFor, type Locale } from "./i18n";
import { UI_FONT } from "./style";

/** The travel notebook: a handwritten entry for each restored landmark, with a way back to it. */
export interface Notebook {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
  /** Re-draws after a language change or a newly restored landmark. */
  refresh(): void;
}

export interface NotebookSource {
  /** Every landmark id, in book order. */
  readonly all: readonly string[];
  /** The ids the player has restored. */
  readonly restored: () => readonly string[];
  /** Debug: lists unrestored landmarks too, grayed out. Travel is always offered. */
  readonly debug: boolean;
  readonly language: () => Locale;
  /** Takes the player to the landmark. The notebook closes first. */
  readonly onTravel: (id: string) => void;
  /** Plays a sound as the book opens or a page turns. */
  readonly sound: (cue: "book-open" | "page-flip") => void;
}

const PER_PAGE = 2;
/** How long after the cover starts to move the opening sound plays. */
const SOUND_DELAY_MS = 350;
const HAND_EN = '"Kaushan Script","Segoe Script","Bradley Hand","Brush Script MT",cursive';
const HAND_JA = '"Yuji Syuku","Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif';
const NARROW = "(max-width: 760px)";

/** Fine speckle for leather and paper, and low-frequency brown stains for aged paper. */
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const STAINS = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><filter id='s'><feTurbulence type='fractalNoise' baseFrequency='.011' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .52 0 0 0 0 .33 0 0 0 0 .12 2.3 0 0 0 -1.05'/></filter><rect width='100%' height='100%' filter='url(%23s)'/></svg>")`;

const CSS = `
.nb-overlay{position:fixed;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 45%,#2a1f1a99,#120c0ccc);pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#3a2c26}
.nb-overlay.open{display:flex;animation:nb-in .22s ease-out}
@keyframes nb-in{from{opacity:0}to{opacity:1}}
.nb-book{--lh:clamp(22px,3.5vh,29px);--pad:clamp(8px,1.6vh,14px);position:relative;box-sizing:border-box;width:min(1000px,calc(100vw - 20px));height:min(660px,calc(100dvh - 24px));padding:var(--pad);outline:none}
.nb-back{position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:10px 14px 14px 10px;background:
  linear-gradient(225deg,#b8975a 0 22px,#0000 22px) top right/22px 22px no-repeat,
  linear-gradient(315deg,#b8975a 0 22px,#0000 22px) bottom right/22px 22px no-repeat,
  linear-gradient(135deg,#b8975a 0 22px,#0000 22px) top left/22px 22px no-repeat,
  linear-gradient(45deg,#b8975a 0 22px,#0000 22px) bottom left/22px 22px no-repeat,
  ${GRAIN},
  radial-gradient(ellipse 160px 46px at 78% 14%,#d9b47a38,#0000),
  radial-gradient(ellipse 90px 120px at 12% 78%,#0000003a,#0000),
  radial-gradient(ellipse 220px 60px at 40% 94%,#c99a6430,#0000),
  linear-gradient(90deg,#d2a46a2e,#0000 5%,#0000 95%,#d2a46a2e),
  radial-gradient(circle at 20% 15%,#6c3322,#4c2116 55%,#2f1209);
  box-shadow:0 22px 60px #000a,0 2px 0 #1f0905,inset 0 0 0 1px #ffffff12,inset 0 0 22px #0008,inset 0 2px 8px #ffffff18}
.nb-back::before{content:"";position:absolute;inset:6px;border:2px dashed #dcbf8a77;border-radius:8px}
.nb-spread{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;height:100%;border-radius:4px;box-shadow:0 4px 6px #0008}
.nb-spread.single{grid-template-columns:1fr}
.nb-page{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;padding:clamp(14px,3vh,26px) clamp(18px,3.4vw,34px) clamp(30px,5vh,40px) clamp(24px,4vw,46px);box-sizing:border-box;background:
  radial-gradient(ellipse at 50% 0%,#fff6dc 0%,#0000 70%),
  linear-gradient(#f1e4c2,#e8d8ae);box-shadow:inset 0 0 46px #8a5a2a40,inset 0 0 6px #6b43206a;overflow:hidden}
.nb-page.left{border-radius:4px 0 0 4px;background:
  linear-gradient(to left,#00000036,#0000 11%),
  radial-gradient(circle at 24% 86%,#0000 0 30px,#7a4b1f30 31px 34px,#7a4b1f12 35px 38px,#0000 40px),
  radial-gradient(ellipse at 50% 0%,#fff6dc 0%,#0000 70%),
  linear-gradient(#f1e4c2,#e8d8ae)}
.nb-page.right{border-radius:0 4px 4px 0;padding-left:clamp(18px,3.4vw,34px);padding-right:clamp(24px,4vw,46px);background:
  linear-gradient(to right,#00000036,#0000 11%),
  linear-gradient(172deg,#0000 58%,#7a4b1f1c 58.4%,#0000 59.2%),
  radial-gradient(ellipse at 50% 0%,#fff6dc 0%,#0000 70%),
  linear-gradient(#f1e4c2,#e8d8ae)}
.nb-page::before{content:"";position:absolute;inset:0;pointer-events:none;background:${STAINS},${GRAIN};opacity:.5}
.nb-page.left::after,.nb-page.right::after{content:"";position:absolute;top:0;bottom:0;width:2px;background:#c4584b66}
.nb-page.left::after{left:clamp(14px,2.4vw,32px)}
.nb-page.right::after{right:clamp(14px,2.4vw,32px)}
.nb-tape{position:absolute;top:-6px;width:84px;height:24px;background:#d9b86a99;box-shadow:0 1px 2px #0003;transform:rotate(-4deg);pointer-events:none}
.nb-page.left .nb-tape{left:24px}
.nb-page.right .nb-tape{right:24px;transform:rotate(3deg);background:#8fb3a299}
.nb-entry{position:relative;flex:1 1 0;min-height:0;display:flex;flex-direction:column;padding:6px 0 4px}
.nb-entry+.nb-entry{border-top:1px dashed #8a6b3a44;padding-top:clamp(8px,1.6vh,14px)}
.nb-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 2px;line-height:1.15}
.nb-no{font:12px ${UI_FONT};letter-spacing:.08em;color:#9a8566;font-variant-numeric:tabular-nums}
.nb-name{margin:0;font-weight:400;font-size:clamp(19px,3.4vh,26px);color:#2b2a4a}
.nb-name.en{font-family:${HAND_EN}}
.nb-name.ja,.nb-alt.ja{font-family:${HAND_JA}}
.nb-alt{font-size:clamp(13px,2.1vh,16px);color:#6b6358}
.nb-alt.en{font-family:${HAND_EN}}
.nb-body{flex:1 1 0;min-height:0;overflow:hidden;margin:4px 0 0;font-size:calc(var(--lh) * .62);line-height:var(--lh);color:#2b2a4a;background:linear-gradient(transparent calc(var(--lh) - 1px),#7f9bb255 0) 0 3px/100% var(--lh)}
.nb-body.en{font-family:${HAND_EN}}
.nb-body.ja{font-family:${HAND_JA};font-size:calc(var(--lh) * .66);letter-spacing:.04em}
.nb-entry:nth-child(odd) .nb-body{transform:rotate(-.25deg)}
.nb-entry:nth-child(even) .nb-body{transform:rotate(.2deg)}
.nb-go{all:unset;box-sizing:border-box;align-self:flex-end;cursor:pointer;margin-top:4px;padding:3px 12px;border:2px solid #b64e3d;border-radius:5px;color:#b64e3d;font:15px ${HAND_EN};letter-spacing:.02em;transform:rotate(-2deg);opacity:.92;transition:background .12s,color .12s}
.nb-go:lang(ja){font-family:${HAND_JA};font-size:14px}
.nb-go:hover,.nb-go:focus-visible{background:#b64e3d;color:#fbf3e2}
.nb-go:focus-visible{outline:2px solid #2b2a4a;outline-offset:2px}
.nb-entry.locked .nb-name,.nb-entry.locked .nb-alt,.nb-entry.locked .nb-no{color:#8d8a84}
.nb-entry.locked{filter:grayscale(1);opacity:.62}
.nb-entry.locked .nb-body{font-style:italic;color:#8d8a84;font-family:${UI_FONT};font-size:13px}
.nb-entry.locked .nb-go{border-color:#8d8a84;color:#6d6a64}
.nb-entry.locked .nb-go:hover,.nb-entry.locked .nb-go:focus-visible{background:#6d6a64;color:#fbf3e2}
.nb-empty{margin:auto 0;text-align:center;padding:0 8%;font-size:calc(var(--lh) * .7);line-height:var(--lh);color:#6a5f55}
.nb-empty.en{font-family:${HAND_EN}}
.nb-empty.ja{font-family:${HAND_JA}}
.nb-title{margin:auto 0;text-align:center;font-weight:400;font-size:clamp(24px,4.4vh,38px);color:#2b2a4a}
.nb-folio{position:absolute;bottom:clamp(8px,1.8vh,14px);left:0;right:0;text-align:center;font:13px ${HAND_EN};color:#9a8566;font-variant-numeric:tabular-nums}
.nb-ribbon{position:absolute;top:calc(100% - 14px);left:50%;margin-left:-9px;width:18px;height:44px;background:#a6392d;clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%);box-shadow:0 2px 3px #0005;pointer-events:none}
.nb-turn,.nb-x{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#2a1a14b8;color:#f1e3c4;font:20px/1 ${UI_FONT};border:1px solid #e2c58f55}
.nb-turn:hover,.nb-x:hover,.nb-turn:focus-visible,.nb-x:focus-visible{background:#2a1a14}
.nb-turn:focus-visible,.nb-x:focus-visible{outline:2px solid #f1e3c4;outline-offset:2px}
.nb-turn[disabled]{opacity:.3;cursor:default}
.nb-turn{position:absolute;bottom:clamp(6px,1.4vh,12px);z-index:2}
.nb-turn.prev{left:clamp(8px,2vw,20px)}
.nb-turn.next{right:clamp(8px,2vw,20px)}
.nb-x{position:absolute;top:-12px;right:-12px;z-index:3;font-size:18px}
@media(max-width:760px){.nb-ribbon{display:none}}
@media(prefers-reduced-motion:reduce){.nb-overlay.open{animation:none}}
.nb-spread{perspective:2600px}
.nb-spread.opening .nb-page.left{visibility:hidden}
.nb-book.opening .nb-turn,.nb-book.opening .nb-ribbon{opacity:0}
.nb-turn,.nb-ribbon{transition:opacity .3s}
.nb-leaf,.nb-lid{position:absolute;top:0;bottom:0;width:50%;z-index:4;pointer-events:none;transform-style:preserve-3d;will-change:transform}
.nb-leaf.fwd,.nb-lid{left:50%;transform-origin:0 50%}
.nb-leaf.back{left:0;transform-origin:100% 50%}
.nb-face{position:absolute;inset:0;overflow:hidden;box-shadow:0 0 16px #0006;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.nb-face.rear{transform:rotateY(180deg)}
.nb-face>.nb-page{position:absolute;inset:0;width:auto;height:auto}
.nb-lid{top:0;bottom:0}
.nb-face.cover,.nb-face.inside{background:
  ${GRAIN},
  radial-gradient(ellipse 160px 46px at 70% 14%,#d9b47a38,#0000),
  radial-gradient(ellipse 200px 60px at 40% 90%,#c99a6430,#0000),
  radial-gradient(circle at 20% 15%,#6c3322,#4c2116 55%,#2f1209);box-shadow:inset 0 0 22px #0008,0 0 16px #0006}
.nb-face.cover{border-radius:0 14px 14px 0;background:
  linear-gradient(225deg,#b8975a 0 22px,#0000 22px) top right/22px 22px no-repeat,
  linear-gradient(315deg,#b8975a 0 22px,#0000 22px) bottom right/22px 22px no-repeat,
  linear-gradient(90deg,#0000,#0000 94%,#d2a46a2e),
  ${GRAIN},
  radial-gradient(ellipse 160px 46px at 70% 14%,#d9b47a38,#0000),
  radial-gradient(ellipse 200px 60px at 40% 90%,#c99a6430,#0000),
  radial-gradient(circle at 20% 15%,#6c3322,#4c2116 55%,#2f1209)}
.nb-face.inside{border-radius:10px 0 0 10px;background:
  linear-gradient(135deg,#b8975a 0 22px,#0000 22px) top left/22px 22px no-repeat,
  linear-gradient(45deg,#b8975a 0 22px,#0000 22px) bottom left/22px 22px no-repeat,
  linear-gradient(270deg,#0000,#0000 94%,#d2a46a2e),
  ${GRAIN},
  radial-gradient(ellipse 90px 120px at 12% 78%,#0000003a,#0000),
  radial-gradient(circle at 20% 15%,#6c3322,#4c2116 55%,#2f1209)}
.nb-face.cover::before,.nb-face.inside::before{content:"";position:absolute;inset:6px 6px 6px 0;border:2px dashed #dcbf8a77;border-left:0;border-radius:0 8px 8px 0}
.nb-face.inside::before{inset:6px 0 6px 6px;border:2px dashed #dcbf8a77;border-right:0;border-radius:8px 0 0 8px}
.nb-inset{position:absolute;left:var(--pad);top:var(--pad);bottom:var(--pad);right:0}
.nb-inset>.nb-page{position:absolute;inset:0}
.nb-label{position:absolute;left:50%;top:50%;width:62%;padding:clamp(12px,2.6vh,22px) 10px;transform:translate(-50%,-50%) rotate(-1.2deg);text-align:center;font-size:clamp(20px,3.6vh,30px);line-height:1.2;color:#2b2a4a;background:${STAINS},linear-gradient(#efe0b8,#e2cf9f);box-shadow:0 1px 3px #0008,inset 0 0 14px #8a5a2a55;border:1px solid #7a4b1f66}
.nb-label.ja{font-family:${HAND_JA}}
.nb-label.en{font-family:${HAND_EN}}
.nb-book.opening{animation:nb-slide .95s cubic-bezier(.5,0,.25,1) .15s both}
@keyframes nb-slide{from{transform:translateX(-25%)}to{transform:none}}
.nb-back.closed{clip-path:inset(-40px -40px -40px 50%)}
.nb-spread.opening{clip-path:inset(-12px -12px -12px 50%)}
.nb-book.opening{perspective:2600px}
.nb-book.opening .nb-x{opacity:0}
.nb-leaf.fwd{animation:nb-flip-fwd .6s cubic-bezier(.45,.05,.4,1) forwards}
.nb-leaf.back{animation:nb-flip-back .6s cubic-bezier(.45,.05,.4,1) forwards}
.nb-lid{animation:nb-lid .95s cubic-bezier(.5,0,.25,1) .15s forwards}
@keyframes nb-flip-fwd{from{transform:rotateY(0)}to{transform:rotateY(-180deg)}}
@keyframes nb-flip-back{from{transform:rotateY(0)}to{transform:rotateY(180deg)}}
@keyframes nb-lid{from{transform:rotateY(0)}to{transform:rotateY(-180deg)}}
`;

interface Item {
  readonly id: string;
  /** 1-based position in the overall order. */
  readonly no: number;
  readonly restored: boolean;
}

interface View {
  readonly list: readonly Item[];
  readonly pages: number;
  readonly language: Locale;
}

export function createNotebook(container: HTMLElement, opener: HTMLElement, source: NotebookSource): Notebook {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.className = "nb-overlay";
  container.appendChild(overlay);
  const narrow = window.matchMedia(NARROW);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  let open = false;
  /** True while the cover or a page is moving; input to the book waits. */
  let busy = false;
  /** Index of the first visible page. */
  let page = 0;

  const items = (): Item[] => {
    const have = new Set(source.restored());
    const all = source.all.map((id, i) => ({ id, no: i + 1, restored: have.has(id) }));
    return source.debug ? all : all.filter((i) => i.restored);
  };
  const viewNow = (): View => {
    const list = items();
    return { list, pages: Math.max(1, Math.ceil(list.length / PER_PAGE)), language: source.language() };
  };
  const perView = (): number => (narrow.matches ? 1 : 2);
  const animated = (): boolean => !narrow.matches && !reduced.matches;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    node.className = cls;
    parent?.appendChild(node);
    return node;
  };

  function entry(item: Item, language: Locale, parent: HTMLElement): void {
    const t = messagesFor(language);
    const node = el("div", item.restored ? "nb-entry" : "nb-entry locked", parent);
    const head = el("div", "nb-head", node);
    el("span", "nb-no", head).textContent = language === "ja" ? `第${item.no}` : `No. ${item.no}`;
    const name = el("h3", `nb-name ${language}`, head);
    name.lang = language;
    name.textContent = t.landmarkNames[item.id] ?? item.id;
    if (language === "en") {
      // The Japanese name sits beside the English one; the Japanese book has no English.
      const alt = el("span", "nb-alt ja", head);
      alt.lang = "ja";
      alt.textContent = messagesFor("ja").landmarkNames[item.id] ?? "";
    }
    const body = el("p", `nb-body ${language}`, node);
    body.lang = language;
    body.textContent = item.restored ? (landmarkNotes[item.id]?.[language] ?? "") : t.notebook.locked;
    const go = el("button", "nb-go", node);
    go.type = "button";
    go.lang = language;
    go.textContent = `${t.notebook.travel} →`;
    go.addEventListener("click", () => {
      close();
      source.onTravel(item.id);
    });
  }

  /** One sheet of paper: its entries, or blank past the last page. */
  function buildPage(v: View, index: number, side: "left" | "right" | "solo"): HTMLElement {
    const t = messagesFor(v.language);
    const sheet = el("section", side === "solo" ? "nb-page left right" : `nb-page ${side}`);
    if (index < 0 || index >= v.pages) return sheet;
    el("div", "nb-tape", sheet);
    if (v.list.length === 0) {
      const title = el("h2", `nb-title ${v.language}`, sheet);
      title.style.fontFamily = v.language === "ja" ? HAND_JA : HAND_EN;
      title.textContent = t.notebook.title;
      el("p", `nb-empty ${v.language}`, sheet).textContent = t.notebook.empty;
    } else {
      for (const item of v.list.slice(index * PER_PAGE, (index + 1) * PER_PAGE)) entry(item, v.language, sheet);
    }
    el("div", "nb-folio", sheet).textContent = String(index + 1);
    return sheet;
  }

  function render(): void {
    const v = viewNow();
    const per = perView();
    const lastFirst = v.pages - 1 - ((v.pages - 1) % per);
    page = Math.min(Math.max(0, page - (page % per)), lastFirst);
    const t = messagesFor(v.language);

    overlay.replaceChildren();
    const book = el("div", "nb-book", overlay);
    el("div", "nb-back", book);
    book.tabIndex = -1;
    book.setAttribute("role", "dialog");
    book.setAttribute("aria-modal", "true");
    book.setAttribute("aria-label", t.notebook.title);
    const spread = el("div", per === 1 ? "nb-spread single" : "nb-spread", book);
    if (per === 1) spread.appendChild(buildPage(v, page, "solo"));
    else {
      spread.appendChild(buildPage(v, page, "left"));
      spread.appendChild(buildPage(v, page + 1, "right"));
      el("div", "nb-ribbon", book);
    }

    const button = (cls: string, glyph: string, label: string, run: () => void): void => {
      const b = el("button", cls, book);
      b.type = "button";
      b.textContent = glyph;
      b.title = label;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", run);
      if (cls.includes("prev")) b.disabled = page === 0;
      if (cls.includes("next")) b.disabled = page + per >= v.pages;
    };
    button("nb-turn prev", "‹", t.notebook.prev, () => turn(-1));
    button("nb-turn next", "›", t.notebook.next, () => turn(1));
    button("nb-x", "×", t.notebook.close, close);
    opener.setAttribute("aria-expanded", String(open));
  }

  const focusBook = (): void => overlay.querySelector<HTMLElement>(".nb-book")?.focus({ preventScroll: true });

  /** Runs `done` when the animation on `node` ends (or soon after, if the browser never reports it). */
  function whenDone(node: HTMLElement, ms: number, done: () => void): void {
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      done();
    };
    node.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, ms);
  }

  function turn(by: number): void {
    if (busy) return;
    const per = perView();
    const v = viewNow();
    const target = page + by * per;
    if (target < 0 || target >= v.pages) return;
    const spread = overlay.querySelector<HTMLElement>(".nb-spread");
    const sheets = spread?.querySelectorAll<HTMLElement>(":scope > .nb-page");
    source.sound("page-flip");
    if (!animated() || !spread || !sheets || sheets.length !== 2) {
      page = target;
      render();
      focusBook();
      return;
    }
    // A leaf carrying the old page on its front and the new one on its back turns over the spread.
    const [oldLeft, oldRight] = [sheets[0]!, sheets[1]!];
    const newLeft = buildPage(v, target, "left");
    const newRight = buildPage(v, target + 1, "right");
    const forward = by > 0;
    const leaf = el("div", forward ? "nb-leaf fwd" : "nb-leaf back");
    const front = el("div", "nb-face", leaf);
    const rear = el("div", "nb-face rear", leaf);
    front.appendChild(forward ? oldRight : oldLeft);
    rear.appendChild(forward ? newLeft : newRight);
    spread.replaceChildren(forward ? oldLeft : newLeft, forward ? newRight : oldRight, leaf);
    busy = true;
    whenDone(leaf, 900, () => {
      busy = false;
      if (!open) return;
      page = target;
      render();
      focusBook();
    });
  }

  /** The cover swings open on the right-hand side, and the first spread appears beneath it. */
  function openCover(): void {
    const book = overlay.querySelector<HTMLElement>(".nb-book");
    const spread = overlay.querySelector<HTMLElement>(".nb-spread");
    if (!book || !spread) return;
    const v = viewNow();
    book.classList.add("opening");
    spread.classList.add("opening");
    book.querySelector(".nb-back")?.classList.add("closed");
    // The whole front board turns, binding and all: its outside is the cover, its inside the left page.
    const lid = el("div", "nb-lid", book);
    const cover = el("div", "nb-face cover", lid);
    const label = el("div", `nb-label ${v.language}`, cover);
    label.textContent = messagesFor(v.language).notebook.title;
    const inside = el("div", "nb-face inside rear", lid);
    el("div", "nb-inset", inside).appendChild(buildPage(v, page, "left"));
    busy = true;
    whenDone(lid, 1400, () => {
      busy = false;
      if (open) render();
      focusBook();
    });
  }

  function show(): void {
    open = true;
    busy = false;
    page = 0;
    overlay.classList.add("open");
    render();
    if (animated()) {
      openCover();
      // The sound lands as the cover lifts, a beat after the animation starts.
      window.setTimeout(() => open && source.sound("book-open"), SOUND_DELAY_MS);
    } else source.sound("book-open");
    focusBook();
  }

  function close(): void {
    if (!open) return;
    open = false;
    busy = false;
    overlay.classList.remove("open");
    opener.setAttribute("aria-expanded", "false");
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && overlay.contains(focused)) focused.blur();
  }

  opener.setAttribute("aria-haspopup", "dialog");
  opener.setAttribute("aria-expanded", "false");
  opener.addEventListener("click", () => (open ? close() : show()));
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });
  narrow.addEventListener("change", () => {
    if (open && !busy) render();
  });
  // The notebook owns the keyboard while it is open.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!open) return;
      if (e.code === "Escape" || (e.code === "KeyJ" && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.stopImmediatePropagation();
        if (!e.repeat) close();
      } else if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.stopImmediatePropagation();
        turn(e.code === "ArrowLeft" ? -1 : 1);
      }
    },
    true,
  );

  return {
    isOpen: () => open,
    toggle: () => (open ? close() : show()),
    close,
    refresh: () => {
      if (open && !busy) render();
    },
  };
}
