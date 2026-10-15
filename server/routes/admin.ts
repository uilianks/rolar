import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import {
  ACADEMY_STATUSES,
  academyEdit,
  academyReview,
  FLAG_KEY,
  featureFlagInput,
  isMinor,
  type ReportTarget,
  reportResolution,
  suspensionInput,
  usernameSchema,
} from "../../src/shared/domain";
import type { Db } from "../db/client";
import * as s from "../db/schema";
import type { Messages } from "../../src/shared/i18n";
import { admin, type AppEnv, body, fail, t } from "../http";
import { removeAvatar } from "../avatars";
import { suspendUser, unsuspendUser } from "../moderation";
import { notify } from "../notify";
import { suspended } from "../policies";
import { adminIds } from "./academies";

/**
 * Admin panel: academy verification and edits, the moderation queue (reports), accounts, feature
 * flags and a few numbers. Every route requires an admin (ADMIN_EMAILS).
 */
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
  if (!a) fail(404, "academyNotFound");
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
  const owners = await db
    .select({ id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username })
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.role, "owner")));
  return c.json({ ...a, requester: who ?? null, similar, owner: owners[0] ?? null });
});

adminRoutes.post("/academies/:id/review", async (c) => {
  const adminId = admin(c);
  const db = c.get("db");
  const { decision, note } = await body(c, academyReview);
  const [a] = await db.select().from(s.academies).where(eq(s.academies.id, c.req.param("id")));
  if (!a) fail(404, "academyNotFound");
  if (a.status !== "pending") fail(409, "alreadyReviewed");
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

/** Corrects an academy's details at any status (owners can only resubmit pending or rejected ones). */
adminRoutes.patch("/academies/:id", async (c) => {
  const db = c.get("db");
  const input = await body(c, academyEdit);
  const [updated] = await db
    .update(s.academies)
    // Optional fields left empty are cleared, not kept.
    .set({ ...input, affiliation: input.affiliation ?? null, postalCode: input.postalCode ?? null, email: input.email ?? null, website: input.website ?? null, instagram: input.instagram ?? null })
    .where(eq(s.academies.id, c.req.param("id")))
    .returning();
  if (!updated) fail(404, "academyNotFound");
  return c.json(updated);
});

/** Hands the academy to another account; the previous owner stays on as a coach. */
adminRoutes.post("/academies/:id/owner", async (c) => {
  const db = c.get("db");
  const { username } = await body(c, z.object({ username: usernameSchema }));
  const [a] = await db.select({ id: s.academies.id }).from(s.academies).where(eq(s.academies.id, c.req.param("id")));
  if (!a) fail(404, "academyNotFound");
  const [next] = await db.select({ id: s.profiles.userId }).from(s.profiles).where(eq(s.profiles.username, username));
  if (!next) fail(404, "userNotFound", username);
  await db.transaction(async (tx) => {
    await tx
      .update(s.academyMembers)
      .set({ role: "coach" })
      .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.role, "owner"), ne(s.academyMembers.userId, next.id)));
    await tx
      .insert(s.academyMembers)
      .values({ academyId: a.id, userId: next.id, role: "owner", status: "active" })
      .onConflictDoUpdate({ target: [s.academyMembers.academyId, s.academyMembers.userId], set: { role: "owner", status: "active" } });
  });
  return c.body(null, 204);
});

// ---------- Moderation (DSA notice and action) ----------

const person = {
  id: s.profiles.userId,
  name: s.profiles.name,
  username: s.profiles.username,
  avatarUrl: s.profiles.avatarUrl,
  suspended: suspended(s.profiles.userId).mapWith(Boolean),
};
type Person = { id: string; name: string; username: string; avatarUrl: string | null; suspended: boolean };

