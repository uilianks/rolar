import { msg } from "./i18n";

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** "1,5h" (or "1.5h") below 10 hours, "198h" above. */
export function hours(min: number) {
  const h = min / 60;
  return h < 10 ? `${new Intl.NumberFormat(msg().intl, { maximumFractionDigits: 1 }).format(h)}h` : `${Math.round(h)}h`;
}

/** "45 €" / "€45", cents only when there are any. */
export function euros(cents: number) {
  return new Intl.NumberFormat(msg().intl, { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Date formatter in the active language, cached per language and options. */
export function dateFmt(options: Intl.DateTimeFormatOptions) {
  const intl = msg().intl;
  const key = `${intl}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(intl, options)));
  return f;
}

/** "Hoje, 19:30", "Ontem, 07:00" or "qua., 08/10, 19:30". */
export function when(iso: string, now = new Date()) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const time = dateFmt({ hour: "2-digit", minute: "2-digit" }).format(d);
  if (days === 0) return msg().format.today(time);
  if (days === 1) return msg().format.yesterday(time);
  return `${dateFmt({ weekday: "short", day: "2-digit", month: "2-digit" }).format(d)}, ${time}`;
}

export function whenLong(iso: string) {
  return dateFmt({ weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** "agora", "5 min", "3 h", "2 dias". */
export function ago(iso: string, now = new Date()) {
  const s = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (s < 60) return msg().format.now;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return msg().format.days(Math.floor(s / 86400));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Local date as YYYY-MM-DD. */
export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a local date. */
export function isoWeekday(d: Date) {
  return ((d.getDay() + 6) % 7) + 1;
}

/** End time of a class: "19:00" + 90 min → "20:30". */
export function endTime(start: string, durationMin: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + durationMin;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** The latest date on or before `from` that falls on `weekday`. */
export function lastWeekday(weekday: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - ((isoWeekday(d) - weekday + 7) % 7));
  return d;
}

/** "março de 2026" / "March 2026" for a "YYYY-MM". */
export function monthYear(month: string) {
  return dateFmt({ month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00`));
}
