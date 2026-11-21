import type { Settings } from "./settings";

export interface AudioControls {
  /** Flips mute and returns the new settings. */
  toggleMute(): Settings;
}

const CSS = `
.audio{position:fixed;top:52px;right:14px;display:flex;align-items:center;gap:8px;padding:4px 10px;border-radius:999px;background:#fffaf0cc;border:1px solid #2a242422;font:14px/1 system-ui,sans-serif;color:#2a2424;pointer-events:auto}
.audio button{all:unset;cursor:pointer;font-size:16px;line-height:1}
.audio input{width:84px;accent-color:#d96b59}
`;

/** A mute button and volume slider. `onChange` receives the new settings. */
export function createAudioControls(
  container: HTMLElement,
  initial: Settings,
  onChange: (settings: Settings) => void,
): AudioControls {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  let settings = initial;
  const root = document.createElement("div");
  root.className = "audio";
  const button = document.createElement("button");
  button.title = "Mute music (N)";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.05";
  slider.title = "Music volume";
  root.append(button, slider);
  container.appendChild(root);

  const render = (): void => {
    button.textContent = settings.musicMuted || settings.musicVolume === 0 ? "🔇" : "🔊";
    slider.value = String(settings.musicVolume);
  };
  const set = (next: Settings): Settings => {
    settings = next;
    render();
    onChange(settings);
    return settings;
  };

  button.addEventListener("click", () => {
    set({ ...settings, musicMuted: !settings.musicMuted });
    button.blur(); // keep keyboard focus on the game
  });
  slider.addEventListener("input", () => set({ ...settings, musicVolume: Number(slider.value), musicMuted: false }));
  slider.addEventListener("change", () => slider.blur());
  render();

  return { toggleMute: () => set({ ...settings, musicMuted: !settings.musicMuted }) };
}
