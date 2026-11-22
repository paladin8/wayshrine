/** Falls back to common Japanese system fonts so kana and kanji render cleanly on every platform. */
export const UI_FONT =
  'system-ui,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans CJK JP",sans-serif';

/** Sets text only when it changes, so per-frame updates do not rewrite the DOM. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
