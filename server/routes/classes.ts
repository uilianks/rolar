import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { Hono } from "hono";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { attendanceInput, classInput, occurrenceInput } from "../../src/shared/domain";
import * as s from "../db/schema";
import { type AppEnv, body, fail, viewer } from "../http";
import { notify } from "../notify";
import { isValidTimeZone } from "../stats";
import { activeMemberIds, findAcademy, requireMember, requireStaff } from "./academies";

/** Timetable (public, like the address) and roll call (staff only). */
export const classesRoutes = new Hono<AppEnv>();

const classColumns = {
  id: s.academyClasses.id,
  academyId: s.academyClasses.academyId,
  weekday: s.academyClasses.weekday,
  startTime: s.academyClasses.startTime,
  durationMin: s.academyClasses.durationMin,
  title: s.academyClasses.title,
  kind: s.academyClasses.kind,
};

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
export function isoWeekday(date: string) {
  return ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

const DAY = 86_400_000;

/** A session counts as "this class" when it starts on that date within this many minutes of the class start. */
const MATCH_WINDOW_MIN = 120;

function timeZone(c: Parameters<typeof viewer>[0]) {
  const tz = c.req.query("tz") ?? "UTC";
  if (!isValidTimeZone(tz)) fail(400, "invalidTimeZone");
  return tz;
}

/** Local date (YYYY-MM-DD) and minutes since midnight of an instant in `tz`. */
function localParts(at: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Sessions members logged at the academy between two dates, as local date + start minute: what students
 * say they trained, which staff can confirm in the roll call.
 */
async function loggedSessions(c: Parameters<typeof viewer>[0], academyId: string, from: string, to: string, tz: string) {
  const rows = await c
    .get("db")
    .select({ userId: s.sessions.userId, startedAt: s.sessions.startedAt })
    .from(s.sessions)
    .where(
      and(
        eq(s.sessions.academyId, academyId),
        gte(s.sessions.startedAt, new Date(new Date(`${from}T00:00:00Z`).getTime() - DAY)),
        lte(s.sessions.startedAt, new Date(new Date(`${to}T00:00:00Z`).getTime() + 2 * DAY)),
      ),
    );
  return rows.map((r) => ({ userId: r.userId, ...localParts(r.startedAt, tz) }));
}

function matches(k: { startTime: string }, date: string, x: { date: string; minutes: number }) {
  return x.date === date && Math.abs(x.minutes - minutesOf(k.startTime)) <= MATCH_WINDOW_MIN;
}

async function staffAcademy(c: Parameters<typeof viewer>[0], academyId: string) {
  return (await requireStaff(c, academyId)).a;
}

/** A live class of this academy. */
async function findClass(c: Parameters<typeof viewer>[0], academyId: string, classId: string) {
  const [k] = await c
    .get("db")
    .select(classColumns)
    .from(s.academyClasses)
    .where(and(eq(s.academyClasses.id, classId), eq(s.academyClasses.academyId, academyId), isNull(s.academyClasses.archivedAt)));
  if (!k) fail(404, "classNotFound");
  return k;
}

classesRoutes.get("/academies/:id/classes", async (c) => {
  const a = await findAcademy(c, c.req.param("id"));
  const rows = await c
    .get("db")
    .select(classColumns)
    .from(s.academyClasses)
    .where(and(eq(s.academyClasses.academyId, a.id), isNull(s.academyClasses.archivedAt)))
    .orderBy(asc(s.academyClasses.weekday), asc(s.academyClasses.startTime));
  return c.json(rows);
});

/** Members hear about timetable changes; one unread notice per academy covers a burst of edits. */
async function scheduleChanged(c: Parameters<typeof viewer>[0], academyId: string) {
  const db = c.get("db");
  await notify(db, "schedule_changed", viewer(c), await activeMemberIds(db, academyId), academyId, { collapse: true });
}

classesRoutes.post("/academies/:id/classes", async (c) => {
  const a = await staffAcademy(c, c.req.param("id"));
  const input = await body(c, classInput);
  const [k] = await c.get("db").insert(s.academyClasses).values({ ...input, academyId: a.id }).returning(classColumns);
  await scheduleChanged(c, a.id);
  return c.json(k, 201);
});

classesRoutes.put("/academies/:id/classes/:classId", async (c) => {
  const a = await staffAcademy(c, c.req.param("id"));
  const k = await findClass(c, a.id, c.req.param("classId"));
  const input = await body(c, classInput);
  const [updated] = await c.get("db").update(s.academyClasses).set(input).where(eq(s.academyClasses.id, k.id)).returning(classColumns);
  if ((Object.keys(input) as (keyof typeof input)[]).some((key) => input[key] !== k[key])) await scheduleChanged(c, a.id);
  return c.json(updated);
});

/** Archived, not deleted: past roll calls stay attached to the class. */
classesRoutes.delete("/academies/:id/classes/:classId", async (c) => {
  const a = await staffAcademy(c, c.req.param("id"));
  const k = await findClass(c, a.id, c.req.param("classId"));
  await c.get("db").update(s.academyClasses).set({ archivedAt: new Date() }).where(eq(s.academyClasses.id, k.id));
  await scheduleChanged(c, a.id);
  return c.body(null, 204);
});

async function occurrence(c: Parameters<typeof viewer>[0], classId: string, date: string) {
  const [o] = await c
    .get("db")
    .select({ cancelled: s.classOccurrences.cancelled, note: s.classOccurrences.note, topic: s.classOccurrences.topic })
    .from(s.classOccurrences)
    .where(and(eq(s.classOccurrences.classId, classId), eq(s.classOccurrences.date, date)));
  return o ?? { cancelled: false, note: null, topic: null };
}

/**
 * One class (with that date's topic when `date` is given), for a member opening "register this session"
 * from an attendance notification or a check-in.
 */
classesRoutes.get("/classes/:classId", async (c) => {
  const [k] = await c.get("db").select(classColumns).from(s.academyClasses).where(eq(s.academyClasses.id, c.req.param("classId")));
  if (!k) fail(404, "classNotFound");
  await findAcademy(c, k.academyId);
  const date = c.req.query("date");
  if (!date) return c.json(k);
  return c.json({ ...k, ...(await occurrence(c, k.id, attendanceInput.shape.date.parse(date))) });
});

/** Staff cancel one date of a class (holiday) or leave a note; members are told when a date is cancelled or restored. */
classesRoutes.put("/academies/:id/classes/:classId/occurrences/:date", async (c) => {
  const staffId = viewer(c);
  const a = await staffAcademy(c, c.req.param("id"));
  const k = await findClass(c, a.id, c.req.param("classId"));
  const date = attendanceInput.shape.date.parse(c.req.param("date"));
  if (isoWeekday(date) !== k.weekday) fail(400, "notClassDay");
  const input = await body(c, occurrenceInput);
  const before = await occurrence(c, k.id, date);
  const db = c.get("db");
  await db
    .insert(s.classOccurrences)
    .values({ classId: k.id, date, ...input, updatedBy: staffId })
    .onConflictDoUpdate({
      target: [s.classOccurrences.classId, s.classOccurrences.date],
      set: { cancelled: input.cancelled, note: input.note ?? null, updatedBy: staffId, updatedAt: new Date() },
    });
  if (input.cancelled !== before.cancelled) {
    await notify(db, input.cancelled ? "class_cancelled" : "class_restored", staffId, await activeMemberIds(db, a.id), `${a.id}/${date}`);
  }
  return c.json({ ...input, note: input.note ?? null });
});

/**
 * Roll call sheet: every active member, who is marked present for that date, and who logged a session
 * matching the class (so staff can confirm students who checked in themselves).
 */
classesRoutes.get("/academies/:id/classes/:classId/attendance", async (c) => {
  const a = await staffAcademy(c, c.req.param("id"));
  const k = await findClass(c, a.id, c.req.param("classId"));
  const date = attendanceInput.shape.date.parse(c.req.query("date"));
  const tz = timeZone(c);
  const logged = new Set((await loggedSessions(c, a.id, date, date, tz)).filter((x) => matches(k, date, x)).map((x) => x.userId));
  const checkedIn = new Set(
    (await c.get("db").select({ userId: s.checkins.userId }).from(s.checkins).where(and(eq(s.checkins.classId, k.id), eq(s.checkins.date, date)))).map((r) => r.userId),
  );
  const rows = await c
    .get("db")
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      belt: s.profiles.belt,
      stripes: s.profiles.stripes,
      role: s.academyMembers.role,
      present: sql<boolean>`exists (select 1 from attendance x where x.class_id = ${k.id} and x.date = ${date} and x.user_id = ${s.profiles.userId})`,
    })
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.status, "active")))
    .orderBy(asc(s.profiles.name));
  return c.json({
    class: k,
    date,
    ...(await occurrence(c, k.id, date)),
    members: rows.map((r) => ({ ...r, logged: logged.has(r.id), checkedIn: checkedIn.has(r.id) })),
  });
});

