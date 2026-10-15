// Training statistics computed from a user's sessions in their own time zone (weeks start on Monday).

export type StatRow = { startedAt: Date; durationMin: number; rounds: number; rpe: number; kind: string };

export type LoadBand = "low" | "ideal" | "high" | "none";

export type Stats = {
  totals: { sessions: number; minutes: number; rounds: number };
  thisWeek: { sessions: number; minutes: number; goal: number; days: string[] };
  streakWeeks: number;
  byKind: { kind: string; sessions: number }[];
  weeklyLoad: { week: string; load: number }[];
  loadBand: LoadBand;
  days: Record<string, number>;
};

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
    w.load += r.durationMin * r.rpe;
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

  // Streak: consecutive weeks meeting the goal, counting back from last week; the current week
  // extends the streak once it meets the goal but does not break it while still in progress.
  let streakWeeks = (perWeek.get(currentWeek)?.sessions ?? 0) >= goal ? 1 : 0;
  for (let week = addDays(currentWeek, -7); (perWeek.get(week)?.sessions ?? 0) >= goal; week = addDays(week, -7)) {
    streakWeeks += 1;
  }

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
  };
}
