import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { monthlyTrend, weekReport, type StatRow } from "../server/stats";
import { sessionBody, testApi } from "./helpers";

const row = (iso: string, extra: Partial<StatRow> = {}): StatRow => ({ startedAt: new Date(iso), durationMin: 60, rpe: 5, rounds: 4, kind: "gi", ...extra });
const now = new Date("2026-10-14T12:00:00Z"); // Wednesday; the week starts on 12/10

describe("weekly report", () => {
  const rows = [
    row("2026-09-29T19:00:00Z"), row("2026-10-01T19:00:00Z"), // week of 28/09: 2
    row("2026-10-06T19:00:00Z", { submissions: [{ name: "Kimura", count: 1 }] }), row("2026-10-08T19:00:00Z"), // week of 05/10: 2
    row("2026-10-12T19:00:00Z", { kind: "nogi", techniques: ["Kimura", "Single leg"], taps: [{ name: "Triângulo", count: 2 }] }),
    row("2026-10-13T19:00:00Z", { techniques: ["kimura"], durationMin: 90 }),
  ];

  it("summarizes a week against the one before, with the streak at that week", () => {
    const r = weekReport(rows, { tz: "Europe/Lisbon", now, week: "2026-10-12", weeklyGoal: 2 });
    expect(r.current).toMatchObject({ sessions: 2, minutes: 150, rounds: 8, days: ["2026-10-12", "2026-10-13"] });
    expect(r.current.topTechniques[0]).toEqual({ name: "Kimura", count: 2 });
    expect(r.current.taps).toEqual({ total: 2, top: [{ name: "Triângulo", count: 2 }] });
    expect(r.previous).toMatchObject({ sessions: 2, minutes: 120, submissions: { total: 1 } });
    expect(r).toMatchObject({ goalMet: true, streakWeeks: 3, inProgress: true, firstWeek: "2026-09-28" });
  });

  it("reports a past week as finished, counting the streak up to it", () => {
    const r = weekReport(rows, { tz: "Europe/Lisbon", now, week: "2026-09-28", weeklyGoal: 2 });
    expect(r).toMatchObject({ goalMet: true, streakWeeks: 1, inProgress: false });
    expect(r.previous.sessions).toBe(0);
  });

  it("lists the last months oldest first, in the user's time zone", () => {
    // 23:30 UTC on 30/09 is already October in Tokyo.
    const months = monthlyTrend([row("2026-09-30T23:30:00Z", { submissions: [{ name: "A", count: 2 }] })], { tz: "Asia/Tokyo", now, months: 3 });
    expect(months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(months[2]).toEqual({ month: "2026-10", sessions: 1, minutes: 60, submissions: 2, taps: 0 });
  });
});

describe("week and trend routes", () => {
  let api: Awaited<ReturnType<typeof testApi>>;
  beforeAll(async () => {
    api = await testApi();
  });
  afterAll(() => api.close());

  it("answer for the signed-in user only and validate the week", async () => {
    const u = await api.user("semana");
    await api.call("POST", "/sessions", { cookie: u.cookie, json: sessionBody({ submissions: [{ name: "Armlock", count: 1 }] }) });
    const week = await api.call("GET", "/me/week?tz=Europe/Lisbon", { cookie: u.cookie });
    expect(week.status).toBe(200);
    expect(week.data.current.sessions).toBe(1);
    expect((await api.call("GET", "/me/week?week=2026-13-45", { cookie: u.cookie })).status).toBe(400);
    // A future week is clamped to the current one.
    expect((await api.call("GET", "/me/week?week=2999-01-01&tz=Europe/Lisbon", { cookie: u.cookie })).data.week).toBe(week.data.week);

    const trends = await api.call("GET", "/me/trends?tz=Europe/Lisbon", { cookie: u.cookie });
    expect(trends.data.months).toHaveLength(12);
    expect(trends.data.months.at(-1).submissions).toBe(1);
    expect((await api.call("GET", "/me/trends")).status).toBe(401);
  });
});
