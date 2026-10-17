// Achievements and weekly challenges, computed from a user's sessions (nothing stored: deleting a
// session updates them). Same time-zone rules as stats.ts: weeks start on Monday, local dates.
import { localDate, type StatRow, weekOf } from "./stats";

export type Achievement = {
  id: string;
  group: "sessions" | "hours" | "streak" | "submissions" | "variety" | "techniques";
  target: number;
  progress: number;
  /** When it was reached (the session or technique that crossed the mark), or null. */
  achievedAt: string | null;
};

type Mark = { id: string; group: Achievement["group"]; target: number };

const marks = (group: Achievement["group"], prefix: string, targets: number[]): Mark[] => targets.map((target) => ({ id: `${prefix}_${target}`, group, target }));

/** Every achievement, in display order. Ids are stable: the app translates them. */
export const ACHIEVEMENTS: Mark[] = [
  ...marks("sessions", "sessions", [1, 10, 50, 100, 250, 500]),
  ...marks("hours", "hours", [10, 50, 100, 500]),
  ...marks("streak", "streak", [4, 12, 26, 52]),
  ...marks("submissions", "submissions", [1, 10, 50, 100]),
  { id: "submissions_distinct_5", group: "submissions", target: 5 },
  { id: "gi_nogi_week", group: "variety", target: 1 },
  { id: "open_mat", group: "variety", target: 1 },
  { id: "competition", group: "variety", target: 1 },
  ...marks("techniques", "known", [10, 25, 50]),
];

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Running total over sessions in order; `at` is the session where it first reached each target. */
function crossings(rows: StatRow[], amount: (r: StatRow) => number) {
  let total = 0;
  const at: { total: number; when: string }[] = [];
  for (const r of rows) {
    const add = amount(r);
    if (!add) continue;
    total += add;
    at.push({ total, when: r.startedAt.toISOString() });
  }
  return { total, reachedAt: (target: number) => at.find((x) => x.total >= target)?.when ?? null };
}

/**
 * `knownDates`: when each known technique was marked. The streak uses the current weekly goal for
 * every past week (the goal history is not kept); with no goal there is no streak to earn.
 */
export function achievements(rows: StatRow[], opts: { tz: string; weeklyGoal: number; knownDates: Date[] }): Achievement[] {
  const sorted = [...rows].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const sessions = crossings(sorted, () => 1);
  const minutes = crossings(sorted, (r) => r.durationMin);
  const subs = crossings(sorted, (r) => (r.submissions ?? []).reduce((a, f) => a + f.count, 0));

  // Distinct submissions, in the order they were first logged.
  const distinct: string[] = [];
  const distinctAt: string[] = [];
  for (const r of sorted) {
    for (const f of r.submissions ?? []) {
      const key = f.name.trim().toLowerCase();
      if (!distinct.includes(key)) {
        distinct.push(key);
        distinctAt.push(r.startedAt.toISOString());
      }
    }
  }

  // Weeks in order, for the goal streak and the gi + no-gi week.
  const weeks = new Map<string, { count: number; goalAt: string | null; kinds: Set<string>; bothAt: string | null }>();
  for (const r of sorted) {
    const w = weekOf(localDate(r.startedAt, opts.tz));
    const entry = weeks.get(w) ?? { count: 0, goalAt: null, kinds: new Set<string>(), bothAt: null };
    entry.count += 1;
    if (opts.weeklyGoal > 0 && entry.count === opts.weeklyGoal) entry.goalAt = r.startedAt.toISOString();
    entry.kinds.add(r.kind);
    if (!entry.bothAt && entry.kinds.has("gi") && entry.kinds.has("nogi")) entry.bothAt = r.startedAt.toISOString();
    weeks.set(w, entry);
  }
  let run = 0;
  let best = 0;
  let previous: string | null = null;
  const streakAt = new Map<number, string>();
  for (const w of [...weeks.keys()].sort()) {
    const entry = weeks.get(w)!;
    if (!entry.goalAt) continue;
    run = previous && addDays(previous, 7) === w ? run + 1 : 1;
    previous = w;
    best = Math.max(best, run);
    if (!streakAt.has(run)) streakAt.set(run, entry.goalAt);
  }
  const bothAt = [...weeks.keys()].sort().map((w) => weeks.get(w)!.bothAt).find(Boolean) ?? null;
  const firstOf = (kind: string) => sorted.find((r) => r.kind === kind)?.startedAt.toISOString() ?? null;
  const known = [...opts.knownDates].sort((a, b) => a.getTime() - b.getTime());

  return ACHIEVEMENTS.map((m): Achievement => {
    const [progress, achievedAt] = ((): [number, string | null] => {
      switch (m.group) {
        case "sessions":
          return [sessions.total, sessions.reachedAt(m.target)];
        case "hours":
          return [Math.floor(minutes.total / 60), minutes.reachedAt(m.target * 60)];
        case "streak":
          return [best, streakAt.get(m.target) ?? null];
        case "submissions":
          return m.id === "submissions_distinct_5"
            ? [distinct.length, distinctAt[m.target - 1] ?? null]
            : [subs.total, subs.reachedAt(m.target)];
        case "techniques":
          return [known.length, known[m.target - 1]?.toISOString() ?? null];
        case "variety": {
          const at = m.id === "gi_nogi_week" ? bothAt : firstOf(m.id);
          return [at ? 1 : 0, at];
        }
      }
    })();
    return { ...m, progress: Math.min(progress, m.target), achievedAt };
  });
}

