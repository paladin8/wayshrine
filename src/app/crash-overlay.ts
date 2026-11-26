import { messagesFor, type Locale } from "./i18n";
import { UI_FONT } from "./style";

const CSS = `
.crash{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:#2a242499;font:15px/1.45 ${UI_FONT};color:#2a2424}
.crash-card{width:min(420px,calc(100vw - 32px));padding:22px 24px;border-radius:16px;background:#fffaf0;border:1px solid #2a242433;box-shadow:0 8px 32px #0005;text-align:center}
.crash-card h2{margin:0 0 8px;font-size:19px}
.crash-card p{margin:0 0 16px}
.crash-card button{font:inherit;cursor:pointer;padding:9px 22px;border-radius:10px;border:1px solid #2a242433;background:#d96b59;color:#fff}
.crash-card button:focus-visible{outline:2px solid #2a2424;outline-offset:2px}
`;

/** Whether an uncaught error came from the game's own code rather than a browser extension or another origin. */
export function isOurError(filename: string | undefined, origin: string): boolean {
  return !filename || filename.startsWith(origin);
}

/**
 * Replaces a frozen canvas with a plain message and a Reload button: after an uncaught error, or when the
 * GPU drops the WebGL context (a driver reset, or waking from sleep on some laptops). Shown once.
 */
export function installCrashOverlay(container: HTMLElement, language: () => Locale): void {
  let shown = false;
  const show = (contextLost: boolean): void => {
    if (shown) return;
    shown = true;
    const m = messagesFor(language()).crash;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
    const root = document.createElement("div");
    root.className = "crash";
    const card = document.createElement("div");
    card.className = "crash-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.textContent = m.title;
    const text = document.createElement("p");
    text.textContent = contextLost ? m.contextLost : m.message;
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = m.reload;
    reload.addEventListener("click", () => window.location.reload());
    card.append(title, text, reload);
    root.append(card);
    container.append(root);
    reload.focus();
  };
  window.addEventListener("error", (e) => {
    if (e.message.includes("ResizeObserver") || !isOurError(e.filename, window.location.origin)) return;
    console.error(e.error ?? e.message);
    show(false);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error(e.reason);
    show(false);
  });
  // The event does not bubble, so listen while it travels down to the canvas.
  window.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    show(true);
  }, true);
}
