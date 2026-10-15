// Interface text, shared by the app and the API. Portuguese is the source; `en` must match its shape.
import { en } from "./en";
import { pt, type Messages } from "./pt";

export type { Messages };

export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const DICTIONARIES: Record<Locale, Messages> = { pt, en };

export function messages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

export function isLocale(v: unknown): v is Locale {
  return LOCALES.includes(v as Locale);
}

/** First supported language among BCP 47 tags in order of preference; English for everyone else. */
export function pickLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const lang = tag.trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return "en";
}

/** The language an HTTP request asks for (Accept-Language, in order; q-values are not weighed). */
export function requestLocale(acceptLanguage: string | null | undefined): Locale {
  return pickLocale((acceptLanguage ?? "").split(",").map((part) => part.split(";")[0]));
}

/** A zod issue message: schemas carry a `validation` key, zod's own messages pass through. */
export function validationMessage(m: Messages, message: string) {
  return (m.validation as Record<string, string>)[message] ?? message;
}
