import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as s from "../server/db/schema";
import { billingStatus } from "../server/routes/billing";
import { sessionBody, testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
let owner: { cookie: string; id: string };
let coach: { cookie: string; id: string };
let student: { cookie: string; id: string };
let outsider: { cookie: string; id: string };
let academyId: string;

const lastMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  api = await testApi();
  owner = await api.user("dono_tools");
  coach = await api.user("coach_tools");
  student = await api.user("aluno_tools");
  outsider = await api.user("fora_tools");
  academyId = (await api.approvedAcademy(owner.cookie, { name: "Academia Ferramentas", instagram: "ferramentas" })).id;
  for (const u of [coach, student]) {
    await api.call("POST", `/academies/${academyId}/join`, { cookie: u.cookie });
    await api.call("PATCH", `/academies/${academyId}/members/${u.id}`, { cookie: owner.cookie, json: { status: "active" } });
  }
  await api.call("PATCH", `/academies/${academyId}/members/${coach.id}`, { cookie: owner.cookie, json: { role: "coach" } });
});
afterAll(() => api.close());

const notes = async (cookie: string) => (await api.call("GET", "/me/notifications", { cookie })).data as { type: string; targetId: string }[];

describe("billing status", () => {
  const plan = { id: "p", name: "Mensal", priceCents: 4500, periodMonths: 1 };
  it("is paid, due or late around the due day", () => {
    expect(billingStatus(null, [], "2026-10-15", 8).status).toBe("no_plan");
    expect(billingStatus({ ...plan, priceCents: 0 }, [], "2026-10-15", 8).status).toBe("exempt");
    expect(billingStatus(plan, [{ coversFrom: "2026-10", months: 1 }], "2026-10-15", 8)).toMatchObject({ status: "paid", paidThrough: "2026-10" });
    expect(billingStatus(plan, [{ coversFrom: "2026-09", months: 1 }], "2026-10-05", 8)).toMatchObject({ status: "due", lateMonths: 0 });
    expect(billingStatus(plan, [{ coversFrom: "2026-09", months: 1 }], "2026-10-09", 8)).toMatchObject({ status: "late", lateMonths: 1 });
    expect(billingStatus(plan, [{ coversFrom: "2026-07", months: 1 }], "2026-10-05", 8)).toMatchObject({ status: "late", lateMonths: 2 });
    // A quarterly payment covers three months, across the new year.
    expect(billingStatus(plan, [{ coversFrom: "2026-12", months: 3 }], "2027-02-20", 8)).toMatchObject({ status: "paid", paidThrough: "2027-02" });
    // Paid in advance.
    expect(billingStatus(plan, [{ coversFrom: "2026-11", months: 1 }], "2026-10-20", 8).status).toBe("paid");
  });
});

