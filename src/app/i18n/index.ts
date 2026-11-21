import { en } from "./en";
import { ja } from "./ja";
import { LOCALES, type Locale, type Messages } from "./messages";

export { LOCALES, LOCALE_NAMES } from "./messages";
export type { Locale, Messages } from "./messages";

const CATALOGS: Readonly<Record<Locale, Messages>> = { en, ja };

export function messagesFor(locale: Locale): Messages {
  return CATALOGS[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The first supported language in the browser's preference order, or English. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}
