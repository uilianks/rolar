import { and, asc, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { ACADEMY_STATUSES, academyReview } from "../../src/shared/domain";
import * as s from "../db/schema";
import { admin, type AppEnv, body, fail } from "../http";
import { notify } from "../notify";

/** Admin panel: review of academy registrations. Every route requires an admin (ADMIN_EMAILS). */
export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", async (c, next) => {
  admin(c);
  await next();
});

const requester = {
  id: s.user.id,
  name: s.user.name,
  email: s.user.email,
  username: s.profiles.username,
  accountCreatedAt: s.user.createdAt,
};

adminRoutes.get("/academies", async (c) => {
  const status = z.enum(ACADEMY_STATUSES).catch("pending").parse(c.req.query("status"));
  const rows = await c
    .get("db")
    .select({
      id: s.academies.id,
      name: s.academies.name,
      city: s.academies.city,
      country: s.academies.country,
      status: s.academies.status,
      submittedAt: s.academies.submittedAt,
      reviewedAt: s.academies.reviewedAt,
      requester: { name: s.user.name, username: s.profiles.username },
    })
    .from(s.academies)
    .leftJoin(s.user, eq(s.user.id, s.academies.createdBy))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.academies.createdBy))
    .where(eq(s.academies.status, status))
    // Oldest first in the queue; most recent decisions first in the history.
    .orderBy(status === "pending" ? asc(s.academies.submittedAt) : desc(s.academies.reviewedAt))
    .limit(100);
  return c.json(rows);
});

/** Everything needed to decide: the registration, who sent it, and existing academies it may duplicate. */
adminRoutes.get("/academies/:id", async (c) => {
  const db = c.get("db");
  const [a] = await db.select().from(s.academies).where(eq(s.academies.id, c.req.param("id")));
  if (!a) fail(404, "Academia não encontrada");
  const [who] = a.createdBy
    ? await db
        .select({
          ...requester,
          sessions: sql<number>`(select count(*)::int from sessions x where x.user_id = ${s.user.id})`,
          academiesRegistered: sql<number>`(select count(*)::int from academies x where x.created_by = ${s.user.id})`,
        })
        .from(s.user)
        .leftJoin(s.profiles, eq(s.profiles.userId, s.user.id))
        .where(eq(s.user.id, a.createdBy))
    : [null];
  const same = <T>(col: Parameters<typeof eq>[0], v: T | null) => (v ? eq(col, v) : undefined);
  const similar = await db
    .select({ id: s.academies.id, name: s.academies.name, city: s.academies.city, status: s.academies.status })
    .from(s.academies)
    .where(
      and(
        ne(s.academies.id, a.id),
        or(
          ilike(s.academies.name, a.name.replace(/[%_\\]/g, "\\$&")),
          same(s.academies.phone, a.phone),
          same(s.academies.website, a.website),
          same(s.academies.instagram, a.instagram),
        ),
      ),
    )
    .limit(10);
  return c.json({ ...a, requester: who ?? null, similar });
});

adminRoutes.post("/academies/:id/review", async (c) => {
  const adminId = admin(c);
  const db = c.get("db");
  const { decision, note } = await body(c, academyReview);
  const [a] = await db.select().from(s.academies).where(eq(s.academies.id, c.req.param("id")));
  if (!a) fail(404, "Academia não encontrada");
  if (a.status !== "pending") fail(409, "Esta academia já foi revista");
  const status = decision === "approve" ? "approved" : "rejected";
  await db
    .update(s.academies)
    .set({ status, reviewNote: note || null, reviewedBy: adminId, reviewedAt: new Date() })
    .where(eq(s.academies.id, a.id));
  if (a.createdBy) {
    if (status === "approved") {
      await db.update(s.profiles).set({ homeAcademyId: a.id }).where(and(eq(s.profiles.userId, a.createdBy), isNull(s.profiles.homeAcademyId)));
    }
    await notify(db, status === "approved" ? "academy_approved" : "academy_rejected", adminId, [a.createdBy], a.id);
  }
  return c.body(null, 204);
});