/**
 * Classes of the last 7 days without a roll call where members logged a session or checked in: the
 * professor forgot, the students did not. Listed on the academy page so staff can confirm them.
 */
classesRoutes.get("/academies/:id/attendance/pending", async (c) => {
  const a = await staffAcademy(c, c.req.param("id"));
  const tz = timeZone(c);
  const db = c.get("db");
  const today = localParts(new Date(), tz).date;
  const from = new Date(new Date(`${today}T12:00:00Z`).getTime() - 7 * DAY).toISOString().slice(0, 10);
  const classes = await db.select(classColumns).from(s.academyClasses).where(and(eq(s.academyClasses.academyId, a.id), isNull(s.academyClasses.archivedAt)));
  const taken = await db
    .selectDistinct({ classId: s.attendance.classId, date: s.attendance.date })
    .from(s.attendance)
    .innerJoin(s.academyClasses, eq(s.academyClasses.id, s.attendance.classId))
    .where(and(eq(s.academyClasses.academyId, a.id), gte(s.attendance.date, from)));
  const done = new Set(taken.map((t) => `${t.classId}/${t.date}`));
  const logged = await loggedSessions(c, a.id, from, today, tz);
  const checks = await db
    .select({ classId: s.checkins.classId, date: s.checkins.date, userId: s.checkins.userId })
    .from(s.checkins)
    .innerJoin(s.academyClasses, eq(s.academyClasses.id, s.checkins.classId))
    .where(and(eq(s.academyClasses.academyId, a.id), gte(s.checkins.date, from)));

  const pending = [];
  for (let t = new Date(`${today}T12:00:00Z`).getTime(); ; t -= DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date < from) break;
    for (const k of classes.filter((x) => x.weekday === isoWeekday(date) && !done.has(`${x.id}/${date}`))) {
      const users = new Set([
        ...logged.filter((x) => matches(k, date, x)).map((x) => x.userId),
        ...checks.filter((x) => x.classId === k.id && x.date === date).map((x) => x.userId),
      ]);
      if (users.size) pending.push({ class: k, date, logged: users.size });
    }
  }
  return c.json(pending);
});