describe("billing", () => {
  it("is managed and seen by the owner only; members see their own status", async () => {
    const base = `/academies/${academyId}`;
    expect((await api.call("POST", `${base}/plans`, { cookie: coach.cookie, json: { name: "Mensal", priceCents: 4500, periodMonths: 1 } })).status).toBe(403);
    const plan = await api.call("POST", `${base}/plans`, { cookie: owner.cookie, json: { name: "Mensal", priceCents: 4500, periodMonths: 1 } });
    expect(plan.status).toBe(201);
    expect((await api.call("PATCH", `${base}/members/${student.id}/plan`, { cookie: owner.cookie, json: { planId: plan.data.id } })).status).toBe(204);

    for (const who of [coach, student, outsider]) expect((await api.call("GET", `${base}/billing`, { cookie: who.cookie })).status).toBe(403);
    const month = new Date().toISOString().slice(0, 7);
    const before = await api.call("GET", `${base}/billing`, { cookie: owner.cookie });
    const row = before.data.members.find((m: { id: string }) => m.id === student.id);
    expect(row.plan.name).toBe("Mensal");
    expect(["due", "late"]).toContain(row.status);

    // Reminder: once a day.
    expect((await api.call("POST", `${base}/members/${student.id}/remind`, { cookie: owner.cookie })).status).toBe(204);
    expect((await api.call("POST", `${base}/members/${student.id}/remind`, { cookie: owner.cookie })).status).toBe(409);
    expect((await notes(student.cookie))[0].type).toBe("payment_reminder");

    const pay = await api.call("POST", `${base}/payments`, {
      cookie: owner.cookie,
      json: { userId: student.id, amountCents: 4500, method: "mbway", paidOn: `${month}-03`, coversFrom: month, months: 1, note: "pago na receção" },
    });
    expect(pay.status).toBe(201);
    expect((await api.call("POST", `${base}/payments`, { cookie: owner.cookie, json: { userId: outsider.id, amountCents: 1, method: "cash", paidOn: `${month}-03`, coversFrom: month, months: 1 } })).status).toBe(400);
    const after = await api.call("GET", `${base}/billing`, { cookie: owner.cookie });
    expect(after.data.members.find((m: { id: string }) => m.id === student.id)).toMatchObject({ status: "paid", paidThrough: month });

    const mine = await api.call("GET", `${base}/billing/me`, { cookie: student.cookie });
    expect(mine.data).toMatchObject({ status: "paid", plan: { name: "Mensal" } });
    expect(mine.data.payments).toHaveLength(1);
    expect((await api.call("GET", `${base}/billing/me`, { cookie: outsider.cookie })).status).toBe(403);

    const csv = await api.call("GET", `${base}/payments.csv?month=${month}`, { cookie: owner.cookie });
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(csv.data).toContain("aluno_tools;Mensal;");
    expect(csv.data).toContain("45,00;MB Way;pago na receção");

    // Payments are in the member's own data export.
    expect((await api.call("GET", "/me/export", { cookie: student.cookie })).data.payments).toHaveLength(1);
    expect((await api.call("DELETE", `${base}/payments/${pay.data.id}`, { cookie: owner.cookie })).status).toBe(204);
  });
});

