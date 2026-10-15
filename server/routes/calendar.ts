import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { eventInput, RESULTS, rsvpInput } from "../../src/shared/domain";
import * as s from "../db/schema";
import { type AppEnv, body, fail, viewer } from "../http";
import { notify } from "../notify";
import { isActiveStaff, membership } from "../policies";
import { activeMemberIds, findAcademy, requireMember, requireStaff } from "./academies";

/** Academy calendar: weekly classes with their per-date changes, and events (competitions, seminars…). */
export const calendarRoutes = new Hono<AppEnv>();

const eventColumns = {
  id: s.academyEvents.id,
  academyId: s.academyEvents.academyId,
  kind: s.academyEvents.kind,
  title: s.academyEvents.title,
  description: s.academyEvents.description,
  startsAt: s.academyEvents.startsAt,
  endsAt: s.academyEvents.endsAt,
  location: s.academyEvents.location,
  url: s.academyEvents.url,
  signupUntil: s.academyEvents.signupUntil,
  going: sql<number>`(select count(*)::int from event_attendees x where x.event_id = ${s.academyEvents.id})`,
};

const goingColumn = (userId: string) =>
  sql<boolean>`exists (select 1 from event_attendees x where x.event_id = ${s.academyEvents.id} and x.user_id = ${userId})`;

const range = z.object({ from: z.iso.date(), to: z.iso.date() }).refine((r) => r.from <= r.to, "dateRange");

/**
 * Everything to draw a month: the weekly classes (the client repeats them over the dates), the
 * per-date changes (cancellations, notes, topics) and the events. Same visibility as the timetable.
 */
calendarRoutes.get("/academies/:id/calendar", async (c) => {
  const userId = viewer(c);
  const a = await findAcademy(c, c.req.param("id"));
  const { from, to } = range.parse({ from: c.req.query("from"), to: c.req.query("to") });
  const db = c.get("db");
  const classes = await db
    .select({
      id: s.academyClasses.id,
      academyId: s.academyClasses.academyId,
      weekday: s.academyClasses.weekday,
      startTime: s.academyClasses.startTime,
      durationMin: s.academyClasses.durationMin,
      title: s.academyClasses.title,
      kind: s.academyClasses.kind,
    })
    .from(s.academyClasses)
    .where(and(eq(s.academyClasses.academyId, a.id), sql`${s.academyClasses.archivedAt} is null`))
    .orderBy(asc(s.academyClasses.startTime));
  const occurrences = await db
    .select({
      classId: s.classOccurrences.classId,
      date: s.classOccurrences.date,
      cancelled: s.classOccurrences.cancelled,
      note: s.classOccurrences.note,
      topic: s.classOccurrences.topic,
    })
    .from(s.classOccurrences)
    .innerJoin(s.academyClasses, eq(s.academyClasses.id, s.classOccurrences.classId))
    .where(and(eq(s.academyClasses.academyId, a.id), gte(s.classOccurrences.date, from), lte(s.classOccurrences.date, to)));
  const events = await db
    .select({ ...eventColumns, isGoing: goingColumn(userId) })
    .from(s.academyEvents)
    // Events are stored as instants; a day of margin on each side covers every time zone.
    .where(
      and(
        eq(s.academyEvents.academyId, a.id),
        gte(s.academyEvents.startsAt, new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000)),
        lte(s.academyEvents.startsAt, new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86_400_000)),
      ),
    )
    .orderBy(asc(s.academyEvents.startsAt));
  return c.json({ classes, occurrences, events });
});

/** Upcoming events for the academy page (competitions first in line for sign-ups). */
calendarRoutes.get("/academies/:id/events", async (c) => {
  const userId = viewer(c);
  const a = await findAcademy(c, c.req.param("id"));
  const rows = await c
    .get("db")
    .select({ ...eventColumns, isGoing: goingColumn(userId) })
    .from(s.academyEvents)
    .where(and(eq(s.academyEvents.academyId, a.id), gte(s.academyEvents.startsAt, new Date(Date.now() - 86_400_000))))
    .orderBy(asc(s.academyEvents.startsAt))
    .limit(20);
  return c.json(rows);
});

