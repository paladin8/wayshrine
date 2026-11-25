import { UI_FONT } from "./style";

export interface MusicButtonModel {
  /** Which track is playing: its place, from 1, among the tracks that have been unlocked. */
  readonly number: number;
  /** How many tracks have been unlocked. */
  readonly total: number;
  /** The tooltip and accessible name. */
  readonly label: string;
  /** Whether the button is shown: there is a choice to make and the music can be heard. */
  readonly visible: boolean;
}

export interface MusicButton {
  readonly element: HTMLButtonElement;
  update(model: MusicButtonModel): void;
}

const CSS = `
.hud .music-button{gap:5px;padding:0 10px;font-variant-numeric:tabular-nums;font-family:${UI_FONT}}
.hud .music-note{font-size:18px;line-height:1}
.hud .music-number{font-size:13px;min-width:.7em;text-align:center}
`;

/** Cycles the background music through the tracks the traveller has unlocked. The note shows which one is playing. */
export function createMusicButton(actions: HTMLElement, onCycle: () => void): MusicButton {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const element = document.createElement("button");
  element.type = "button";
  element.className = "hud-action music-button";
  const note = document.createElement("span");
  note.className = "music-note";
  note.setAttribute("aria-hidden", "true");
  // Two beamed eighth notes.
  note.textContent = "♫";
  const number = document.createElement("span");
  number.className = "music-number";
  element.append(note, number);
  element.addEventListener("click", () => {
    onCycle();
    // Keep keyboard focus off the button so Space and Enter stay free for the game.
    element.blur();
  });
  actions.appendChild(element);

  let shown = "";
  return {
    element,
    update(model) {
      element.style.display = model.visible ? "" : "none";
      const key = `${model.number}/${model.total}/${model.label}`;
      if (key === shown) return;
      shown = key;
      number.textContent = String(model.number);
      element.setAttribute("aria-label", model.label);
    },
  };
}
