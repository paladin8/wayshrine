import type { Region } from "../world";
import { drawStarMap, projectStarMap, STAR_MAP_SIZE, type GroundBasis } from "./star-map";
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
.journey-complete button:hover,.journey-complete button:focus-visible{border-bottom-color:#ffe6ad}
@keyframes journey-enter{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.journey-complete[open]{animation:none}}
`;

// Phrase accents in Starbound Farewell. Leave the final landmark for the last lift.
const STAR_PHRASES = [1.45, 5.55, 7.20, 9.10, 12.32, 15.35, 17.40, 19.42] as const;
const FINAL_STAR_AT = 20.54;
const REVEAL_DURATION = FINAL_STAR_AT + 1.15;
const AUDIO_START_GRACE = 0.65;

function ignitionTime(index: number, count: number): number {
  if (index === count - 1) return FINAL_STAR_AT;
  const interval = index / Math.max(1, count - 2) * (STAR_PHRASES.length - 1);
  const before = Math.min(Math.floor(interval), STAR_PHRASES.length - 2);
  const start = STAR_PHRASES[before]!;
  return start + (STAR_PHRASES[before + 1]! - start) * (interval - before);
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
  chart.width = chart.height = STAR_MAP_SIZE;
  chart.setAttribute("aria-hidden", "true");
  const resume = document.createElement("button");
  resume.type = "button";
  resume.autofocus = true;
  resume.addEventListener("click", () => dialog.close());
  content.append(title, summary, chart, resume);
  dialog.append(content);
  container.append(style, dialog);

  const context = chart.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  let audioWait = 0;
  let points: ReturnType<typeof projectStarMap> = [];
  let ignitions: number[] = [];

  const draw = (): void => {
    if (context) drawStarMap(context, points, (index) => elapsed - ignitions[index]!);
  };

  return {
    isOpen: () => dialog.open,
    close: () => dialog.close(),
    show(landmarks: readonly Region[], locale: Locale, finalLandmark?: Region) {
      const message = messagesFor(locale).completion;
      dialog.lang = locale;
      setText(title, message.title);
      setText(summary, message.summary(landmarks.length));
      setText(resume, message.resume);
      points = projectStarMap(landmarks, basis, finalLandmark?.id);
      ignitions = points.map((_, index) => ignitionTime(index, points.length));
      elapsed = reducedMotion.matches ? REVEAL_DURATION : 0;
      audioWait = AUDIO_START_GRACE;
      draw();
      if (!dialog.open) dialog.showModal();
    },
    update(dt: number, playbackTime: number | null) {
      if (!dialog.open || elapsed >= REVEAL_DURATION) return;
      // A blocked or unavailable track still gets the same choreography on the game clock.
      const fallback = elapsed + Math.max(0, dt - audioWait);
      audioWait = Math.max(0, audioWait - dt);
      const next = reducedMotion.matches ? REVEAL_DURATION : Math.min(playbackTime ?? fallback, REVEAL_DURATION);
      if (next <= elapsed) return;
      elapsed = next;
      draw();
    },
  };
}