calendarRoutes.get("/academies/:id/events/:eventId", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const a = await findAcademy(c, c.req.param("id"));
  const [e] = await db
    .select({ ...eventColumns, isGoing: goingColumn(userId) })
    .from(s.academyEvents)
    .where(and(eq(s.academyEvents.id, c.req.param("eventId")), eq(s.academyEvents.academyId, a.id)));
  if (!e) fail(404, "eventNotFound");
  // Who is going (with division and result) is for the academy's members only.
  const m = await membership(db, a.id, userId);
  const attendees =
    m?.status === "active"
      ? await db
          .select({
            id: s.profiles.userId,
            name: s.profiles.name,
            username: s.profiles.username,
            avatarUrl: s.profiles.avatarUrl,
            belt: s.profiles.belt,
            stripes: s.profiles.stripes,
            category: s.eventAttendees.category,
            result: s.eventAttendees.result,
          })
          .from(s.eventAttendees)
          .innerJoin(s.profiles, eq(s.profiles.userId, s.eventAttendees.userId))
          .where(eq(s.eventAttendees.eventId, e.id))
          .orderBy(asc(s.profiles.name))
      : [];
  return c.json({ ...e, attendees });
});

calendarRoutes.post("/academies/:id/events", async (c) => {
  const staffId = viewer(c);
  const { a } = await requireStaff(c, c.req.param("id"));
  const input = await body(c, eventInput);
  const db = c.get("db");
  const [e] = await db
    .insert(s.academyEvents)
    .values({ ...input, startsAt: new Date(input.startsAt), endsAt: input.endsAt ? new Date(input.endsAt) : null, academyId: a.id, createdBy: staffId })
    .returning({ id: s.academyEvents.id });
  await notify(db, "event_published", staffId, await activeMemberIds(db, a.id), `${a.id}/${e.id}`);
  return c.json(e, 201);
});

calendarRoutes.put("/academies/:id/events/:eventId", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  const input = await body(c, eventInput);
  const [e] = await c
    .get("db")
    .update(s.academyEvents)
    .set({
      ...input,
      description: input.description ?? null,
      location: input.location ?? null,
      url: input.url ?? null,
      signupUntil: input.signupUntil ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    })
    .where(and(eq(s.academyEvents.id, c.req.param("eventId")), eq(s.academyEvents.academyId, a.id)))
    .returning({ id: s.academyEvents.id });
  if (!e) fail(404, "eventNotFound");
  return c.json(e);
});

calendarRoutes.delete("/academies/:id/events/:eventId", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  await c.get("db").delete(s.academyEvents).where(and(eq(s.academyEvents.id, c.req.param("eventId")), eq(s.academyEvents.academyId, a.id)));
  return c.body(null, 204);
});

async function memberEvent(c: Parameters<typeof viewer>[0]) {
  const { a, m } = await requireMember(c, c.req.param("id")!);
  const [e] = await c
    .get("db")
    .select({ id: s.academyEvents.id, startsAt: s.academyEvents.startsAt, signupUntil: s.academyEvents.signupUntil, kind: s.academyEvents.kind })
    .from(s.academyEvents)
    .where(and(eq(s.academyEvents.id, c.req.param("eventId")!), eq(s.academyEvents.academyId, a.id)));
  if (!e) fail(404, "eventNotFound");
  return { a, m, e };
}

