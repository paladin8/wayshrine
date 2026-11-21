import type { Messages } from "./messages";

export const ja: Messages = {
  capability: { boat: "ボート", snowshoes: "かんじき", climbing: "登山道具" },
  terrain: { meadow: "草原", water: "水域", snow: "雪原", mountain: "山岳" },
  blocked: (capability, terrain) => `${terrain}を越えるには${capability}が必要です。`,
  shrinesRestored: (count) => `蘇った祠: ${count}`,
  promptRestore: "Eキーで祠を蘇らせる",
  promptSkip: "Eキーでスキップ",
  compassHere: "祠はここ",
  compassNearest: (distance) => `最寄りの祠 · ${distance}`,
  map: { expand: "M: 拡大", close: "M: 閉じる" },
  settings: {
    title: "設定",
    open: "設定 (Esc)",
    close: "閉じる",
    audio: "オーディオ",
    music: "音楽の音量",
    soundEffects: "効果音の音量",
    muteAll: "すべての音を消す (N)",
    display: "表示",
    minimap: "ミニマップを表示",
    compass: "次の祠のコンパスを表示",
    language: "言語",
  },
};
