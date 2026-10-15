import { and, eq, gte, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { z } from "zod";

import { profileInput, profilePatch, VISIBILITIES } from "../../src/shared/domain";
import type { Db } from "../db/client";
import * as s from "../db/schema";
import { type AppEnv, body, fail, isUniqueViolation, viewer } from "../http";
import { effectiveVisibility } from "../policies";
import { computeStats, isValidTimeZone } from "../stats";

export const me = new Hono<AppEnv>();

async function pendingAcademies(db: Db) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.academies).where(eq(s.academies.status, "pending"));
  return n;
}

me.get("/", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const [u] = await db.select().from(s.user).where(eq(s.user.id, userId));
  const [profile] = await db.select().from(s.profiles).where(eq(s.profiles.userId, userId));
  const memberships = await db
    .select({
      academy: { id: s.academies.id, name: s.academies.name, slug: s.academies.slug, status: s.academies.status },
      role: s.academyMembers.role,
      status: s.academyMembers.status,
    })
    .from(s.academyMembers)
    .innerJoin(s.academies, eq(s.academies.id, s.academyMembers.academyId))
    .where(eq(s.academyMembers.userId, userId));
  const flags = await db
    .select({ key: s.featureFlags.key })
    .from(s.featureFlags)
    .where(or(eq(s.featureFlags.enabledForAll, true), sql`${userId} = any(${s.featureFlags.userIds})`));
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(s.notifications)
    .where(and(eq(s.notifications.userId, userId), sql`${s.notifications.readAt} is null`));
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, image: u.image },
    profile: profile ?? null,
    memberships,
    flags: flags.map((f) => f.key),
    unreadNotifications: unread,
    admin: c.get("isAdmin") ? { pendingAcademies: await pendingAcademies(db) } : null,
  });
});

/** Onboarding: creates the profile once. Birth year cannot change afterwards (age rules depend on it). */
me.post("/profile", async (c) => {
  const userId = viewer(c);
  const input = await body(c, profileInput);
  const db = c.get("db");
  try {
    const [profile] = await db.insert(s.profiles).values({ ...input, userId }).returning();
    await db.update(s.user).set({ name: input.name }).where(eq(s.user.id, userId));
    return c.json(profile, 201);
  } catch (e) {
    if (isUniqueViolation(e)) fail(409, "Perfil ou nome de usuário já existe");
    throw e;
  }
});

me.patch("/profile", async (c) => {
  const userId = viewer(c);
  const input = await body(c, profilePatch);
  const db = c.get("db");
  try {
    const [profile] = await db.update(s.profiles).set(input).where(eq(s.profiles.userId, userId)).returning();
    if (!profile) fail(404, "Complete o cadastro primeiro");
    return c.json(profile);
  } catch (e) {
    if (isUniqueViolation(e)) fail(409, "Nome de usuário já em uso");
    throw e;
  }
});

/** Applies one visibility to every past session (the "edit past privacy" setting). */
me.post("/sessions/visibility", async (c) => {
  const userId = viewer(c);
  const { visibility } = await body(c, z.object({ visibility: z.enum(VISIBILITIES) }));
  const db = c.get("db");
  const [p] = await db.select({ birthYear: s.profiles.birthYear }).from(s.profiles).where(eq(s.profiles.userId, userId));
  if (!p) fail(404, "Complete o cadastro primeiro");
  const result = await db
    .update(s.sessions)
    .set({ visibility: effectiveVisibility(visibility, p.birthYear) })
    .where(eq(s.sessions.userId, userId))
    .returning({ id: s.sessions.id });
  return c.json({ updated: result.length });
});