// ---------- Weekly challenges ----------

export type Challenge = {
  id: "sessions" | "minutes" | "newKind" | "submission" | "newTechnique";
  target: number;
  progress: number;
  done: boolean;
  /** For `newKind`: the kind to try. */
  kind?: string;
};

/** Kinds a "try something different" challenge suggests (private lessons and teaching depend on others). */
const TRY_KINDS = ["gi", "nogi", "open_mat", "drill"];

/**
 * Three challenges for the week starting on `week`, derived from the four weeks before it (so they
 * stay put during the week): one more session than the recent average, 10% more time, and a third
 * that rotates week by week between trying a kind not trained in a month, logging a submission and
 * training a technique never logged before.
 */
export function weeklyChallenges(rows: StatRow[], opts: { tz: string; week: string }): Challenge[] {
  const day = (r: StatRow) => localDate(r.startedAt, opts.tz);
  const before = rows.filter((r) => day(r) < opts.week);
  const recent = before.filter((r) => day(r) >= addDays(opts.week, -28));
  const inWeek = rows.filter((r) => weekOf(day(r)) === opts.week);

  const avgSessions = recent.length / 4;
  const avgMinutes = recent.reduce((a, r) => a + r.durationMin, 0) / 4;
  const sessionsTarget = Math.min(7, Math.max(1, Math.round(avgSessions) + 1));
  const minutesTarget = Math.max(60, Math.ceil((avgMinutes * 1.1) / 15) * 15);

  const recentKinds = new Set(recent.map((r) => r.kind));
  const newKind = TRY_KINDS.find((k) => !recentKinds.has(k));
  const seen = new Set(before.flatMap((r) => r.techniques ?? []).map((t) => t.trim().toLowerCase()));
  const rotation: Challenge["id"][] = newKind ? ["newKind", "submission", "newTechnique"] : ["submission", "newTechnique"];
  const weekIndex = Math.round(new Date(`${opts.week}T00:00:00Z`).getTime() / (7 * 86_400_000));
  const third = rotation[weekIndex % rotation.length];

  const minutes = inWeek.reduce((a, r) => a + r.durationMin, 0);
  const progressOf: Record<Challenge["id"], number> = {
    sessions: inWeek.length,
    minutes,
    newKind: inWeek.some((r) => r.kind === newKind) ? 1 : 0,
    submission: inWeek.reduce((a, r) => a + (r.submissions ?? []).reduce((b, f) => b + f.count, 0), 0),
    newTechnique: new Set(inWeek.flatMap((r) => r.techniques ?? []).map((t) => t.trim().toLowerCase()).filter((t) => !seen.has(t))).size,
  };
  const make = (id: Challenge["id"], target: number, extra: Partial<Challenge> = {}): Challenge => ({
    id,
    target,
    progress: Math.min(progressOf[id], target),
    done: progressOf[id] >= target,
    ...extra,
  });
  return [
    make("sessions", sessionsTarget),
    make("minutes", minutesTarget),
    third === "newKind" ? make("newKind", 1, { kind: newKind }) : make(third, 1),
  ];
}

/**
 * Consecutive weeks with every challenge done, counting back from the week before `week`; `week`
 * itself extends it once done but does not break it (it may still be in progress).
 */
export function challengeStreak(rows: StatRow[], opts: { tz: string; week: string; firstWeek: string | null }) {
  const allDone = (w: string) => weeklyChallenges(rows, { tz: opts.tz, week: w }).every((c) => c.done);
  let streak = allDone(opts.week) ? 1 : 0;
  for (let w = addDays(opts.week, -7); opts.firstWeek && w >= opts.firstWeek && streak < 104; w = addDays(w, -7)) {
    if (!allDone(w)) break;
    streak += 1;
  }
  return streak;
}
