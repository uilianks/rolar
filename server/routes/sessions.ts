import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";

import { commentInput, sessionInput } from "../../src/shared/domain";
import { normalizeCard, pageOfCards, sessionCards } from "../cards";
import type { Db } from "../db/client";
import * as s from "../db/schema";
import { type AppEnv, body, fail, viewer } from "../http";
import { notify } from "../notify";
import { blockedBetween, effectiveVisibility, follows, membership, sessionVisibleTo, suspended } from "../policies";

export const sessionsRoutes = new Hono<AppEnv>();

async function requireProfile(db: Db, userId: string) {
  const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, userId));
  if (!p) fail(403, "completeSignup");
  return p;
}

async function visibleSession(db: Db, viewerId: string, id: string) {
  const [card] = await sessionCards(db, viewerId).where(and(eq(s.sessions.id, id), sessionVisibleTo(viewerId)));
  if (!card) fail(404, "sessionNotFound");
  return normalizeCard(card);
}

async function checkAcademy(db: Db, userId: string, academyId: string | null | undefined) {
  if (!academyId) return null;
  const m = await membership(db, academyId, userId);
  if (m?.status !== "active") fail(400, "notActiveMember");
  const [a] = await db.select({ status: s.academies.status }).from(s.academies).where(eq(s.academies.id, academyId));
  if (a?.status !== "approved") fail(400, "academyUnderReview");
  return academyId;
}

sessionsRoutes.get("/feed", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const scope = c.req.query("scope") ?? "following";
  const where =
    scope === "me"
      ? eq(s.sessions.userId, userId)
      : scope === "academy"
        ? sql`${s.sessions.userId} in (select b.user_id from academy_members a join academy_members b
            on a.academy_id = b.academy_id where a.user_id = ${userId} and a.status = 'active' and b.status = 'active')`
        : sql`(${s.sessions.userId} = ${userId} or ${follows(userId, s.sessions.userId)})`;
  return c.json(await pageOfCards(db, userId, where, c.req.query("cursor")));
});

sessionsRoutes.post("/sessions", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const input = await body(c, sessionInput);
  const profile = await requireProfile(db, userId);
  const academyId = await checkAcademy(db, userId, input.academyId ?? profile.homeAcademyId);
  const [row] = await db
    .insert(s.sessions)
    .values({
      ...input,
      userId,
      academyId,
      startedAt: new Date(input.startedAt),
      title: input.title || null,
      notes: input.notes || null,
      visibility: effectiveVisibility(input.visibility ?? profile.defaultVisibility, profile.birthYear),
    })
    .returning({ id: s.sessions.id });
  return c.json(await visibleSession(db, userId, row.id), 201);
});

sessionsRoutes.get("/sessions/:id", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const card = await visibleSession(db, userId, c.req.param("id"));
  const commentRows = await db
    .select({
      id: s.comments.id,
      body: s.comments.body,
      createdAt: s.comments.createdAt,
      author: { id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username, avatarUrl: s.profiles.avatarUrl, belt: s.profiles.belt },
    })
    .from(s.comments)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.comments.userId))
    .where(and(eq(s.comments.sessionId, card.id), sql`not ${blockedBetween(userId, s.comments.userId)}`, sql`not ${suspended(s.comments.userId)}`))
    .orderBy(asc(s.comments.createdAt));
  const ossBy = await db
    .select({ id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username, avatarUrl: s.profiles.avatarUrl })
    .from(s.reactions)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.reactions.userId))
    .where(eq(s.reactions.sessionId, card.id))
    .limit(20);
  return c.json({ ...card, comments: commentRows, ossBy });
});

sessionsRoutes.patch("/sessions/:id", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const input = await body(c, sessionInput.partial());
  const profile = await requireProfile(db, userId);
  const { startedAt, academyId, visibility, ...rest } = input;
  const patch: Partial<typeof s.sessions.$inferInsert> = { ...rest };
  if (startedAt) patch.startedAt = new Date(startedAt);
  if (academyId !== undefined) patch.academyId = await checkAcademy(db, userId, academyId);
  if (visibility) patch.visibility = effectiveVisibility(visibility, profile.birthYear);
  const [row] = await db
    .update(s.sessions)
    .set(patch)
    .where(and(eq(s.sessions.id, c.req.param("id")), eq(s.sessions.userId, userId)))
    .returning({ id: s.sessions.id });
  if (!row) fail(404, "sessionNotFound");
  return c.json(await visibleSession(db, userId, row.id));
});

sessionsRoutes.delete("/sessions/:id", async (c) => {
  const userId = viewer(c);
  const [row] = await c
    .get("db")
    .delete(s.sessions)
    .where(and(eq(s.sessions.id, c.req.param("id")), eq(s.sessions.userId, userId)))
    .returning({ id: s.sessions.id });
  if (!row) fail(404, "sessionNotFound");
  return c.body(null, 204);
});

sessionsRoutes.post("/sessions/:id/oss", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const card = await visibleSession(db, userId, c.req.param("id"));
  const inserted = await db.insert(s.reactions).values({ sessionId: card.id, userId }).onConflictDoNothing().returning();
  if (inserted.length) await notify(db, "oss", userId, [card.author.id], card.id);
  return c.body(null, 204);
});

sessionsRoutes.delete("/sessions/:id/oss", async (c) => {
  const userId = viewer(c);
  await c
    .get("db")
    .delete(s.reactions)
    .where(and(eq(s.reactions.sessionId, c.req.param("id")), eq(s.reactions.userId, userId)));
  return c.body(null, 204);
});

sessionsRoutes.post("/sessions/:id/comments", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const { body: text } = await body(c, commentInput);
  await requireProfile(db, userId);
  const card = await visibleSession(db, userId, c.req.param("id"));
  const [comment] = await db.insert(s.comments).values({ sessionId: card.id, userId, body: text }).returning();
  await notify(db, "comment", userId, [card.author.id], card.id);
  return c.json(comment, 201);
});

/** The comment author or the session owner can remove a comment. */
sessionsRoutes.delete("/comments/:id", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const owned = db.select({ id: s.sessions.id }).from(s.sessions).where(eq(s.sessions.userId, userId));
  const [row] = await db
    .delete(s.comments)
    .where(
      and(
        eq(s.comments.id, c.req.param("id")),
        sql`(${s.comments.userId} = ${userId} or ${inArray(s.comments.sessionId, owned)})`,
      ),
    )
    .returning({ id: s.comments.id });
  if (!row) fail(404, "commentNotFound");
  return c.body(null, 204);
});
