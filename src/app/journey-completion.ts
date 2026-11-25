import type { Point, Region } from "../world";
import { messagesFor, type Locale } from "./i18n";
import { setText, UI_FONT } from "./style";

const CSS = `
.journey-complete{box-sizing:border-box;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:clamp(14px,3dvh,32px) 16px;border:0;color:#fff0cc;overflow:auto;background:radial-gradient(ellipse at 50% 48%,#382d24f7,#24201def 55%,#191817e3);text-align:center}
.journey-complete::backdrop{background:#100e0da8}
.journey-complete[open]{display:grid;animation:journey-enter .65s ease-out}
.journey-complete .jc-content{margin:auto;display:grid;justify-items:center;gap:clamp(7px,1.65dvh,18px)}
.journey-complete h2{margin:0;font:normal clamp(28px,5vw,60px)/1.1 "Kaushan Script",Georgia,cursive;color:#ffe7a9;text-shadow:0 3px 16px #100e0b}
.journey-complete:lang(ja) h2{font-family:"Yuji Syuku","Yu Mincho",serif}
.journey-complete p{margin:0;font:clamp(14px,2.4vw,17px)/1.4 ${UI_FONT}}
.journey-complete canvas{display:block;width:min(83vw,57dvh,520px);height:auto;aspect-ratio:1}
.journey-complete button{appearance:none;min-height:38px;padding:5px 22px;border:0;border-bottom:1px solid #d8b87588;background:none;color:#ffe6ad;font:clamp(16px,2.8vw,22px)/1.35 Georgia,"Yu Mincho",serif;cursor:pointer}
.journey-complete button:hover,.journey-complete button:focus-visible{outline:none;border-bottom-color:#ffe6ad}
@keyframes journey-enter{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.journey-complete[open]{animation:none}}
`;

type GroundBasis = (right: number, up: number) => Point;

const ease = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

interface ChartPoint {
  readonly x: number;
  readonly y: number;
  readonly last: boolean;
}

/** The Far Sight chart, repurposed to show every restored landmark. */
export function createJourneyCompletion(container: HTMLElement, basis: GroundBasis) {
  const style = document.createElement("style");
  style.textContent = CSS;
  const dialog = document.createElement("dialog");
  dialog.className = "journey-complete";
  dialog.setAttribute("aria-labelledby", "journey-complete-title");
  dialog.setAttribute("aria-describedby", "journey-complete-summary");
  dialog.addEventListener("keydown", (event) => {
    // Let the native dialog handle Escape without opening the settings behind it.
    if (event.code === "Escape") event.stopPropagation();
  });
  const content = document.createElement("div");
  content.className = "jc-content";
  const title = document.createElement("h2");
  title.id = "journey-complete-title";
  const summary = document.createElement("p");
  summary.id = "journey-complete-summary";
  const chart = document.createElement("canvas");
  chart.width = chart.height = 620;
  chart.setAttribute("aria-hidden", "true");
  const resume = document.createElement("button");
  resume.type = "button";
  resume.autofocus = true;
  resume.addEventListener("click", () => dialog.close());
  content.append(title, summary, chart, resume);
  dialog.append(content);
  container.append(style, dialog);

  const context = chart.getContext("2d");
  const rightAxis = basis(1, 0);
  const upAxis = basis(0, 1);
  const c = chart.width / 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealDuration = 2.4;
  let elapsed = 0;
  let points: ChartPoint[] = [];

  function draw(seconds: number): void {
    if (!context) return;
    const ctx = context;
    const ring = (x: number, y: number, radius: number, color: string): void => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.stroke();
    };

    ctx.clearRect(0, 0, 2 * c, 2 * c);
    for (const r of [0.32, 0.62, 0.91]) ring(c, c, c * r, "#e3ca8748");
    ctx.beginPath();
    ctx.moveTo(c * 0.09, c); ctx.lineTo(c * 1.91, c);
    ctx.moveTo(c, c * 0.09); ctx.lineTo(c, c * 1.91);
    ctx.strokeStyle = "#e3ca8730";
    ctx.stroke();

    for (const [i, point] of points.entries()) {
      const age = seconds - 1.35 * i / Math.max(1, points.length - 1);
      ctx.beginPath();
      if (age <= 0) {
        ctx.arc(point.x, point.y, 2.4, 0, 2 * Math.PI);
        ctx.fillStyle = "#c2836baa";
        ctx.fill();
        continue;
      }
      const light = ease(age / 0.42);
      const size = (point.last ? 12 : 7.3) + 3.5 * (1 - ease(age / 0.68));
      ctx.globalAlpha = 0.32 + 0.68 * light;
      ctx.shadowColor = "#eabf62";
      ctx.shadowBlur = (point.last ? 10 : 4) + 12 * (1 - ease(age / 0.9));
      for (let j = 0; j < 10; j++) {
        const angle = Math.PI * (j / 5 - 0.5);
        const r = j % 2 === 0 ? size : size * 0.42;
        ctx.lineTo(point.x + Math.cos(angle) * r, point.y + Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fillStyle = point.last ? "#fff1c6" : "#ffdf83";
      ctx.fill();
      ctx.shadowBlur = 0;
      if (point.last) ring(point.x, point.y, 18 + 30 * (1 - ease(age / 0.95)), "#ffe1a1aa");
      ctx.globalAlpha = 1;
    }
  }

  return {
    isOpen: () => dialog.open,
    close: () => dialog.close(),
    show(landmarks: readonly Region[], locale: Locale, finalLandmark?: Region) {
      const message = messagesFor(locale).completion;
      dialog.lang = locale;
      setText(title, message.title);
      setText(summary, message.summary(landmarks.length));
      setText(resume, message.resume);
      const projected = landmarks.map(({ id, shrine: { x, z } }) => ({
        id,
        right: x * rightAxis.x + z * rightAxis.z,
        up: x * upAxis.x + z * upAxis.z,
      }));
      const xs = projected.map((p) => p.right);
      const ys = projected.map((p) => p.up);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const scale = 2 * (c - 54) / Math.max(1, x1 - x0, y1 - y0);
      points = projected.map(({ id, right, up }) => ({
        x: c + (right - (x0 + x1) / 2) * scale,
        y: c - (up - (y0 + y1) / 2) * scale,
        last: id === finalLandmark?.id,
      }));
      // Light the stars outward from the centre, with the final landmark appearing last.
      points.sort((a, b) => Number(a.last) - Number(b.last) || Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c));
      elapsed = reducedMotion.matches ? revealDuration : 0;
      draw(elapsed);
      if (!dialog.open) dialog.showModal();
    },
    update(dt: number) {
      if (!dialog.open || elapsed >= revealDuration) return;
      elapsed = reducedMotion.matches ? revealDuration : Math.min(elapsed + dt, revealDuration);
      draw(elapsed);
    },
  };
}
