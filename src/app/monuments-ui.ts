import { TEXT_COUNT, TEXT_KINDS, loadTexts, type TextEntry, type TextKind } from "../content";
import { messagesFor, type Locale } from "./i18n";
import { UI_FONT, setText } from "./style";

export interface MonumentUi {
  isOpen(): boolean;
  /** Opens the card for one text (the player has just read it, or picked it from the book). */
  read(id: string): void;
  toggleBook(): void;
  close(): void;
  /** Re-draws after a language change or a new discovery. */
  refresh(): void;
}

const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP","Noto Serif JP",serif';

const CSS = `
.mu-book{position:fixed;top:52px;right:56px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;padding:0;border-radius:50%;background:#fffaf0cc;border:1px solid #2a242422;font-size:17px;line-height:1;color:#2a2424;cursor:pointer;pointer-events:auto}
.mu-book:hover{background:#fffaf0}
.mu-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#2a242466;pointer-events:auto;font:14px/1.4 ${UI_FONT};color:#2a2424}
.mu-overlay.open{display:flex}
.mu-card{position:relative;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:22px 24px 24px;border-radius:14px;background:#f4ecd8;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;outline:none}
.mu-card.wide{width:min(620px,calc(100vw - 32px))}
.mu-x{all:unset;position:absolute;top:10px;right:10px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:18px}
.mu-x:hover{background:#2a242414}
.mu-kind{font-size:12px;letter-spacing:.08em;opacity:.6;text-align:center;margin-bottom:12px}
.mu-ja{font-family:${SERIF};font-size:30px;line-height:1.5;text-align:center;letter-spacing:.08em;margin:6px 0 14px}
.mu-ja.v{writing-mode:vertical-rl;white-space:nowrap;width:fit-content;margin:6px auto 14px;font-size:clamp(18px,4vh,30px);line-height:1.6;letter-spacing:.1em}
.mu-line{display:block;margin-left:.5em}
.mu-line:nth-child(2){margin-top:1.2em}
.mu-line:nth-child(3){margin-top:2.4em}
.mu-en{text-align:center;font-size:16px;line-height:1.5;white-space:pre-line;opacity:.85;margin:0 0 10px}
.mu-by{text-align:center;font-size:13px;opacity:.6;margin:6px 0 0}
.mu-bar{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 28px 10px 0}
.mu-bar h2{margin:0;font-size:18px}
.mu-prog{opacity:.65;font-variant-numeric:tabular-nums}
.mu-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.mu-chip{all:unset;cursor:pointer;padding:4px 10px;border-radius:999px;border:1px solid #2a242433;background:#fffaf0;font-size:12px}
.mu-chip[aria-pressed=true]{background:#d96b59;border-color:#d96b59;color:#fff}
.mu-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.mu-item{all:unset;cursor:pointer;display:block;padding:10px 12px;border-radius:10px;background:#fffaf0;border:1px solid #2a242418}
.mu-item:hover{background:#fff}
.mu-item .j{font-family:${SERIF};font-size:16px;line-height:1.4}
.mu-item .e{font-size:12px;opacity:.6;margin-top:2px}
.mu-empty{text-align:center;opacity:.65;padding:18px 0}
.mu-back{all:unset;cursor:pointer;font-size:12px;opacity:.65;margin-bottom:6px;display:inline-block}
.mu-back:hover{opacity:1}
.mu-book:focus-visible,.mu-x:focus-visible,.mu-chip:focus-visible,.mu-item:focus-visible,.mu-back:focus-visible{outline:2px solid #d96b59;outline-offset:2px}
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

/** The reading card and the book of rubbings (every text the player has found). */
export function createMonumentUi(
  container: HTMLElement,
  source: { collected(): readonly string[]; language(): Locale },
): MonumentUi {
  const style = el("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const bookButton = el("button", "mu-book", container);
  bookButton.type = "button";
  bookButton.textContent = "📖";

  const overlay = el("div", "mu-overlay", container);
  const card = el("div", "mu-card", overlay);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
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
    if (entry.lines) for (const line of entry.lines) setText(el("div", "mu-line", ja), line);
    else setText(ja, entry.ja);
    // The Japanese text stands alone in Japanese; the English rendering appears only in English.
    if (language === "en") setText(el("p", "mu-en", card), entry.en);
    if (entry.by) setText(el("p", "mu-by", card), `— ${entry.by[language]}`);
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
      setText(el("div", "j", item), entry.ja);
      if (language === "en") setText(el("div", "e", item), entry.en.replace(/\n/g, " / "));
      item.addEventListener("click", () => show({ kind: "text", id: entry.id, fromBook: true }));
    }
  }

  function render(): void {
    const language = source.language();
    const t = messagesFor(language);
    bookButton.title = t.monuments.bookOpen;
    bookButton.setAttribute("aria-label", t.monuments.bookOpen);
    card.replaceChildren();
    card.classList.toggle("wide", view.kind === "book");
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
    card.focus();
  }

  function close(): void {
    if (!open) return;
    open = false;
    overlay.classList.remove("open");
    (document.activeElement as HTMLElement | null)?.blur(); // hand the keyboard back to the game
  }

  bookButton.addEventListener("click", () => (open && view.kind === "book" ? close() : show({ kind: "book" })));
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });
  // Capture phase, so Escape closes this dialog instead of also opening settings.
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

  return {
    isOpen: () => open,
    read: (id) => show({ kind: "text", id, fromBook: false }),
    toggleBook: () => (open && view.kind === "book" ? close() : show({ kind: "book" })),
    close,
    refresh: () => {
      render();
    },
  };
}
