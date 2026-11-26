import type { QualityChoice, QualityState } from "../render";

/** Buttons for developer testing, shown only with ?debug. */
export interface DebugActions {
  /** Rendering quality override, to preview the phone tiers on a desktop. */
  readonly quality?: { get(): QualityState; set(choice: QualityChoice): void };
  readonly restoreLandmarks: () => void;
  readonly unrestoreHere: () => void;
  readonly resetShrines: () => void;
  readonly resetAll: () => void;
  readonly goToTarget: () => void;
  readonly readRubbing: () => void;
  readonly previewBoatUnlock: () => void;
  readonly previewFirstVoyage: () => void;
  readonly previewFujiRide?: () => void;
  readonly previewSnowshoeUnlock: () => void;
  readonly previewSnowshoeUse: () => void;
  readonly previewGetaUse: () => void;
  readonly previewClimbUnlock: () => void;
  readonly previewGetaUnlock: () => void;
  readonly previewClimbUse: () => void;
  readonly previewLanternUnlock: () => void;
  readonly previewLanternUse: () => void;
  readonly previewAshSandalsUnlock: () => void;
  readonly previewAshSandalsUse: () => void;
  readonly previewShipUnlock: () => void;
  readonly previewShipUse: () => void;
  readonly previewPilgrimsWake: () => void;
}

const CSS = `
.debug-box,.debug-dialog{box-sizing:border-box;border:0;border-radius:12px;background:#2a2424;color:#f2ede0;font:12px system-ui,sans-serif}
.debug-box{position:fixed;left:14px;bottom:14px;display:grid;gap:6px;padding:10px;background:#2a2424dd;max-height:calc(100dvh - 28px);max-width:calc(100vw - 28px);overflow:auto}
.debug-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
.debug-box .debug-head span{opacity:.7}
.debug-button{cursor:pointer;padding:4px 8px;border:0;border-radius:6px;background:#f2ede0;color:#2a2424;font:inherit}
.debug-button:hover{background:#e9deca}
.debug-quality{display:flex;align-items:center;gap:6px}
.debug-quality select{padding:3px 4px;border:0;border-radius:6px;background:#f2ede0;color:#2a2424;font:inherit}
.debug-quality output{opacity:.7;font-variant-numeric:tabular-nums}
.debug-icon{width:28px;height:26px;padding:0;font-size:18px;line-height:1}
.debug-dialog{width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;box-shadow:0 12px 36px #0006;font-size:14px}
.debug-dialog::backdrop{background:#2a242477}
.debug-content{display:grid;gap:12px;padding:18px}
.debug-content h2{margin:0;font-size:18px}
.debug-content .debug-button:not(.debug-icon){padding:9px 12px;text-align:left}
`;

export function createDebugPanel(container: HTMLElement, actions: DebugActions, onOpen: () => void) {
  const style = document.createElement("style");
  style.textContent = CSS;
  const panel = document.createElement("div");
  panel.className = "debug-box";
  const head = document.createElement("div");
  head.className = "debug-head";
  const title = document.createElement("span");
  title.textContent = "Debug";
  head.appendChild(title);
  panel.appendChild(head);

  const dialog = document.createElement("dialog");
  dialog.className = "debug-dialog";
  dialog.setAttribute("aria-labelledby", "debug-gear-title");
  const close = (): void => dialog.close();
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  const add = (parent: HTMLElement, label: string, run: () => void): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "debug-button";
    button.textContent = label;
    button.addEventListener("click", () => {
      button.blur();
      run();
    });
    parent.appendChild(button);
    return button;
  };

  const more = add(head, "…", () => {
    onOpen();
    dialog.showModal();
  });
  more.classList.add("debug-icon");
  more.setAttribute("aria-label", "Gear acquisition tests");
  more.setAttribute("aria-haspopup", "dialog");
  more.title = "Gear acquisition tests";
  if (actions.previewFujiRide) add(panel, "Preview Mount Fuji ride", actions.previewFujiRide);
  add(panel, "Restore all landmarks", actions.restoreLandmarks);
  add(panel, "Un-restore here (U)", actions.unrestoreHere);
  add(panel, "Reset shrines", actions.resetShrines);
  add(panel, "Reset everything", actions.resetAll);
  add(panel, "Read a rubbing (R)", actions.readRubbing);
  add(panel, "Go to next shrine (G)", actions.goToTarget);
  if (actions.quality) addQuality(panel, actions.quality);

  const content = document.createElement("div");
  content.className = "debug-content";
  const dialogHead = document.createElement("div");
  dialogHead.className = "debug-head";
  const heading = document.createElement("h2");
  heading.id = "debug-gear-title";
  heading.textContent = "Gear acquisition";
  dialogHead.appendChild(heading);
  const dismiss = add(dialogHead, "×", close);
  dismiss.classList.add("debug-icon");
  dismiss.setAttribute("aria-label", "Close gear acquisition tests");
  dismiss.autofocus = true;
  content.appendChild(dialogHead);
  const preview = (label: string, run: () => void): void => {
    add(content, label, () => {
      close();
      run();
    });
  };
  preview("Preview boat unlock", actions.previewBoatUnlock);
  preview("Preview first voyage", actions.previewFirstVoyage);
  preview("Preview snowshoe unlock", actions.previewSnowshoeUnlock);
  preview("Preview snowshoe use", actions.previewSnowshoeUse);
  preview("Preview climbing unlock", actions.previewClimbUnlock);
  preview("Preview climbing use", actions.previewClimbUse);
  preview("Preview geta unlock", actions.previewGetaUnlock);
  preview("Preview geta use", actions.previewGetaUse);
  preview("Preview lantern unlock", actions.previewLanternUnlock);
  preview("Preview lantern use", actions.previewLanternUse);
  preview("Preview ash sandals unlock", actions.previewAshSandalsUnlock);
  preview("Preview ash sandals use", actions.previewAshSandalsUse);
  preview("Preview ship unlock", actions.previewShipUnlock);
  preview("Preview first sailing", actions.previewShipUse);
  preview("Preview Pilgrim’s Wake unlock", actions.previewPilgrimsWake);
  dialog.appendChild(content);
  container.append(style, panel, dialog);

  return { close, isOpen: () => dialog.open };
}

function addQuality(parent: HTMLElement, quality: NonNullable<DebugActions["quality"]>): void {
  const row = document.createElement("label");
  row.className = "debug-quality";
  row.append("Quality");
  const select = document.createElement("select");
  for (const [value, text] of [["auto", "Auto"], ["desktop", "Desktop"], ["phone", "Phone"], ["low", "Low-end phone"]] as const) {
    select.add(new Option(text, value));
  }
  const readout = document.createElement("output");
  const show = (): void => {
    const q = quality.get();
    select.value = q.choice;
    readout.textContent = `${q.choice === "auto" ? `${q.tier} · ` : ""}${q.pixelRatio}× · ${q.shadowMapSize}`;
  };
  select.addEventListener("change", () => {
    quality.set(select.value as QualityChoice);
    select.blur(); // keep the arrow keys for walking
    show();
  });
  row.append(select, readout);
  parent.appendChild(row);
  show();
  // In auto mode the frame governor can lower the pixel ratio at any time.
  setInterval(show, 1000);
}
