import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { achievements, challengeStreak, weeklyChallenges } from "../server/achievements";
import type { StatRow } from "../server/stats";
import { sessionBody, testApi } from "./helpers";

const row = (iso: string, extra: Partial<StatRow> = {}): StatRow => ({ startedAt: new Date(iso), durationMin: 60, rpe: 5, rounds: 4, kind: "gi", ...extra });
const tz = "Europe/Lisbon";
const byId = (list: ReturnType<typeof achievements>) => Object.fromEntries(list.map((a) => [a.id, a]));

describe("achievements", () => {
  it("are reached at the session that crosses the mark", () => {
    const rows = [
      row("2026-10-05T19:00:00Z", { submissions: [{ name: "Kimura", count: 1 }] }),
      row("2026-10-06T19:00:00Z", { kind: "nogi", durationMin: 600 }), // 11h in total here
      row("2026-10-12T19:00:00Z", { kind: "open_mat" }),
    ];
    const a = byId(achievements(rows, { tz, weeklyGoal: 1, knownDates: [] }));
    expect(a.sessions_1.achievedAt).toBe("2026-10-05T19:00:00.000Z");
    expect(a.sessions_10).toMatchObject({ progress: 3, achievedAt: null });
    expect(a.hours_10.achievedAt).toBe("2026-10-06T19:00:00.000Z");
    expect(a.submissions_1.achievedAt).toBe("2026-10-05T19:00:00.000Z");
    expect(a.gi_nogi_week.achievedAt).toBe("2026-10-06T19:00:00.000Z");
    expect(a.open_mat.achievedAt).toBe("2026-10-12T19:00:00.000Z");
    expect(a.competition.achievedAt).toBeNull();
    // Two weeks in a row on a goal of 1.
    expect(a.streak_4).toMatchObject({ progress: 2, achievedAt: null });
  });

  it("count the longest streak of consecutive weeks, and known techniques by date", () => {
    const weeks = Array.from({ length: 4 }, (_, i) => row(new Date(Date.UTC(2026, 8, 7 + 7 * i, 19)).toISOString()));
    const gap = row("2026-10-19T19:00:00Z"); // after a week off
    const known = Array.from({ length: 10 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)));
    const a = byId(achievements([...weeks, gap], { tz, weeklyGoal: 1, knownDates: known }));
    expect(a.streak_4).toMatchObject({ progress: 4, achievedAt: weeks[3].startedAt.toISOString() });
    expect(a.known_10.achievedAt).toBe(known[9].toISOString());
    // No goal, no streak.
    expect(byId(achievements(weeks, { tz, weeklyGoal: 0, knownDates: [] })).streak_4.progress).toBe(0);
  });
});

describe("weekly challenges", () => {
  // Four weeks of two 60-minute gi sessions before the week of 12/10.
  const history = Array.from({ length: 4 }, (_, i) => [
    row(new Date(Date.UTC(2026, 8, 14 + 7 * i, 19)).toISOString(), { techniques: ["Armlock"] }),
    row(new Date(Date.UTC(2026, 8, 16 + 7 * i, 19)).toISOString()),
  ]).flat();

  it("ask a bit more than the recent average and track this week's progress", () => {
    const week = [row("2026-10-12T19:00:00Z", { kind: "nogi", techniques: ["Armlock", "Heel hook"], submissions: [{ name: "Heel hook", count: 1 }] })];
    const [sessions, minutes, third] = weeklyChallenges([...history, ...week], { tz, week: "2026-10-12" });
    expect(sessions).toMatchObject({ id: "sessions", target: 3, progress: 1, done: false });
    expect(minutes).toMatchObject({ id: "minutes", target: 135, progress: 60 });
    // The third rotates; whichever it is, this week's session satisfies it.
    expect(third.done).toBe(true);
    if (third.id === "newKind") expect(third.kind).toBe("nogi");
  });

  it("start a new user with one session and an hour", () => {
    const [sessions, minutes] = weeklyChallenges([], { tz, week: "2026-10-12" });
    expect([sessions.target, minutes.target]).toEqual([1, 60]);
  });

  it("count a streak of weeks with every challenge done", () => {
    expect(challengeStreak(history, { tz, week: "2026-10-12", firstWeek: "2026-09-14" })).toBe(0);
  });
});

describe("achievement and challenge routes", () => {
  let api: Awaited<ReturnType<typeof testApi>>;
  beforeAll(async () => {
    api = await testApi();
  });
  afterAll(() => api.close());

  it("answer from the signed-in user's sessions", async () => {
    const u = await api.user("conquista");
    await api.call("POST", "/sessions", { cookie: u.cookie, json: sessionBody({ submissions: [{ name: "Armlock", count: 1 }] }) });
    const list = await api.call("GET", "/me/achievements?tz=Europe/Lisbon", { cookie: u.cookie });
    expect(list.data.find((a: { id: string }) => a.id === "sessions_1").achievedAt).not.toBeNull();
    const ch = await api.call("GET", "/me/challenges?tz=Europe/Lisbon", { cookie: u.cookie });
    expect(ch.data.challenges).toHaveLength(3);
    expect(ch.data.challenges[0]).toMatchObject({ id: "sessions", target: 1, done: true });
    expect((await api.call("GET", "/me/achievements")).status).toBe(401);
  });

  it("flag new achievements once, counting the ones reached before the first check as seen", async () => {
    const u = await api.user("parabens");
    await api.call("POST", "/sessions", { cookie: u.cookie, json: sessionBody() });
    const get = async () => (await api.call("GET", "/me/achievements?tz=Europe/Lisbon", { cookie: u.cookie })).data as { id: string; isNew: boolean }[];
    // First look: the first session was already there, so it is not new.
    expect((await get()).filter((a) => a.isNew)).toEqual([]);

    await api.call("POST", "/sessions", { cookie: u.cookie, json: sessionBody({ submissions: [{ name: "Armlock", count: 1 }] }) });
    expect((await get()).filter((a) => a.isNew).map((a) => a.id)).toEqual(["submissions_1"]);

    expect((await api.call("POST", "/me/achievements/seen", { cookie: u.cookie, json: { ids: ["submissions_1", "bogus"] } })).status).toBe(204);
    expect((await get()).filter((a) => a.isNew)).toEqual([]);
  });
});
