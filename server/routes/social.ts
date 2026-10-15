import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { ADULT_AGE, reportInput } from "../../src/shared/domain";
import { readAvatar } from "../avatars";
import { pageOfCards } from "../cards";
import * as s from "../db/schema";
import { type AppEnv, body, fail, viewer } from "../http";
import { notify } from "../notify";
import { blockedBetween, canFollow, follows, suspended } from "../policies";

export const social = new Hono<AppEnv>();

const adultSql = sql`(extract(year from now())::int - ${s.profiles.birthYear}) >= ${ADULT_AGE}`;

/** Search covers adults who opted in, never across a block or a suspension (minors are never searchable). */
social.get("/users", async (c) => {
  const userId = viewer(c);
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json([]);
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await c
    .get("db")
    .select({ id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username, avatarUrl: s.profiles.avatarUrl, belt: s.profiles.belt, stripes: s.profiles.stripes })
    .from(s.profiles)
    .where(
      and(
        or(ilike(s.profiles.name, pattern), ilike(s.profiles.username, pattern)),
        eq(s.profiles.searchable, true),
        adultSql,
        sql`${s.profiles.userId} <> ${userId}`,
        sql`not ${blockedBetween(userId, s.profiles.userId)}`,
        sql`not ${suspended(s.profiles.userId)}`,
      ),
    )
    .limit(20);
  return c.json(rows);
});

/**
 * Profile photos are public like the name (as in any social app), so <img> tags and caches need no
 * cookies. Minors never have one (canHaveAvatar), and the URL is versioned, so it is cached forever.
 */
social.get("/avatars/:userId", async (c) => {
  const a = await readAvatar(c.get("db"), c.req.param("userId"));
  if (!a) fail(404, "Sem foto");
  return c.body(a.bytes, 200, {
    "Content-Type": a.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
});

social.get("/users/:username", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const [p] = await db
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      belt: s.profiles.belt,
      stripes: s.profiles.stripes,
      startedAt: s.profiles.startedAt,
      homeAcademy: { id: s.academies.id, name: s.academies.name, slug: s.academies.slug },
      followers: sql<number>`(select count(*)::int from follows f where f.followee_id = ${s.profiles.userId})`,
      following: sql<number>`(select count(*)::int from follows f where f.follower_id = ${s.profiles.userId})`,
      isFollowing: follows(userId, s.profiles.userId).mapWith(Boolean),
      blocked: blockedBetween(userId, s.profiles.userId).mapWith(Boolean),
      suspended: suspended(s.profiles.userId).mapWith(Boolean),
    })
    .from(s.profiles)
    .leftJoin(s.academies, eq(s.academies.id, s.profiles.homeAcademyId))
    .where(eq(s.profiles.username, c.req.param("username").toLowerCase()));
  // Admins still open a suspended profile, to review it.
  if (!p || p.blocked || (p.suspended && !c.get("isAdmin"))) fail(404, "Perfil não encontrado");
  const promotions = await db
    .select()
    .from(s.promotions)
    .where(eq(s.promotions.userId, p.id))
    .orderBy(desc(s.promotions.promotedOn));
  const { blocked: _blocked, suspended: _suspended, ...profile } = p;
  return c.json({
    ...profile,
    homeAcademy: p.homeAcademy?.id ? p.homeAcademy : null,
    canFollow: !p.isFollowing && (await canFollow(db, userId, p.id)),
    promotions,
  });
});

social.get("/users/:username/sessions", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const [p] = await db.select({ id: s.profiles.userId }).from(s.profiles).where(eq(s.profiles.username, c.req.param("username").toLowerCase()));
  if (!p) fail(404, "Perfil não encontrado");
  return c.json(await pageOfCards(db, userId, eq(s.sessions.userId, p.id), c.req.query("cursor")));
});

social.post("/users/:id/follow", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const target = c.req.param("id");
  if (!(await canFollow(db, userId, target))) fail(403, "Não é possível seguir este perfil");
  const inserted = await db.insert(s.follows).values({ followerId: userId, followeeId: target }).onConflictDoNothing().returning();
  if (inserted.length) await notify(db, "follow", userId, [target], userId);
  return c.body(null, 204);
});

social.delete("/users/:id/follow", async (c) => {
  const userId = viewer(c);
  await c.get("db").delete(s.follows).where(and(eq(s.follows.followerId, userId), eq(s.follows.followeeId, c.req.param("id"))));
  return c.body(null, 204);
});

/** Blocking also removes follows in both directions. */
social.post("/users/:id/block", async (c) => {
  const userId = viewer(c);
  const target = c.req.param("id");
  if (target === userId) fail(400, "Não é possível bloquear a si mesmo");
  const db = c.get("db");
  await db.insert(s.blocks).values({ blockerId: userId, blockedId: target }).onConflictDoNothing();
  await db
    .delete(s.follows)
    .where(
      or(
        and(eq(s.follows.followerId, userId), eq(s.follows.followeeId, target)),
        and(eq(s.follows.followerId, target), eq(s.follows.followeeId, userId)),
      ),
    );
  return c.body(null, 204);
});

social.delete("/users/:id/block", async (c) => {
  const userId = viewer(c);
  await c.get("db").delete(s.blocks).where(and(eq(s.blocks.blockerId, userId), eq(s.blocks.blockedId, c.req.param("id"))));
  return c.body(null, 204);
});

social.get("/blocks", async (c) => {
  const userId = viewer(c);
  const rows = await c
    .get("db")
    .select({ id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username, avatarUrl: s.profiles.avatarUrl })
    .from(s.blocks)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.blocks.blockedId))
    .where(eq(s.blocks.blockerId, userId));
  return c.json(rows);
});

/** Notice-and-action entry point (DSA art. 16); reviewed by the maintainers. */
social.post("/reports", async (c) => {
  const userId = viewer(c);
  const input = await body(c, reportInput);
  const [row] = await c.get("db").insert(s.reports).values({ ...input, reporterId: userId }).returning({ id: s.reports.id });
  return c.json(row, 201);
});
