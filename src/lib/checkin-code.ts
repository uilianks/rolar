/** What the academy's printed QR carries: which academy, and its current secret. */
export type CheckinCode = { a: string; t: string };

/** Reads a check-in QR: our URL /checkin?a=&t= from any host (web, preview, production). Anything else is not ours. */
export function parseCheckin(data: string): CheckinCode | null {
  try {
    const url = new URL(data);
    const a = url.searchParams.get("a");
    const t = url.searchParams.get("t");
    if (!url.pathname.endsWith("/checkin") || !a || !t) return null;
    return { a, t };
  } catch {
    return null;
  }
}

/** The URL printed in the QR: opens the app's check-in page, so a phone's own camera works too. */
export function checkinUrl(origin: string, code: CheckinCode) {
  return `${origin}/checkin?a=${encodeURIComponent(code.a)}&t=${encodeURIComponent(code.t)}`;
}
