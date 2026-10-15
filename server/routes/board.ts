import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { announcementInput } from "../../src/shared/domain";
import * as s from "../db/schema";
import { type AppEnv, body, fail, viewer } from "../http";
import { notify } from "../notify";
import { activeMemberIds, requireMember, requireStaff } from "./academies";

/** Members-only notice board, and the staff's list of students who stopped showing up. */
export const boardRoutes = new Hono<AppEnv>();

boardRoutes.get("/academies/:id/announcements", async (c) => {
  const { a } = await requireMember(c, c.req.param("id"));
  const rows = await c
    .get("db")
    .select({
      id: s.announcements.id,
      body: s.announcements.body,
      pinned: s.announcements.pinned,
      createdAt: s.announcements.createdAt,
      author: { id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username },
    })
    .from(s.announcements)
    .leftJoin(s.profiles, eq(s.profiles.userId, s.announcements.authorId))
    .where(eq(s.announcements.academyId, a.id))
    .orderBy(desc(s.announcements.pinned), desc(s.announcements.createdAt))
    .limit(30);
  return c.json(rows.map((r) => ({ ...r, author: r.author?.id ? r.author : null })));
});

boardRoutes.post("/academies/:id/announcements", async (c) => {
  const staffId = viewer(c);
  const { a } = await requireStaff(c, c.req.param("id"));
  const input = await body(c, announcementInput);
  const db = c.get("db");
  const [row] = await db.insert(s.announcements).values({ ...input, academyId: a.id, authorId: staffId }).returning({ id: s.announcements.id });
  await notify(db, "announcement", staffId, await activeMemberIds(db, a.id), a.id);
  return c.json(row, 201);
});

boardRoutes.patch("/academies/:id/announcements/:announcementId", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  const { pinned } = await body(c, z.object({ pinned: z.boolean() }));
  const [row] = await c
    .get("db")
    .update(s.announcements)
    .set({ pinned })
    .where(and(eq(s.announcements.id, c.req.param("announcementId")), eq(s.announcements.academyId, a.id)))
    .returning({ id: s.announcements.id });
  if (!row) fail(404, "Aviso não encontrado");
  return c.body(null, 204);
});

boardRoutes.delete("/academies/:id/announcements/:announcementId", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  await c.get("db").delete(s.announcements).where(and(eq(s.announcements.id, c.req.param("announcementId")), eq(s.announcements.academyId, a.id)));
  return c.body(null, 204);
});

/**
 * Students not seen for `days` or more: no roll call, check-in or session logged at the academy. Members
 * who joined less than `days` ago are not "missing" yet.
 */
boardRoutes.get("/academies/:id/inactive", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  const days = z.coerce.number().int().min(7).max(180).catch(14).parse(c.req.query("days"));
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const lastSeen = sql<string | null>`greatest(
    (select max(x.date) from attendance x join academy_classes k on k.id = x.class_id where k.academy_id = ${a.id} and x.user_id = ${s.academyMembers.userId}),
    (select max(x.date) from checkins x join academy_classes k on k.id = x.class_id where k.academy_id = ${a.id} and x.user_id = ${s.academyMembers.userId}),
    (select to_char(max(x.started_at), 'YYYY-MM-DD') from sessions x where x.academy_id = ${a.id} and x.user_id = ${s.academyMembers.userId})
  )`;
  const rows = await c
    .get("db")
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      belt: s.profiles.belt,
      stripes: s.profiles.stripes,
      joinedAt: s.academyMembers.createdAt,
      lastSeen,
    })
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .where(
      and(
        eq(s.academyMembers.academyId, a.id),
        eq(s.academyMembers.status, "active"),
        eq(s.academyMembers.role, "student"),
        sql`${s.academyMembers.createdAt} < ${new Date(Date.now() - days * 86_400_000)}`,
      ),
    );
  const missing = rows
    .filter((r) => !r.lastSeen || r.lastSeen < since)
    .sort((x, y) => (x.lastSeen ?? "").localeCompare(y.lastSeen ?? ""));
  return c.json({ days, members: missing });
});