describe("calendar and competitions", () => {
  it("publishes events, takes sign-ups and results, and cancels a class date", async () => {
    const base = `/academies/${academyId}`;
    const next = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const comp = { kind: "competition", title: "Lisbon Open", startsAt: next, location: "Lisboa", url: "https://smoothcomp.com/en/event/1", signupUntil: next.slice(0, 10) };
    expect((await api.call("POST", `${base}/events`, { cookie: student.cookie, json: comp })).status).toBe(403);
    const e = await api.call("POST", `${base}/events`, { cookie: coach.cookie, json: comp });
    expect(e.status).toBe(201);
    expect((await notes(student.cookie)).some((n) => n.type === "event_published")).toBe(true);

    expect((await api.call("PUT", `${base}/events/${e.data.id}/rsvp`, { cookie: outsider.cookie, json: {} })).status).toBe(403);
    expect((await api.call("PUT", `${base}/events/${e.data.id}/rsvp`, { cookie: student.cookie, json: { category: "Adulto · Branca · -76 kg" } })).status).toBe(204);
    const detail = await api.call("GET", `${base}/events/${e.data.id}`, { cookie: owner.cookie });
    expect(detail.data).toMatchObject({ going: 1, attendees: [{ id: student.id, category: "Adulto · Branca · -76 kg", result: null }] });
    // Results only once the competition started.
    expect((await api.call("PUT", `${base}/events/${e.data.id}/results/${student.id}`, { cookie: student.cookie, json: { result: "gold" } })).status).toBe(409);

    // A past competition: the athlete records their own result; nobody else but staff can.
    const past = await api.call("POST", `${base}/events`, { cookie: owner.cookie, json: { ...comp, title: "Porto Open", startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), signupUntil: "" } });
    await api.db.insert(s.eventAttendees).values([{ eventId: past.data.id, userId: student.id }, { eventId: past.data.id, userId: coach.id }]);
    expect((await api.call("PUT", `${base}/events/${past.data.id}/results/${student.id}`, { cookie: student.cookie, json: { result: "gold" } })).status).toBe(204);
    expect((await api.call("PUT", `${base}/events/${past.data.id}/results/${coach.id}`, { cookie: student.cookie, json: { result: "gold" } })).status).toBe(403);
    expect((await api.call("PUT", `${base}/events/${past.data.id}/results/${coach.id}`, { cookie: owner.cookie, json: { result: "silver" } })).status).toBe(204);
    expect((await api.call("PUT", `${base}/events/${past.data.id}/rsvp`, { cookie: owner.cookie, json: {} })).status).toBe(409);
    const medals = await api.call("GET", `${base}/medals`, { cookie: outsider.cookie });
    expect(medals.data.total).toEqual({ gold: 1, silver: 1, bronze: 0 });
    expect(medals.data.athletes[0]).toMatchObject({ id: student.id, gold: 1 });

    // Cancelling a class date tells the members; the calendar returns it.
    const k = await api.call("POST", `${base}/classes`, { cookie: owner.cookie, json: { weekday: 1, startTime: "19:00", durationMin: 90, title: "Gi", kind: "gi" } });
    const monday = lastMonday();
    const occ = `${base}/classes/${k.data.id}/occurrences/${monday}`;
    expect((await api.call("PUT", occ, { cookie: student.cookie, json: { cancelled: true } })).status).toBe(403);
    expect((await api.call("PUT", occ, { cookie: owner.cookie, json: { cancelled: true, note: "Feriado" } })).status).toBe(200);
    expect((await notes(student.cookie))[0]).toMatchObject({ type: "class_cancelled", targetId: `${academyId}/${monday}` });
    const from = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const cal = await api.call("GET", `${base}/calendar?from=${from}&to=${to}`, { cookie: student.cookie });
    expect(cal.data.occurrences).toEqual([expect.objectContaining({ date: monday, cancelled: true, note: "Feriado" })]);
    expect(cal.data.events.map((x: { title: string }) => x.title)).toEqual(["Porto Open", "Lisbon Open"]);
  });
});

