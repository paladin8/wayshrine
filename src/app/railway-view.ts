import type { TrainFrame } from "../game";
import type { Messages } from "./i18n";

const CSS = `
.fuji-ride{position:fixed;inset:0;z-index:25;overflow:hidden;font:15px system-ui,sans-serif;color:#f4eee2}
.fuji-ride[hidden],.fuji-ride [hidden]{display:none}
.fuji-riding .hud,.fuji-riding .map,.fuji-riding .debug-box{visibility:hidden}
.fuji-pane{position:absolute;inset:7% 8% 19%;border-radius:clamp(17px,4vw,54px);border:clamp(8px,1.35vw,22px) solid #aca69d;box-sizing:border-box;box-shadow:0 0 0 1px #595854,0 0 0 120vmax #34393d,inset 0 -5px 22px #26373d4f;background:linear-gradient(155deg,#fcfbf418 0%,transparent 50%,#a2c2cb14 100%)}
.fuji-pane::after{content:"";position:absolute;left:-2%;right:-2%;bottom:-19px;height:10px;border-radius:40%;background:#bbb3a6;box-shadow:0 4px 11px #171c22b0}
.fuji-ride-controls{position:absolute;bottom:clamp(12px,5vh,55px);right:8%;left:8%;display:flex;justify-content:flex-end;align-items:center;gap:10px;z-index:1}
.fuji-ride-controls button{padding:8px 15px;border:1px solid #f2eee556;border-radius:999px;background:#2a2d30e8;color:inherit;font:inherit;cursor:pointer}
.fuji-ride-controls button:hover,.fuji-ride-controls button:focus-visible{background:#4d565d}
.fuji-loading{border-radius:999px;background:#262d31e0;padding:8px 14px}
.fuji-fade{position:absolute;inset:0;background:#252b2f;pointer-events:none;z-index:2}
`;

export function createRailwayView(container: HTMLElement, skip: () => void) {
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.className = "fuji-ride";
  root.hidden = true;
  const pane = document.createElement("div");
  pane.className = "fuji-pane";
  pane.setAttribute("aria-hidden", "true");
  const fade = document.createElement("div");
  fade.className = "fuji-fade";
  fade.setAttribute("aria-hidden", "true");
  const controls = document.createElement("div");
  controls.className = "fuji-ride-controls";
  const status = document.createElement("span");
  status.className = "fuji-loading";
  status.setAttribute("role", "status");
  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener("click", skip);
  controls.append(status, button);
  root.append(pane, controls, fade);
  container.append(style, root);
  return (frame: TrainFrame | undefined, loading: boolean, messages: Messages["railway"]): void => {
    const active = frame !== undefined;
    root.hidden = !active;
    container.classList.toggle("fuji-riding", active);
    if (!frame) return;
    pane.hidden = !frame.windowView;
    fade.style.opacity = String(frame.fade);
    status.hidden = !loading;
    if (status.textContent !== messages.preparing) status.textContent = messages.preparing;
    if (button.textContent !== messages.skip) button.textContent = messages.skip;
  };
}