/** The reported content as the admin needs to judge it, and whose it is; null once it was deleted. */
async function reportTarget(db: Db, m: Messages, type: ReportTarget, id: string): Promise<{ title: string; body: string | null; owner: Person | null } | null> {
  if (type === "user") {
    const [p] = await db.select(person).from(s.profiles).where(eq(s.profiles.userId, id));
    return p ? { title: p.name, body: `@${p.username}`, owner: p } : null;
  }
  if (type === "session") {
    const [x] = await db
      .select({ kind: s.sessions.kind, title: s.sessions.title, notes: s.sessions.notes, owner: person })
      .from(s.sessions)
      .innerJoin(s.profiles, eq(s.profiles.userId, s.sessions.userId))
      .where(eq(s.sessions.id, id));
    return x ? { title: x.title || m.sessionTitle(m.sessionKind[x.kind]), body: x.notes, owner: x.owner } : null;
  }
  if (type === "comment") {
    const [x] = await db
      .select({ body: s.comments.body, owner: person })
      .from(s.comments)
      .innerJoin(s.profiles, eq(s.profiles.userId, s.comments.userId))
      .where(eq(s.comments.id, id));
    return x ? { title: m.reportTarget.comment, body: x.body, owner: x.owner } : null;
  }
  const [x] = await db.select({ name: s.academies.name, city: s.academies.city }).from(s.academies).where(eq(s.academies.id, id));
  if (!x) return null;
  const [owner] = await db
    .select(person)
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .where(and(eq(s.academyMembers.academyId, id), eq(s.academyMembers.role, "owner")));
  return { title: x.name, body: x.city, owner: owner ?? null };
}

/** Reports grouped by target (and, once resolved, by decision): several reports on one profile are one case. */
adminRoutes.get("/reports", async (c) => {
  const db = c.get("db");
  const status = z.enum(["open", "resolved"]).catch("open").parse(c.req.query("status"));
  const groups = await db
    .select({
      targetType: s.reports.targetType,
      targetId: s.reports.targetId,
      resolvedAt: s.reports.resolvedAt,
      count: sql<number>`count(*)::int`,
      firstAt: sql<string>`min(${s.reports.createdAt})`,
      reasons: sql<string[]>`array_agg(${s.reports.reason} order by ${s.reports.createdAt})`,
      action: sql<string | null>`max(${s.reports.action})`,
      note: sql<string | null>`max(${s.reports.note})`,
    })
    .from(s.reports)
    .where(eq(s.reports.status, status))
    .groupBy(s.reports.targetType, s.reports.targetId, s.reports.resolvedAt)
    // Oldest first in the queue; most recent decisions first in the history.
    .orderBy(status === "open" ? sql`min(${s.reports.createdAt})` : desc(s.reports.resolvedAt))
    .limit(50);
  const rows = await Promise.all(groups.map(async (g) => ({ ...g, target: await reportTarget(db, t(c), g.targetType as ReportTarget, g.targetId) })));
  return c.json(rows);
});

