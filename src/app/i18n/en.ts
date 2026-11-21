import type { Messages } from "./messages";

export const en: Messages = {
  capability: { boat: "Boat", snowshoes: "Snowshoes", climbing: "Climbing gear" },
  terrain: { meadow: "meadow", water: "water", snow: "snow", mountain: "mountains" },
  blocked: (capability, terrain) => `You need the ${capability.toLowerCase()} to cross ${terrain}.`,
  shrinesRestored: (count) => `Shrines restored: ${count}`,
  promptRestore: "Press E to restore the shrine",
  promptSkip: "Press E to skip",
  compassHere: "Shrine here",
  compassNearest: (distance) => `Nearest shrine · ${distance}`,
  map: { expand: "M: expand", close: "M: close" },
  settings: {
    title: "Settings",
    open: "Settings (Esc)",
    close: "Close",
    audio: "Audio",
    music: "Music volume",
    soundEffects: "Sound effects volume",
    muteAll: "Mute all sound (N)",
    display: "Display",
    minimap: "Show minimap",
    compass: "Show next-shrine compass",
    language: "Language",
  },
};