/** "Vou" — members sign up until the deadline (or the start); the division can be updated the same way. */
calendarRoutes.put("/academies/:id/events/:eventId/rsvp", async (c) => {
  const userId = viewer(c);
  const { e } = await memberEvent(c);
  const { category } = await body(c, rsvpInput);
  const today = new Date().toISOString().slice(0, 10);
  if (e.startsAt.getTime() < Date.now() - 86_400_000 || (e.signupUntil && today > e.signupUntil)) fail(409, "signupClosed");
  await c
    .get("db")
    .insert(s.eventAttendees)
    .values({ eventId: e.id, userId, category: category ?? null })
    .onConflictDoUpdate({ target: [s.eventAttendees.eventId, s.eventAttendees.userId], set: { category: category ?? null } });
  return c.body(null, 204);
});

calendarRoutes.delete("/academies/:id/events/:eventId/rsvp", async (c) => {
  const userId = viewer(c);
  const { e } = await memberEvent(c);
  await c.get("db").delete(s.eventAttendees).where(and(eq(s.eventAttendees.eventId, e.id), eq(s.eventAttendees.userId, userId)));
  return c.body(null, 204);
});

/** After a competition starts: the athlete records their own result, or staff record it for them. */
calendarRoutes.put("/academies/:id/events/:eventId/results/:userId", async (c) => {
  const userId = viewer(c);
  const { m, e } = await memberEvent(c);
  const target = c.req.param("userId");
  if (target !== userId && !isActiveStaff(m)) fail(403, "resultByAthleteOrCoach");
  if (e.kind !== "competition") fail(400, "resultsOnlyCompetitions");
  if (e.startsAt.getTime() > Date.now()) fail(409, "competitionNotStarted");
  const { result } = await body(c, z.object({ result: z.enum(RESULTS).nullable() }));
  const [row] = await c
    .get("db")
    .update(s.eventAttendees)
    .set({ result })
    .where(and(eq(s.eventAttendees.eventId, e.id), eq(s.eventAttendees.userId, target)))
    .returning({ userId: s.eventAttendees.userId });
  if (!row) fail(404, "notSignedUp");
  return c.body(null, 204);
});

/** Medal table of the academy for a year: totals and per athlete. */
calendarRoutes.get("/academies/:id/medals", async (c) => {
  viewer(c);
  const a = await findAcademy(c, c.req.param("id"));
  const year = z.coerce.number().int().min(2000).max(2100).catch(new Date().getUTCFullYear()).parse(c.req.query("year"));
  const rows = await c
    .get("db")
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      belt: s.profiles.belt,
      gold: sql<number>`count(*) filter (where ${s.eventAttendees.result} = 'gold')::int`,
      silver: sql<number>`count(*) filter (where ${s.eventAttendees.result} = 'silver')::int`,
      bronze: sql<number>`count(*) filter (where ${s.eventAttendees.result} = 'bronze')::int`,
    })
    .from(s.eventAttendees)
    .innerJoin(s.academyEvents, eq(s.academyEvents.id, s.eventAttendees.eventId))
    .innerJoin(s.profiles, eq(s.profiles.userId, s.eventAttendees.userId))
    .where(
      and(
        eq(s.academyEvents.academyId, a.id),
        isNotNull(s.eventAttendees.result),
        sql`extract(year from ${s.academyEvents.startsAt}) = ${year}`,
        sql`${s.eventAttendees.result} <> 'participated'`,
      ),
    )
    .groupBy(s.profiles.userId, s.profiles.name, s.profiles.username, s.profiles.belt)
    .orderBy(
      desc(sql`count(*) filter (where ${s.eventAttendees.result} = 'gold')`),
      desc(sql`count(*) filter (where ${s.eventAttendees.result} = 'silver')`),
      desc(sql`count(*) filter (where ${s.eventAttendees.result} = 'bronze')`),
      asc(s.profiles.name),
    );
  const total = rows.reduce((t, r) => ({ gold: t.gold + r.gold, silver: t.silver + r.silver, bronze: t.bronze + r.bronze }), { gold: 0, silver: 0, bronze: 0 });
  return c.json({ year, total, athletes: rows });
});
