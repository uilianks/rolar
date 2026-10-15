import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { BELTS } from "../../src/shared/domain";
import * as s from "../db/schema";
import { type AppEnv, body, fail, viewer } from "../http";
import { notify } from "../notify";
import { isActiveStaff, membership } from "../policies";

export const promotionsRoutes = new Hono<AppEnv>();

const promotionInput = z.object({
  belt: z.enum(BELTS),
  stripes: z.number().int().min(0).max(6),
  promotedOn: z.iso.date(),
  academyId: z.string().nullable().optional(),
});

/** Records a graduation. The newest one sets the profile belt; with an academy, its staff can confirm it. */
promotionsRoutes.post("/promotions", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const input = await body(c, promotionInput);
  if (input.academyId && (await membership(db, input.academyId, userId))?.status !== "active") {
    fail(400, "notActiveMember");
  }
  const [row] = await db.insert(s.promotions).values({ ...input, userId, academyId: input.academyId ?? null }).returning();
  const [latest] = await db
    .select({ id: s.promotions.id })
    .from(s.promotions)
    .where(eq(s.promotions.userId, userId))
    .orderBy(desc(s.promotions.promotedOn), desc(s.promotions.createdAt))
    .limit(1);
  if (latest.id === row.id) {
    await db.update(s.profiles).set({ belt: input.belt, stripes: input.stripes }).where(eq(s.profiles.userId, userId));
  }
  if (row.academyId) {
    const staff = await db
      .select({ id: s.academyMembers.userId })
      .from(s.academyMembers)
      .where(and(eq(s.academyMembers.academyId, row.academyId), eq(s.academyMembers.status, "active"), sql`${s.academyMembers.role} in ('owner','coach')`));
    await notify(db, "promotion_request", userId, staff.map((r) => r.id), row.id);
  }
  return c.json(row, 201);
});

/** Pending graduations the viewer can confirm, across their academies. */
promotionsRoutes.get("/promotions/pending", async (c) => {
  const userId = viewer(c);
  const rows = await c
    .get("db")
    .select({
      id: s.promotions.id,
      belt: s.promotions.belt,
      stripes: s.promotions.stripes,
      promotedOn: s.promotions.promotedOn,
      academyId: s.promotions.academyId,
      user: { id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username, avatarUrl: s.profiles.avatarUrl },
    })
    .from(s.promotions)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.promotions.userId))
    .innerJoin(
      s.academyMembers,
      and(
        eq(s.academyMembers.academyId, s.promotions.academyId),
        eq(s.academyMembers.userId, userId),
        eq(s.academyMembers.status, "active"),
        sql`${s.academyMembers.role} in ('owner','coach')`,
      ),
    )
    .where(and(sql`${s.promotions.confirmedBy} is null`, sql`${s.promotions.userId} <> ${userId}`));
  return c.json(rows);
});

promotionsRoutes.post("/promotions/:id/confirm", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const [p] = await db.select().from(s.promotions).where(eq(s.promotions.id, c.req.param("id")));
  if (!p) fail(404, "promotionNotFound");
  if (p.userId === userId) fail(403, "noSelfPromotion");
  if (!p.academyId || !isActiveStaff(await membership(db, p.academyId, userId))) fail(403, "coachesConfirm");
  await db.update(s.promotions).set({ confirmedBy: userId, confirmedAt: new Date() }).where(eq(s.promotions.id, p.id));
  await notify(db, "promotion_confirmed", userId, [p.userId], p.id);
  return c.body(null, 204);
});

promotionsRoutes.delete("/promotions/:id", async (c) => {
  const userId = viewer(c);
  const [row] = await c
    .get("db")
    .delete(s.promotions)
    .where(and(eq(s.promotions.id, c.req.param("id")), eq(s.promotions.userId, userId)))
    .returning({ id: s.promotions.id });
  if (!row) fail(404, "promotionNotFound");
  return c.body(null, 204);
});
