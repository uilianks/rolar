// The app's language: the device's unless the person picked one in settings (kept per device).
import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { z } from "zod";

import { isLocale, messages, pickLocale, type Locale, type Messages } from "@/shared/i18n";

import { prefs } from "./prefs";

export type LocalePref = "system" | Locale;

/** Read once at start-up: Android restarts the app when the system language changes. */
const DEVICE: Locale = pickLocale(getLocales().map((l) => l.languageTag));
let current: Locale = DEVICE;

/** The active language, for code outside components (API headers, formatters, alerts). */
export function currentLocale() {
  return current;
}

/** The active dictionary outside components; components use `useT` so they re-render on a change. */
export function msg(): Messages {
  return messages(current);
}

type LocaleCtx = { locale: Locale; pref: LocalePref; setPref: (p: LocalePref) => void; t: Messages };
const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LocalePref>("system");
  const [locale, setLocale] = useState(current);
  // `current` changes together with the state, never during a render, so formatters called while
  // rendering always agree with the dictionary in the context.
  function apply(p: LocalePref) {
    current = p === "system" ? DEVICE : p;
    setPrefState(p);
    setLocale(current);
  }
  useEffect(() => {
    prefs.get("locale").then((v) => isLocale(v) && apply(v));
  }, []);
  useEffect(() => {
    z.config(locale === "pt" ? z.locales.pt() : z.locales.en());
    if (Platform.OS === "web") document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo<LocaleCtx>(
    () => ({
      locale,
      pref,
      t: messages(locale),
      setPref: (p) => {
        apply(p);
        prefs.set("locale", p);
      },
    }),
    [locale, pref],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLocale outside LocaleProvider");
  return ctx;
}

/** The dictionary of the active language. */
export function useT() {
  return useLocale().t;
}
