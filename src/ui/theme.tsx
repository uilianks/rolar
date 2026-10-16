// Design tokens from design/styles.css (21st.dev / shadcn look: zinc neutrals, 1px borders, 12px radius).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { prefs } from "@/lib/prefs";
import type { Belt, TechniqueCategory } from "@/shared/domain";

const light = {
  bg: "#ffffff",
  fg: "#09090b",
  card: "#ffffff",
  muted: "#f4f4f5",
  mutedFg: "#71717a",
  border: "#e4e4e7",
  primary: "#18181b",
  primaryFg: "#fafafa",
  accent: "#dc2626",
  accentSoft: "#fef2f2",
  success: "#16a34a",
  warn: "#d97706",
  ring: "#a1a1aa",
  heat: ["#f4f4f5", "#fecaca", "#f87171", "#dc2626", "#991b1b"],
};

const dark: typeof light = {
  bg: "#09090b",
  fg: "#fafafa",
  card: "#0f0f12",
  muted: "#18181b",
  mutedFg: "#a1a1aa",
  border: "#27272a",
  primary: "#fafafa",
  primaryFg: "#18181b",
  accent: "#ef4444",
  accentSoft: "#2a1212",
  success: "#22c55e",
  warn: "#f59e0b",
  ring: "#52525b",
  heat: ["#18181b", "#450a0a", "#7f1d1d", "#dc2626", "#f87171"],
};

export type Colors = typeof light;

export const BELT_COLORS: Record<Belt, string> = {
  grey_white: "#9ca3af",
  grey: "#9ca3af",
  grey_black: "#9ca3af",
  yellow_white: "#facc15",
  yellow: "#facc15",
  yellow_black: "#facc15",
  orange_white: "#f97316",
  orange: "#f97316",
  orange_black: "#f97316",
  green_white: "#16a34a",
  green: "#16a34a",
  green_black: "#16a34a",
  white: "#f5f5f4",
  blue: "#2563eb",
  purple: "#7c3aed",
  brown: "#8b4513",
  black: "#0a0a0a",
};

/** Node and badge colour per technique category (graph view, catalog). */
export const TECHNIQUE_COLORS: Record<TechniqueCategory, string> = {
  takedown: "#d97706",
  guard: "#2563eb",
  pass: "#7c3aed",
  sweep: "#16a34a",
  control: "#0891b2",
  submission: "#dc2626",
  escape: "#db2777",
};

/** Colour of the lengthwise centre stripe on the two-tone kids belts. */
export const BELT_MIDLINE: Partial<Record<Belt, string>> = {
  grey_white: BELT_COLORS.white,
  yellow_white: BELT_COLORS.white,
  orange_white: BELT_COLORS.white,
  green_white: BELT_COLORS.white,
  grey_black: BELT_COLORS.black,
  yellow_black: BELT_COLORS.black,
  orange_black: BELT_COLORS.black,
  green_black: BELT_COLORS.black,
};

export const radius = { sm: 8, md: 10, lg: 12, xl: 18, full: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export type ThemePref = "system" | "light" | "dark";

type ThemeCtx = { c: Colors; scheme: "light" | "dark"; pref: ThemePref; setPref: (p: ThemePref) => void };
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");
  useEffect(() => {
    prefs.get("theme").then((v) => v && setPrefState(v as ThemePref));
  }, []);
  const value = useMemo<ThemeCtx>(() => {
    const scheme = pref === "system" ? (system === "dark" ? "dark" : "light") : pref;
    return {
      c: scheme === "dark" ? dark : light,
      scheme,
      pref,
      setPref: (p) => {
        setPrefState(p);
        prefs.set("theme", p);
      },
    };
  }, [pref, system]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