/** Decides every open report on one target at once, tells the reporters, and tells the owner when something of theirs was removed. */
adminRoutes.post("/reports/resolve", async (c) => {
  const adminId = admin(c);
  const db = c.get("db");
  const { targetType, targetId, action, note } = await body(c, reportResolution);
  const open = await db
    .select({ id: s.reports.id, reporterId: s.reports.reporterId })
    .from(s.reports)
    .where(and(eq(s.reports.targetType, targetType), eq(s.reports.targetId, targetId), eq(s.reports.status, "open")));
  if (!open.length) fail(409, "noOpenReports");
  const target = await reportTarget(db, t(c), targetType, targetId);
  if (action !== "dismiss" && !target) fail(409, "contentGone");
  const ownerId = target?.owner?.id ?? null;
  if ((action === "suspend" || action === "remove_avatar") && !ownerId) fail(409, "noOwnerAccount");
  if (action === "suspend" && (await adminIds(c)).includes(ownerId!)) fail(409, "cannotSuspendAdmin");

  if (action === "remove") {
    if (targetType === "session") await db.delete(s.sessions).where(eq(s.sessions.id, targetId));
    if (targetType === "comment") await db.delete(s.comments).where(eq(s.comments.id, targetId));
    if (targetType === "academy") {
      await db.update(s.academies).set({ status: "rejected", reviewNote: note, reviewedBy: adminId, reviewedAt: new Date() }).where(eq(s.academies.id, targetId));
    }
  }
  if (action === "remove_avatar") await removeAvatar(db, ownerId!);
  if (action === "suspend") await suspendUser(db, ownerId!, note!);

  await db
    .update(s.reports)
    .set({ status: "resolved", action, note: note || null, resolvedBy: adminId, resolvedAt: new Date() })
    .where(inArray(s.reports.id, open.map((r) => r.id)));
  await notify(db, "report_resolved", adminId, open.flatMap((r) => (r.reporterId ? [r.reporterId] : [])));
  if (ownerId && (action === "remove" || action === "remove_avatar")) {
    // A rejected academy shows its owner the note; other removals point to the terms.
    if (targetType === "academy") await notify(db, "academy_rejected", adminId, [ownerId], targetId);
    else await notify(db, "content_removed", adminId, [ownerId]);
  }
  return c.body(null, 204);
});

// ---------- Accounts ----------

/** Newest accounts, or a search by e-mail, username or name (accounts without a profile included). */
adminRoutes.get("/users", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await c
    .get("db")
    .select({
      id: s.user.id,
      email: s.user.email,
      name: sql<string>`coalesce(${s.profiles.name}, ${s.user.name})`,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      createdAt: s.user.createdAt,
      suspendedAt: s.user.suspendedAt,
    })
    .from(s.user)
    .leftJoin(s.profiles, eq(s.profiles.userId, s.user.id))
    .where(q ? or(ilike(s.user.email, pattern), ilike(s.profiles.username, pattern), ilike(s.profiles.name, pattern)) : undefined)
    .orderBy(desc(s.user.createdAt))
    .limit(30);
  return c.json(rows);
});

adminRoutes.get("/users/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [u] = await db
    .select({
      id: s.user.id,
      email: s.user.email,
      createdAt: s.user.createdAt,
      suspendedAt: s.user.suspendedAt,
      suspensionReason: s.user.suspensionReason,
      sessions: sql<number>`(select count(*)::int from sessions x where x.user_id = ${id})`,
      followers: sql<number>`(select count(*)::int from follows f where f.followee_id = ${id})`,
      reports: sql<number>`(select count(*)::int from reports r where r.target_type = 'user' and r.target_id = ${id})`,
    })
    .from(s.user)
    .where(eq(s.user.id, id));
  if (!u) fail(404, "accountNotFound");
  const [profile] = await db
    .select({ name: s.profiles.name, username: s.profiles.username, avatarUrl: s.profiles.avatarUrl, belt: s.profiles.belt, stripes: s.profiles.stripes, birthYear: s.profiles.birthYear })
    .from(s.profiles)
    .where(eq(s.profiles.userId, id));
  const memberships = await db
    .select({ id: s.academies.id, name: s.academies.name, role: s.academyMembers.role, status: s.academyMembers.status })
    .from(s.academyMembers)
    .innerJoin(s.academies, eq(s.academies.id, s.academyMembers.academyId))
    .where(eq(s.academyMembers.userId, id));
  return c.json({
    ...u,
    isAdmin: (await adminIds(c)).includes(id),
    profile: profile ? { ...profile, minor: isMinor(profile.birthYear) } : null,
    memberships,
  });
});

adminRoutes.post("/users/:id/suspend", async (c) => {
  const db = c.get("db");
  const { reason } = await body(c, suspensionInput);
  const id = c.req.param("id");
  const [u] = await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.id, id));
  if (!u) fail(404, "accountNotFound");
  if ((await adminIds(c)).includes(id)) fail(409, "cannotSuspendAdmin");
  await suspendUser(db, id, reason);
  return c.body(null, 204);
});