me.get("/stats", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const tz = c.req.query("tz") ?? "UTC";
  if (!isValidTimeZone(tz)) fail(400, "Fuso horário inválido");
  const range = c.req.query("range") ?? "year";
  const now = new Date();
  // Weekly views need ~8 weeks; the heatmap needs 26; "year"/"month" totals need their own window.
  const from =
    range === "all" ? null : new Date(now.getTime() - (range === "month" ? 31 : 366) * 86_400_000);
  const [profile] = await db.select({ weeklyGoal: s.profiles.weeklyGoal }).from(s.profiles).where(eq(s.profiles.userId, userId));
  const rows = await db
    .select({ startedAt: s.sessions.startedAt, durationMin: s.sessions.durationMin, rounds: s.sessions.rounds, rpe: s.sessions.rpe, kind: s.sessions.kind })
    .from(s.sessions)
    .where(and(eq(s.sessions.userId, userId), from ? gte(s.sessions.startedAt, new Date(Math.min(from.getTime(), now.getTime() - 190 * 86_400_000))) : undefined));
  const inRange = from ? rows.filter((r) => r.startedAt >= from) : rows;
  const all = computeStats(rows, { tz, now, weeklyGoal: profile?.weeklyGoal ?? 0 });
  const ranged = computeStats(inRange, { tz, now, weeklyGoal: profile?.weeklyGoal ?? 0 });
  return c.json({ ...all, totals: ranged.totals, byKind: ranged.byKind, range });
});

me.get("/notifications", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const rows = await db
    .select({
      id: s.notifications.id,
      type: s.notifications.type,
      targetId: s.notifications.targetId,
      readAt: s.notifications.readAt,
      createdAt: s.notifications.createdAt,
      actor: { id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username },
    })
    .from(s.notifications)
    .leftJoin(s.profiles, eq(s.profiles.userId, s.notifications.actorId))
    .where(eq(s.notifications.userId, userId))
    .orderBy(sql`${s.notifications.createdAt} desc`)
    .limit(50);
  return c.json(rows.map((n) => ({ ...n, actor: n.actor?.id ? n.actor : null })));
});

me.post("/notifications/read", async (c) => {
  const userId = viewer(c);
  await c
    .get("db")
    .update(s.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(s.notifications.userId, userId), sql`${s.notifications.readAt} is null`));
  return c.body(null, 204);
});

/** GDPR art. 15/20: everything stored about the user, as JSON. */
me.get("/export", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const [u] = await db.select({ id: s.user.id, email: s.user.email, name: s.user.name, createdAt: s.user.createdAt }).from(s.user).where(eq(s.user.id, userId));
  const data = {
    exportedAt: new Date().toISOString(),
    user: u,
    profile: (await db.select().from(s.profiles).where(eq(s.profiles.userId, userId)))[0] ?? null,
    sessions: await db.select().from(s.sessions).where(eq(s.sessions.userId, userId)),
    comments: await db.select().from(s.comments).where(eq(s.comments.userId, userId)),
    reactions: await db.select().from(s.reactions).where(eq(s.reactions.userId, userId)),
    follows: await db.select().from(s.follows).where(or(eq(s.follows.followerId, userId), eq(s.follows.followeeId, userId))),
    blocks: await db.select().from(s.blocks).where(eq(s.blocks.blockerId, userId)),
    memberships: await db.select().from(s.academyMembers).where(eq(s.academyMembers.userId, userId)),
    promotions: await db.select().from(s.promotions).where(eq(s.promotions.userId, userId)),
    reports: await db.select().from(s.reports).where(eq(s.reports.reporterId, userId)),
    attendance: await db.select().from(s.attendance).where(eq(s.attendance.userId, userId)),
    checkins: await db.select().from(s.checkins).where(eq(s.checkins.userId, userId)),
    events: await db.select().from(s.eventAttendees).where(eq(s.eventAttendees.userId, userId)),
    payments: await db.select().from(s.payments).where(eq(s.payments.userId, userId)),
  };
  c.header("Content-Disposition", 'attachment; filename="tatame-dados.json"');
  return c.json(data);
});

/** GDPR art. 17 / store requirement: deleting the user cascades to all of their data. */
me.delete("/", async (c) => {
  const userId = viewer(c);
  await c.get("db").delete(s.user).where(eq(s.user.id, userId));
  return c.body(null, 204);
});
