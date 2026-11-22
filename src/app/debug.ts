/** Buttons for developer testing, shown only with ?debug. */
export interface DebugActions {
  readonly restoreLandmarks: () => void;
  readonly unrestoreHere: () => void;
  readonly resetShrines: () => void;
  readonly resetAll: () => void;
  readonly goToTarget: () => void;
  readonly readRubbing: () => void;
}

export function createDebugPanel(container: HTMLElement, actions: DebugActions): void {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;left:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;" +
    "padding:10px;border-radius:12px;background:#2a2424dd;font:12px system-ui,sans-serif;color:#f2ede0";
  const title = document.createElement("div");
  title.textContent = "Debug";
  title.style.opacity = "0.7";
  panel.appendChild(title);

  const add = (label: string, run: () => void): void => {
    const button = document.createElement("button");
    button.textContent = label;
    button.style.cssText = "cursor:pointer;padding:4px 8px;border-radius:6px;border:0;background:#f2ede0;color:#2a2424";
    button.addEventListener("click", () => {
      run();
      button.blur(); // keep keyboard focus on the game
    });
    panel.appendChild(button);
  };
  add("Restore all landmarks", actions.restoreLandmarks);
  add("Un-restore here (U)", actions.unrestoreHere);
  add("Reset shrines", actions.resetShrines);
  add("Reset everything", actions.resetAll);
  add("Read a rubbing (R)", actions.readRubbing);
  add("Go to next shrine (G)", actions.goToTarget);
  container.appendChild(panel);
}