adminRoutes.delete("/users/:id/suspend", async (c) => {
  await unsuspendUser(c.get("db"), c.req.param("id"));
  return c.body(null, 204);
});

adminRoutes.delete("/users/:id/avatar", async (c) => {
  const adminId = admin(c);
  const db = c.get("db");
  const id = c.req.param("id");
  await removeAvatar(db, id);
  await notify(db, "content_removed", adminId, [id]);
  return c.body(null, 204);
});

// ---------- Feature flags ----------

adminRoutes.get("/flags", async (c) => {
  const db = c.get("db");
  const flags = await db.select().from(s.featureFlags).orderBy(asc(s.featureFlags.key));
  const ids = [...new Set(flags.flatMap((f) => f.userIds))];
  const names = ids.length
    ? new Map((await db.select({ id: s.profiles.userId, username: s.profiles.username }).from(s.profiles).where(inArray(s.profiles.userId, ids))).map((p) => [p.id, p.username]))
    : new Map<string, string>();
  // Accounts deleted since are dropped from the list.
  return c.json(flags.map((f) => ({ key: f.key, enabledForAll: f.enabledForAll, usernames: f.userIds.flatMap((id) => names.get(id) ?? []) })));
});

adminRoutes.put("/flags/:key", async (c) => {
  const db = c.get("db");
  const key = c.req.param("key");
  if (!FLAG_KEY.test(key)) fail(400, "invalidFlagKey");
  const { enabledForAll, usernames } = await body(c, featureFlagInput);
  const found = usernames.length
    ? await db.select({ id: s.profiles.userId, username: s.profiles.username }).from(s.profiles).where(inArray(s.profiles.username, usernames))
    : [];
  const missing = usernames.filter((u) => !found.some((f) => f.username === u));
  if (missing.length) fail(400, "usersNotFound", missing);
  const userIds = found.map((f) => f.id);
  await db
    .insert(s.featureFlags)
    .values({ key, enabledForAll, userIds })
    .onConflictDoUpdate({ target: s.featureFlags.key, set: { enabledForAll, userIds } });
  return c.body(null, 204);
});

adminRoutes.delete("/flags/:key", async (c) => {
  await c.get("db").delete(s.featureFlags).where(eq(s.featureFlags.key, c.req.param("key")));
  return c.body(null, 204);
});

// ---------- Numbers ----------

/** Headline counts and the last 8 weeks (Monday-based, UTC) of sign-ups and logged sessions. */
adminRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const days = (n: number) => sql.raw(`now() - interval '${n} days'`);
  const totals = await db.execute<Record<string, number>>(sql`select
    (select count(*)::int from "user") as users,
    (select count(*)::int from "user" where created_at > ${days(7)}) as "users7d",
    (select count(*)::int from "user" where created_at > ${days(30)}) as "users30d",
    (select count(distinct user_id)::int from sessions where started_at > ${days(7)}) as "active7d",
    (select count(distinct user_id)::int from sessions where started_at > ${days(30)}) as "active30d",
    (select count(*)::int from sessions where created_at > ${days(7)}) as "sessions7d",
    (select count(*)::int from sessions where created_at > ${days(30)}) as "sessions30d",
    (select count(*)::int from academies where status = 'approved') as academies,
    (select count(*)::int from "user" where suspended_at is not null) as suspended`);
  const weeks = await db.execute<{ week: string; signups: number; sessions: number }>(sql`select to_char(w, 'YYYY-MM-DD') as week,
      (select count(*)::int from "user" u where u.created_at >= w and u.created_at < w + interval '1 week') as signups,
      (select count(*)::int from sessions x where x.created_at >= w and x.created_at < w + interval '1 week') as sessions
    from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as w`);
  return c.json({ ...totals.rows[0], weeks: weeks.rows });
});