describe("check-in by the academy QR and lesson topic", () => {
  it("checks members into the class on now; the printed QR can be rotated", async () => {
    // Its own academy, so only this class is on the timetable.
    const boss = await api.user("dona_qr");
    const pupil = await api.user("aluno_qr");
    const a = await api.approvedAcademy(boss.cookie, { name: "Academia QR", instagram: "academiaqr" });
    await api.call("POST", `/academies/${a.id}/join`, { cookie: pupil.cookie });
    await api.call("PATCH", `/academies/${a.id}/members/${pupil.id}`, { cookie: boss.cookie, json: { status: "active" } });
    const base = `/academies/${a.id}`;

    // A class that started ten minutes ago (UTC).
    const now = new Date();
    const start = new Date(Math.max(now.getTime() - 10 * 60000, Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    const startTime = start.toISOString().slice(11, 16);
    const today = now.toISOString().slice(0, 10);
    const weekday = ((now.getUTCDay() + 6) % 7) + 1;
    const k = await api.call("POST", `${base}/classes`, { cookie: boss.cookie, json: { weekday, startTime, durationMin: 60, title: "Almoço", kind: "nogi" } });

    expect((await api.call("GET", `${base}/checkin-qr`, { cookie: pupil.cookie })).status).toBe(403);
    const qr = await api.call("GET", `${base}/checkin-qr`, { cookie: boss.cookie });
    expect(qr.data).toMatchObject({ academyId: a.id, name: "Academia QR" });
    const scan = (cookie: string, extra: Record<string, unknown> = {}) => api.call("POST", "/checkin", { cookie, json: { a: a.id, t: qr.data.token, tz: "UTC", ...extra } });

    expect((await scan(pupil.cookie, { t: "x".repeat(32) })).status).toBe(400);
    expect((await scan(outsider.cookie)).status).toBe(403);
    // Twelve hours away there is no class on.
    expect((await scan(pupil.cookie, { tz: "Etc/GMT+12" })).status).toBe(409);
    const ok = await scan(pupil.cookie);
    expect(ok.data).toMatchObject({ class: { id: k.data.id, title: "Almoço" }, academy: { id: a.id }, date: today });
    expect((await scan(pupil.cookie)).status).toBe(200); // scanning twice is harmless

    const sheetPath = `${base}/classes/${k.data.id}/attendance`;
    const sheet = await api.call("GET", `${sheetPath}?date=${today}&tz=UTC`, { cookie: boss.cookie });
    expect(sheet.data.members.find((m: { id: string }) => m.id === pupil.id)).toMatchObject({ checkedIn: true, present: false });
    expect((await api.call("GET", `${base}/attendance/pending?tz=UTC`, { cookie: boss.cookie })).data.some((p: { class: { id: string } }) => p.class.id === k.data.id)).toBe(true);

    // The roll call stores the topic; the student's session log gets it.
    await api.call("PUT", sheetPath, { cookie: boss.cookie, json: { date: today, userIds: [pupil.id], topic: "Raspagem de gancho" } });
    expect((await api.call("GET", `/classes/${k.data.id}?date=${today}`, { cookie: pupil.cookie })).data).toMatchObject({ topic: "Raspagem de gancho", title: "Almoço" });

    // A cancelled class takes no check-ins.
    await api.call("PUT", `${base}/classes/${k.data.id}/occurrences/${today}`, { cookie: boss.cookie, json: { cancelled: true } });
    expect((await scan(pupil.cookie)).status).toBe(409);

    // Rotating the QR invalidates the printed one; only the owner can.
    expect((await api.call("POST", `${base}/checkin-qr/rotate`, { cookie: pupil.cookie })).status).toBe(403);
    const fresh = await api.call("POST", `${base}/checkin-qr/rotate`, { cookie: boss.cookie });
    expect(fresh.data.token).not.toBe(qr.data.token);
    expect((await scan(pupil.cookie)).status).toBe(400);
  });
});

describe("notice board and missing students", () => {
  it("is for members; staff post and see who stopped coming", async () => {
    const base = `/academies/${academyId}`;
    expect((await api.call("POST", `${base}/announcements`, { cookie: student.cookie, json: { body: "Oi" } })).status).toBe(403);
    const post = await api.call("POST", `${base}/announcements`, { cookie: coach.cookie, json: { body: "Sem aula na sexta", pinned: true } });
    expect(post.status).toBe(201);
    expect((await notes(student.cookie))[0].type).toBe("announcement");
    expect((await api.call("GET", `${base}/announcements`, { cookie: student.cookie })).data[0]).toMatchObject({ body: "Sem aula na sexta", pinned: true });
    expect((await api.call("GET", `${base}/announcements`, { cookie: outsider.cookie })).status).toBe(403);

    // A student who joined a month ago and only trained 20 days ago is missing at 14 days.
    const late = await api.user("sumido_tools");
    await api.call("POST", `${base}/join`, { cookie: late.cookie });
    await api.call("PATCH", `${base}/members/${late.id}`, { cookie: owner.cookie, json: { status: "active" } });
    await api.db.update(s.academyMembers).set({ createdAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(s.academyMembers.userId, late.id));
    await api.call("POST", "/sessions", { cookie: late.cookie, json: sessionBody({ academyId, startedAt: new Date(Date.now() - 20 * 86_400_000).toISOString() }) });

    expect((await api.call("GET", `${base}/inactive`, { cookie: student.cookie })).status).toBe(403);
    const inactive = await api.call("GET", `${base}/inactive?days=14`, { cookie: coach.cookie });
    expect(inactive.data.members.map((m: { id: string }) => m.id)).toEqual([late.id]);
    expect(inactive.data.members[0].lastSeen).toBe(new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10));
  });
});