classesRoutes.put("/academies/:id/classes/:classId/attendance", async (c) => {
  const staffId = viewer(c);
  const db = c.get("db");
  const a = await staffAcademy(c, c.req.param("id"));
  const k = await findClass(c, a.id, c.req.param("classId"));
  const { date, userIds, topic } = await body(c, attendanceInput);
  if (isoWeekday(date) !== k.weekday) fail(400, "notClassDay");
  const today = new Date();
  const max = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10); // timezones ahead of UTC
  const min = new Date(today.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
  if (date > max) fail(400, "futureRollCall");
  if (date < min) fail(400, "rollCallTooOld");

  const ids = [...new Set(userIds)];
  if (ids.length) {
    const members = await db
      .select({ id: s.academyMembers.userId })
      .from(s.academyMembers)
      .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.status, "active"), inArray(s.academyMembers.userId, ids)));
    if (members.length !== ids.length) fail(400, "rollCallActiveOnly");
  }

  const before = await db
    .select({ userId: s.attendance.userId })
    .from(s.attendance)
    .where(and(eq(s.attendance.classId, k.id), eq(s.attendance.date, date)));
  await db.delete(s.attendance).where(and(eq(s.attendance.classId, k.id), eq(s.attendance.date, date)));
  if (ids.length) await db.insert(s.attendance).values(ids.map((userId) => ({ classId: k.id, date, userId, markedBy: staffId })));
  await db
    .insert(s.classOccurrences)
    .values({ classId: k.id, date, topic: topic ?? null, updatedBy: staffId })
    .onConflictDoUpdate({ target: [s.classOccurrences.classId, s.classOccurrences.date], set: { topic: topic ?? null, updatedBy: staffId, updatedAt: new Date() } });

  // Newly marked members get a nudge to log the session, prefilled from the class.
  const added = ids.filter((id) => !before.some((b) => b.userId === id));
  await notify(db, "attendance_confirmed", staffId, added, `${k.id}/${date}`);
  return c.json({ present: ids.length });
});

