/** Falls back to common Japanese system fonts so kana and kanji render cleanly on every platform. */
export const UI_FONT =
  'system-ui,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans CJK JP",sans-serif';

/**
 * The brush face used for landmark names: Yuji Syuku (SIL OFL 1.1), subset to the characters the
 * names use (see public/fonts/OFL.txt). Falls back to a Mincho serif for anything else.
 */
export const BRUSH_FONT = '"Yuji Syuku Names","Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif';
export const BRUSH_FONT_FACE = `@font-face{font-family:"Yuji Syuku Names";src:url(${import.meta.env.BASE_URL}fonts/yuji-syuku-names.woff2) format("woff2");font-display:swap}`;

/** Sets text only when it changes, so per-frame updates do not rewrite the DOM. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
