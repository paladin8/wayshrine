import { TEXT_COUNT, TEXT_KINDS, loadTexts, type TextEntry, type TextKind } from "../content";
import { messagesFor, type Locale } from "./i18n";
import { UI_FONT, setText } from "./style";

export interface MonumentUi {
  isBookOpen(): boolean;
  isReading(): boolean;
  /** Displays the inscription over the scene. */
  read(id: string): void;
  toggleBook(): void;
  /** Dismisses a reading overlay and returns whether one was visible. */
  dismissReading(): boolean;
  /** Re-draws after a language change or a new discovery. */
  refresh(): void;
}

const JA_SCRIPT = '"Yuji Syuku","Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif';
const EN_SCRIPT = '"Kaushan Script","Brush Script MT",cursive';

const CSS = `
@font-face{font-family:"Yuji Syuku";src:url("${import.meta.env.BASE_URL}fonts/yuji-syuku.woff2") format("woff2");font-display:swap}
@font-face{font-family:"Kaushan Script";src:url("${import.meta.env.BASE_URL}fonts/kaushan-script.ttf") format("truetype");font-display:swap}
.hud .mu-book{gap:6px;padding:0 10px;font-size:17px;line-height:1}
.hud .mu-book .mu-count{font-size:14px;font-variant-numeric:tabular-nums}
.mu-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#2a242466;pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#2a2424}
.mu-overlay.open{display:flex}
.mu-overlay.reading{color:#fff;pointer-events:none;background:radial-gradient(ellipse at 50% 52%,#120c0cc7,#120c0c80 40%,#120c0c00 77%);animation:mu-reveal .2s ease-out}
@keyframes mu-reveal{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.mu-overlay.reading{animation:none}}
.mu-card{position:relative;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:22px 24px 24px;border-radius:14px;background:#f4ecd8;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;outline:none}
.mu-card.wide{width:min(620px,calc(100vw - 32px))}
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
.mu-bar{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 28px 10px 0}
.mu-bar h2{margin:0;font-size:18px}
.mu-prog{opacity:.65;font-variant-numeric:tabular-nums}
.mu-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.mu-chip{all:unset;cursor:pointer;padding:4px 10px;border-radius:999px;border:1px solid #2a242433;background:#fffaf0;font-size:12px}
.mu-chip[aria-pressed=true]{background:#d96b59;border-color:#d96b59;color:#fff}
.mu-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.mu-item{all:unset;cursor:pointer;display:block;padding:10px 12px;border-radius:10px;background:#fffaf0;border:1px solid #2a242418}
.mu-item:hover{background:#fff}
.mu-item .j{font-family:${JA_SCRIPT};font-size:18px;line-height:1.4}
.mu-item .e{font-size:15px;opacity:.8;margin-top:4px}
.mu-empty{text-align:center;opacity:.65;padding:18px 0}
.mu-back{all:unset;cursor:pointer;font-size:12px;opacity:.65;margin-bottom:6px;display:inline-block}
.mu-back:hover{opacity:1}
@media(max-width:480px){
  .mu-overlay.reading{box-sizing:border-box;padding-bottom:10svh}
  .mu-ja.v{font-size:clamp(14px,3.4svh,30px)}
}
.mu-x:focus-visible,.mu-chip:focus-visible,.mu-item:focus-visible,.mu-back:focus-visible{outline:2px solid #d96b59;outline-offset:2px}
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

/** The inscription overlay and book of discovered rubbings. */
export function createMonumentUi(
  container: HTMLElement,
  actions: HTMLElement,
  source: { collected(): readonly string[]; language(): Locale },
): MonumentUi {
  const style = el("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const bookButton = el("button", "hud-action mu-book", actions);
  bookButton.type = "button";
  el("span", undefined, bookButton).textContent = "📖";
  const bookCount = el("span", "mu-count", bookButton);

  const overlay = el("div", "mu-overlay", container);
  const card = el("div", "mu-card", overlay);
  card.tabIndex = -1;

  let texts: ReadonlyMap<string, TextEntry> | null = null;
  void loadTexts().then((loaded) => {
    texts = loaded;
    if (open) render();
  });

  type View = { kind: "book" } | { kind: "text"; id: string; fromBook: boolean };
  let view: View = { kind: "book" };
  let open = false;
  let filter: TextKind | null = null;

  function renderText(t: ReturnType<typeof messagesFor>, language: Locale, v: Extract<View, { kind: "text" }>): void {
    const entry = texts?.get(v.id);
    if (v.fromBook) {
      const back = el("button", "mu-back", card);
      back.type = "button";
      back.textContent = `← ${t.monuments.book}`;
      back.addEventListener("click", () => show({ kind: "book" }));
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

  function renderBook(t: ReturnType<typeof messagesFor>, language: Locale): void {
    const found = source.collected();
    const bar = el("div", "mu-bar", card);
    setText(el("h2", undefined, bar), t.monuments.book);
    setText(el("span", "mu-prog", bar), t.monuments.progress(found.length, TEXT_COUNT));
    if (found.length === 0) {
      setText(el("p", "mu-empty", card), t.monuments.empty);
      return;
    }
    const filters = el("div", "mu-filters", card);
    const chip = (label: string, value: TextKind | null): void => {
      const b = el("button", "mu-chip", filters);
      b.type = "button";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(filter === value));
      b.addEventListener("click", () => {
        filter = value;
        render();
      });
    };
    chip(t.monuments.filterAll, null);
    for (const kind of TEXT_KINDS) chip(t.monuments.kind[kind], kind);
    const list = el("div", "mu-list", card);
    const entries = texts ? [...found].reverse().map((id) => texts!.get(id)).filter((e): e is TextEntry => !!e) : [];
    for (const entry of entries) {
      if (filter && entry.kind !== filter) continue;
      const item = el("button", "mu-item", list);
      item.type = "button";
      const ja = el("div", "j", item);
      ja.lang = "ja";
      setText(ja, entry.ja);
      if (language === "en") {
        const english = el("div", "e", item);
        english.lang = "en";
        setText(english, entry.en.replace(/\n/g, " / "));
      }
      item.addEventListener("click", () => show({ kind: "text", id: entry.id, fromBook: true }));
    }
  }

  function render(): void {
    const language = source.language();
    const t = messagesFor(language);
    setText(bookCount, String(source.collected().length));
    bookButton.title = t.monuments.bookOpen;
    bookButton.setAttribute("aria-label", t.monuments.bookOpen);
    card.replaceChildren();
    const reading = view.kind === "text";
    overlay.classList.toggle("reading", reading);
    card.classList.toggle("wide", !reading);
    card.setAttribute("role", reading ? "region" : "dialog");
    if (reading) card.removeAttribute("aria-modal");
    else card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", t.monuments.book);
    const x = el("button", "mu-x", card);
    x.type = "button";
    x.textContent = "×";
    x.title = t.monuments.close;
    x.setAttribute("aria-label", t.monuments.close);
    x.addEventListener("click", close);
    if (view.kind === "text") renderText(t, language, view);
    else renderBook(t, language);
  }

  function show(next: View): void {
    view = next;
    open = true;
    overlay.classList.add("open");
    render();
    card.focus({ preventScroll: true });
  }

  function close(): void {
    if (!open) return;
    open = false;
    overlay.classList.remove("open");
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && card.contains(focused)) focused.blur();
  }

  bookButton.addEventListener("click", () => (open && view.kind === "book" ? close() : show({ kind: "book" })));
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });
  // Capture Escape while the book or a rubbing is open.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!open || e.code !== "Escape" || e.repeat) return;
      e.stopImmediatePropagation();
      if (view.kind === "text" && view.fromBook) show({ kind: "book" });
      else close();
    },
    true,
  );
  render();

  const isReading = (): boolean => open && view.kind === "text";
  return {
    isBookOpen: () => open && view.kind === "book",
    isReading,
    read: (id) => show({ kind: "text", id, fromBook: false }),
    toggleBook: () => (open && view.kind === "book" ? close() : show({ kind: "book" })),
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
