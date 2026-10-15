import { describe, expect, it } from "vitest";

import { computeStats, localDate, weekOf, type StatRow } from "../server/stats";

const row = (iso: string, durationMin = 60, rpe = 5): StatRow => ({ startedAt: new Date(iso), durationMin, rpe, rounds: 4, kind: "gi" });

describe("stats", () => {
  it("uses the user's time zone for days", () => {
    // 23:30 UTC on Sunday is already Monday in Tokyo.
    expect(localDate(new Date("2026-10-11T23:30:00Z"), "UTC")).toBe("2026-10-11");
    expect(localDate(new Date("2026-10-11T23:30:00Z"), "Asia/Tokyo")).toBe("2026-10-12");
  });

  it("starts weeks on Monday", () => {
    expect(weekOf("2026-10-15")).toBe("2026-10-12");
    expect(weekOf("2026-10-12")).toBe("2026-10-12");
    expect(weekOf("2026-10-18")).toBe("2026-10-12");
  });

  it("counts a streak of weeks meeting the goal without breaking on the current week", () => {
    const now = new Date("2026-10-14T12:00:00Z"); // Wednesday
    const rows = [
      row("2026-09-29T19:00:00Z"), row("2026-10-01T19:00:00Z"), // week of 28/09: 2
      row("2026-10-06T19:00:00Z"), row("2026-10-08T19:00:00Z"), // week of 05/10: 2
    ];
    const s = computeStats(rows, { tz: "Europe/Lisbon", now, weeklyGoal: 2 });
    expect(s.streakWeeks).toBe(2);
    expect(s.thisWeek.sessions).toBe(0);

    const withThisWeek = computeStats([...rows, row("2026-10-12T19:00:00Z"), row("2026-10-13T19:00:00Z")], { tz: "Europe/Lisbon", now, weeklyGoal: 2 });
    expect(withThisWeek.streakWeeks).toBe(3);
    expect(withThisWeek.thisWeek.days).toEqual(["2026-10-12", "2026-10-13"]);
  });

  it("classifies the weekly load against the previous four weeks", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const base = ["2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06"].map((d) => row(`${d}T19:00:00Z`, 60, 5)); // 300 each
    expect(computeStats([...base, row("2026-10-13T19:00:00Z", 60, 5)], { tz: "UTC", now, weeklyGoal: 1 }).loadBand).toBe("ideal");
    expect(computeStats([...base, row("2026-10-13T19:00:00Z", 120, 8)], { tz: "UTC", now, weeklyGoal: 1 }).loadBand).toBe("high");
    expect(computeStats([...base, row("2026-10-13T19:00:00Z", 20, 5)], { tz: "UTC", now, weeklyGoal: 1 }).loadBand).toBe("low");
    expect(computeStats([], { tz: "UTC", now, weeklyGoal: 1 }).loadBand).toBe("none");
  });
});
