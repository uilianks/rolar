// Native apps do not print the poster; the web build (qr-poster.web.tsx) adds a print-only copy.
export { Poster } from "./qr-poster-card";

export function PrintPoster(_: { academyId: string; name: string }) {
  return null;
}