// ---------- Check-in by QR ----------

/**
 * The academy's check-in QR is printed once and stays at the entrance: it names the academy and carries
 * its secret token, not a class or a date. Staff fetch it to print or show it; the owner rotates the
 * token if the QR leaks (old prints stop working).
 */
classesRoutes.get("/academies/:id/checkin-qr", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  const [row] = await c.get("db").select({ token: s.academies.checkinToken }).from(s.academies).where(eq(s.academies.id, a.id));
  return c.json({ academyId: a.id, name: a.name, token: row.token });
});

classesRoutes.post("/academies/:id/checkin-qr/rotate", async (c) => {
  const { a, m } = await requireStaff(c, c.req.param("id"));
  if (m.role !== "owner") fail(403, "ownerRotatesQr");
  const token = randomBytes(16).toString("base64url");
  await c.get("db").update(s.academies).set({ checkinToken: token }).where(eq(s.academies.id, a.id));
  return c.json({ academyId: a.id, name: a.name, token });
});

/** How far around a class a check-in still counts as that class (minutes before the start). */
const CHECKIN_EARLY_MIN = 45;

/**
 * A member scans the academy QR. The server picks the class on now in the member's time zone (from 45
 * minutes before it starts until it ends; the closest start wins) and records a check-in for it: a
 * request staff still confirm in the roll call.
 */
classesRoutes.post("/checkin", async (c) => {
  const userId = viewer(c);
  const { a: academyId, t: token, tz } = await body(c, z.object({ a: z.string().min(1), t: z.string().min(1).max(64), tz: z.string().max(64).default("UTC") }));
  if (!isValidTimeZone(tz)) fail(400, "invalidTimeZone");
  const db = c.get("db");
  const [row] = await db.select({ token: s.academies.checkinToken }).from(s.academies).where(eq(s.academies.id, academyId));
  const expected = Buffer.from(row?.token ?? "");
  const given = Buffer.from(token);
  if (!row || expected.length !== given.length || !timingSafeEqual(expected, given)) fail(400, "invalidQr");
  const { a } = await requireMember(c, academyId);

  const now = localParts(new Date(), tz);
  const weekday = isoWeekday(now.date);
  const classes = await db
    .select(classColumns)
    .from(s.academyClasses)
    .where(and(eq(s.academyClasses.academyId, a.id), eq(s.academyClasses.weekday, weekday), isNull(s.academyClasses.archivedAt)));
  const live = classes
    .filter((k) => now.minutes >= minutesOf(k.startTime) - CHECKIN_EARLY_MIN && now.minutes <= minutesOf(k.startTime) + k.durationMin)
    .sort((x, y) => Math.abs(now.minutes - minutesOf(x.startTime)) - Math.abs(now.minutes - minutesOf(y.startTime)));
  const k = live[0];
  if (!k) fail(409, "noClassNow");
  const [o] = await db
    .select({ cancelled: s.classOccurrences.cancelled })
    .from(s.classOccurrences)
    .where(and(eq(s.classOccurrences.classId, k.id), eq(s.classOccurrences.date, now.date)));
  if (o?.cancelled) fail(409, "classCancelledToday");
  await db.insert(s.checkins).values({ classId: k.id, date: now.date, userId }).onConflictDoNothing();
  return c.json({ class: k, academy: { id: a.id, name: a.name }, date: now.date });
});
