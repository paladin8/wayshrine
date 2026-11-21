import { createStage } from "../render";

/** Browser wiring: creates the stage, hooks up input, and runs the frame loop. */
export function startApp(container: HTMLElement): void {
  // ?seed=anything selects the world; the same seed always builds the same world.
  const seed = new URLSearchParams(window.location.search).get("seed") ?? "wayshrine";
  console.info(`wayshrine seed: ${seed}`);

  const stage = createStage(container);
  stage.setDemoIsland(seed);

  const fit = (): void => stage.resize(window.innerWidth, window.innerHeight);
  window.addEventListener("resize", fit);
  fit();

  // Drag to pan.
  let dragging = false;
  window.addEventListener("pointerdown", () => (dragging = true));
  window.addEventListener("pointerup", () => (dragging = false));
  window.addEventListener("pointermove", (e) => {
    if (dragging) stage.panBy(e.movementX, e.movementY);
  });

  const frame = (): void => {
    stage.render();
    requestAnimationFrame(frame);
  };
  frame();
}
