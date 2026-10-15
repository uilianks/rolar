// Donation links, set at build time (.env.local / Vercel env). A provider without a link is hidden.
// Expo only inlines EXPO_PUBLIC_* variables written out literally, so each one is read by name.
const link = (value: string | undefined) => value?.trim() || null;

export const DONATIONS = {
  /** Web page the Android app sends people to (store rules: no in-app donation buttons). */
  page: link(process.env.EXPO_PUBLIC_DONATE_PAGE),
  kofi: link(process.env.EXPO_PUBLIC_DONATE_KOFI),
  liberapay: link(process.env.EXPO_PUBLIC_DONATE_LIBERAPAY),
  github: link(process.env.EXPO_PUBLIC_DONATE_GITHUB),
  repo: link(process.env.EXPO_PUBLIC_REPO_URL),
};
