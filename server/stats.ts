// Training statistics computed from a user's sessions in their own time zone (weeks start on Monday).

import type { FinishCount } from "../src/shared/domain";

export type StatRow = {
  startedAt: Date;
  durationMin: number;
  rounds: number;
  rpe: number | null;
  kind: string;
  submissions?: FinishCount[];
  taps?: FinishCount[];
  techniques?: string[];
};

export type FinishStats = { total: number; top: FinishCount[] };

export type LoadBand = "low" | "ideal" | "high" | "none";

export type Stats = {
  totals: { sessions: number; minutes: number; rounds: number };
  thisWeek: { sessions: number; minutes: number; goal: number; days: string[] };
  streakWeeks: number;
  byKind: { kind: string; sessions: number }[];
  weeklyLoad: { week: string; load: number }[];
  loadBand: LoadBand;
  days: Record<string, number>;
  submissions: FinishStats;
  taps: FinishStats;
};

/** Adds up finishes across sessions; names match ignoring case, keeping the first spelling seen. */
export function tallyFinishes(lists: (FinishCount[] | undefined)[], limit = 5): FinishStats {
  const byKey = new Map<string, FinishCount>();
  let total = 0;
  for (const list of lists) {
    for (const f of list ?? []) {
      const key = f.name.trim().toLowerCase();
      const entry = byKey.get(key) ?? { name: f.name.trim(), count: 0 };
      entry.count += f.count;
      byKey.set(key, entry);
      total += f.count;
    }
  }
  const top = [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
  return { total, top };
}

export function localDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Monday of the week containing the local date `ymd` (YYYY-MM-DD). */
export function weekOf(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * `rows` are the sessions inside the requested range; totals and kinds use all of them, while the
 * weekly views look back from `now`.
 */
export function computeStats(rows: StatRow[], opts: { tz: string; now: Date; weeklyGoal: number }): Stats {
  const today = localDate(opts.now, opts.tz);
  const currentWeek = weekOf(today);
  const goal = Math.max(1, opts.weeklyGoal);

  const days: Record<string, number> = {};
  const perWeek = new Map<string, { sessions: number; load: number }>();
  const kinds = new Map<string, number>();
  const totals = { sessions: 0, minutes: 0, rounds: 0 };
  const thisWeek = { sessions: 0, minutes: 0, goal: opts.weeklyGoal, days: [] as string[] };

  for (const r of rows) {
    const day = localDate(r.startedAt, opts.tz);
    const week = weekOf(day);
    days[day] = (days[day] ?? 0) + 1;
    const w = perWeek.get(week) ?? { sessions: 0, load: 0 };
    w.sessions += 1;
    // A session without intensity (check-in, skipped) counts as training but adds no load.
    w.load += r.durationMin * (r.rpe ?? 0);
    perWeek.set(week, w);
    kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
    totals.sessions += 1;
    totals.minutes += r.durationMin;
    totals.rounds += r.rounds;
    if (week === currentWeek) {
      thisWeek.sessions += 1;
      thisWeek.minutes += r.durationMin;
      if (!thisWeek.days.includes(day)) thisWeek.days.push(day);
    }
  }
  thisWeek.days.sort();

  const streakWeeks = streakAt((w) => perWeek.get(w)?.sessions ?? 0, currentWeek, goal);

  const weeklyLoad = Array.from({ length: 8 }, (_, i) => {
    const week = addDays(currentWeek, -7 * (7 - i));
    return { week, load: perWeek.get(week)?.load ?? 0 };
  });

  const previous = weeklyLoad.slice(3, 7).map((w) => w.load);
  const baseline = previous.reduce((a, b) => a + b, 0) / previous.length;
  const current = weeklyLoad[7].load;
  const loadBand: LoadBand =
    baseline === 0 ? (current === 0 ? "none" : "ideal") : current < baseline * 0.8 ? "low" : current > baseline * 1.3 ? "high" : "ideal";

  return {
    totals,
    thisWeek,
    streakWeeks,
    byKind: [...kinds].map(([kind, sessions]) => ({ kind, sessions })).sort((a, b) => b.sessions - a.sessions),
    weeklyLoad,
    loadBand,
    days,
    submissions: tallyFinishes(rows.map((r) => r.submissions)),
    taps: tallyFinishes(rows.map((r) => r.taps)),
  };
}

/**
 * Consecutive weeks meeting the goal, counting back from the week before `week`; `week` itself extends
 * the streak once it meets the goal but does not break it (it may still be in progress).
 */
function streakAt(sessionsIn: (week: string) => number, week: string, goal: number) {
  let streak = sessionsIn(week) >= goal ? 1 : 0;
  for (let w = addDays(week, -7); sessionsIn(w) >= goal; w = addDays(w, -7)) streak += 1;
  return streak;
}

export type WeekSummary = {
  sessions: number;
  minutes: number;
  rounds: number;
  submissions: FinishStats;
  taps: FinishStats;
};

export type WeekReport = {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  current: WeekSummary & {
    days: string[];
    byKind: { kind: string; sessions: number }[];
    topTechniques: { name: string; count: number }[];
  };
  previous: WeekSummary;
  goal: number;
  goalMet: boolean;
  streakWeeks: number;
  /** The week has not ended yet (numbers can still grow). */
  inProgress: boolean;
  /** Monday of the first week with a session, to stop the "previous week" arrow. */
  firstWeek: string | null;
};

function summarize(rows: StatRow[]): WeekSummary {
  return {
    sessions: rows.length,
    minutes: rows.reduce((a, r) => a + r.durationMin, 0),
    rounds: rows.reduce((a, r) => a + r.rounds, 0),
    submissions: tallyFinishes(rows.map((r) => r.submissions), 3),
    taps: tallyFinishes(rows.map((r) => r.taps), 3),
  };
}

/** The weekly report for the week starting on `week` (a Monday), compared with the week before. */
export function weekReport(rows: StatRow[], opts: { tz: string; now: Date; week: string; weeklyGoal: number }): WeekReport {
  const weekOfRow = (r: StatRow) => weekOf(localDate(r.startedAt, opts.tz));
  const perWeek = new Map<string, number>();
  let firstWeek: string | null = null;
  for (const r of rows) {
    const w = weekOfRow(r);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
    if (!firstWeek || w < firstWeek) firstWeek = w;
  }
  const inWeek = rows.filter((r) => weekOfRow(r) === opts.week);
  const before = addDays(opts.week, -7);
  const kinds = new Map<string, number>();
  const techniques = new Map<string, { name: string; count: number }>();
  const days = new Set<string>();
  for (const r of inWeek) {
    kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
    days.add(localDate(r.startedAt, opts.tz));
    for (const name of r.techniques ?? []) {
      const key = name.trim().toLowerCase();
      const entry = techniques.get(key) ?? { name: name.trim(), count: 0 };
      entry.count += 1;
      techniques.set(key, entry);
    }
  }
  const goal = opts.weeklyGoal;
  return {
    week: opts.week,
    current: {
      ...summarize(inWeek),
      days: [...days].sort(),
      byKind: [...kinds].map(([kind, sessions]) => ({ kind, sessions })).sort((a, b) => b.sessions - a.sessions),
      topTechniques: [...techniques.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 3),
    },
    previous: summarize(rows.filter((r) => weekOfRow(r) === before)),
    goal,
    goalMet: goal > 0 && inWeek.length >= goal,
    streakWeeks: goal > 0 ? streakAt((w) => perWeek.get(w) ?? 0, opts.week, goal) : 0,
    inProgress: opts.week === weekOf(localDate(opts.now, opts.tz)),
    firstWeek,
  };
}

export type MonthTrend = { month: string; sessions: number; minutes: number; submissions: number; taps: number };

/** The last `months` calendar months (oldest first, current month last), in the user's time zone. */
export function monthlyTrend(rows: StatRow[], opts: { tz: string; now: Date; months: number }): MonthTrend[] {
  const current = localDate(opts.now, opts.tz).slice(0, 7);
  const [y, m] = current.split("-").map(Number);
  const months = Array.from({ length: opts.months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (opts.months - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const byMonth = new Map(months.map((month) => [month, { month, sessions: 0, minutes: 0, submissions: 0, taps: 0 }]));
  for (const r of rows) {
    const entry = byMonth.get(localDate(r.startedAt, opts.tz).slice(0, 7));
    if (!entry) continue;
    entry.sessions += 1;
    entry.minutes += r.durationMin;
    entry.submissions += (r.submissions ?? []).reduce((a, f) => a + f.count, 0);
    entry.taps += (r.taps ?? []).reduce((a, f) => a + f.count, 0);
  }
  return months.map((month) => byMonth.get(month)!);
}
