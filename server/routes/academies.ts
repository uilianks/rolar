import { and, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { ACADEMY_ROLES, academyInput, BELTS } from "../../src/shared/domain";
import type { Db } from "../db/client";
import * as s from "../db/schema";
import { type AppEnv, body, fail, isUniqueViolation, viewer } from "../http";
import type { Context } from "hono";
import { notify } from "../notify";
import { canManageBilling, isActiveStaff, membership } from "../policies";

export const academiesRoutes = new Hono<AppEnv>();

export function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "academia"
  );
}

const memberCount = sql<number>`(select count(*)::int from academy_members m where m.academy_id = ${s.academies.id} and m.status = 'active')`;

export async function staffIds(db: Db, academyId: string) {
  const rows = await db
    .select({ id: s.academyMembers.userId })
    .from(s.academyMembers)
    .where(and(eq(s.academyMembers.academyId, academyId), eq(s.academyMembers.status, "active"), sql`${s.academyMembers.role} in ('owner','coach')`));
  return rows.map((r) => r.id);
}

/** Public fields; contact channels are shown once the academy is approved. */
const publicColumns = {
  id: s.academies.id,
  name: s.academies.name,
  slug: s.academies.slug,
  affiliation: s.academies.affiliation,
  address: s.academies.address,
  city: s.academies.city,
  country: s.academies.country,
  website: s.academies.website,
  instagram: s.academies.instagram,
  status: s.academies.status,
  memberCount,
};

/**
 * Approved academies are visible to everyone; one under review (or rejected) only to its members
 * and admins, so an unverified academy cannot gather members or show up anywhere.
 */
export async function findAcademy(c: Context<AppEnv>, idOrSlug: string) {
  const db = c.get("db");
  const [a] = await db.select(publicColumns).from(s.academies).where(or(eq(s.academies.id, idOrSlug), eq(s.academies.slug, idOrSlug)));
  if (!a) fail(404, "Academia não encontrada");
  if (a.status !== "approved" && !c.get("isAdmin") && !(await membership(db, a.id, viewer(c)))) fail(404, "Academia não encontrada");
  return a;
}

/** The academy and the viewer's membership, which must be active. */
export async function requireMember(c: Context<AppEnv>, idOrSlug: string) {
  const a = await findAcademy(c, idOrSlug);
  const m = await membership(c.get("db"), a.id, viewer(c));
  if (m?.status !== "active" || a.status !== "approved") fail(403, "Só membros da academia");
  return { a, m: m! };
}

export async function requireStaff(c: Context<AppEnv>, idOrSlug: string) {
  const r = await requireMember(c, idOrSlug);
  if (!isActiveStaff(r.m)) fail(403, "Só professores da academia");
  return r;
}

/** Billing is the owner's business only. */
export async function requireBillingManager(c: Context<AppEnv>, idOrSlug: string) {
  const r = await requireMember(c, idOrSlug);
  if (!canManageBilling(r.m)) fail(403, "Só o responsável da academia");
  return r;
}

export async function activeMemberIds(db: Db, academyId: string) {
  const rows = await db
    .select({ id: s.academyMembers.userId })
    .from(s.academyMembers)
    .where(and(eq(s.academyMembers.academyId, academyId), eq(s.academyMembers.status, "active")));
  return rows.map((r) => r.id);
}

export async function adminIds(c: Context<AppEnv>) {
  const emails = c.get("adminEmails");
  if (!emails.length) return [];
  const rows = await c.get("db").select({ id: s.user.id }).from(s.user).where(inArray(sql`lower(${s.user.email})`, emails));
  return rows.map((r) => r.id);
}

academiesRoutes.get("/academies", async (c) => {
  viewer(c);
  const q = (c.req.query("q") ?? "").trim();
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await c
    .get("db")
    .select({ id: s.academies.id, name: s.academies.name, slug: s.academies.slug, city: s.academies.city, country: s.academies.country, memberCount })
    .from(s.academies)
    .where(and(eq(s.academies.status, "approved"), q ? or(ilike(s.academies.name, pattern), ilike(s.academies.city, pattern)) : undefined))
    .orderBy(desc(memberCount))
    .limit(20);
  return c.json(rows);
});

/**
 * Registers an academy for review. The requester is its owner from the start (so they can follow the
 * review), but the academy stays hidden and closed to members until an admin approves it.
 */
academiesRoutes.post("/academies", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const input = await body(c, academyInput);
  const [open] = await db
    .select({ id: s.academies.id })
    .from(s.academies)
    .where(and(eq(s.academies.createdBy, userId), ne(s.academies.status, "approved")));
  if (open) fail(409, "Você já tem uma academia em análise ou recusada; corrija-a em vez de criar outra");
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const [a] = await db.insert(s.academies).values({ ...input, slug, createdBy: userId }).returning();
      await db.insert(s.academyMembers).values({ academyId: a.id, userId, role: "owner", status: "active" });
      await notify(db, "academy_submitted", userId, await adminIds(c), a.id);
      return c.json(a, 201);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  fail(409, "Não foi possível gerar um endereço para a academia");
});

/** The owner corrects a pending or rejected registration; it goes back to the review queue. */
academiesRoutes.put("/academies/:id", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const input = await body(c, academyInput);
  const a = await findAcademy(c, c.req.param("id"));
  if ((await membership(db, a.id, userId))?.role !== "owner") fail(403, "Só o responsável edita o cadastro");
  if (a.status === "approved") fail(409, "Academias aprovadas não podem ser alteradas por aqui; fale com o suporte");
  const [updated] = await db
    .update(s.academies)
    .set({ ...input, status: "pending", submittedAt: new Date(), reviewNote: null, reviewedBy: null, reviewedAt: null })
    .where(eq(s.academies.id, a.id))
    .returning();
  await notify(db, "academy_submitted", userId, await adminIds(c), a.id);
  return c.json(updated);
});

academiesRoutes.get("/academies/:id", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const a = await findAcademy(c, c.req.param("id"));
  const m = await membership(db, a.id, userId);
  // The owner also sees the registration itself, to follow the review and correct it.
  let registration = null;
  if (m?.role === "owner") {
    [registration] = await db
      .select({
        postalCode: s.academies.postalCode,
        phone: s.academies.phone,
        email: s.academies.email,
        requesterRole: s.academies.requesterRole,
        proof: s.academies.proof,
        submittedAt: s.academies.submittedAt,
        reviewNote: s.academies.reviewNote,
        reviewedAt: s.academies.reviewedAt,
      })
      .from(s.academies)
      .where(eq(s.academies.id, a.id));
  }
  return c.json({ ...a, membership: m ? { role: m.role, status: m.status } : null, registration });
});

academiesRoutes.post("/academies/:id/join", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const a = await findAcademy(c, c.req.param("id"));
  if (a.status !== "approved") fail(409, "A academia ainda está em verificação");
  const inserted = await db.insert(s.academyMembers).values({ academyId: a.id, userId }).onConflictDoNothing().returning();
  if (inserted.length) await notify(db, "membership_request", userId, await staffIds(db, a.id), a.id);
  return c.body(null, 204);
});

/** Members see the active list; staff also see pending requests. */
academiesRoutes.get("/academies/:id/members", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const a = await findAcademy(c, c.req.param("id"));
  const m = await membership(db, a.id, userId);
  if (m?.status !== "active") fail(403, "Só membros veem a lista");
  const rows = await db
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      belt: s.profiles.belt,
      stripes: s.profiles.stripes,
      role: s.academyMembers.role,
      status: s.academyMembers.status,
    })
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .where(and(eq(s.academyMembers.academyId, a.id), isActiveStaff(m) ? undefined : eq(s.academyMembers.status, "active")))
    .orderBy(sql`case ${s.academyMembers.role} when 'owner' then 0 when 'coach' then 1 else 2 end`, sql`array_position(array[${sql.raw(BELTS.map((b) => `'${b}'`).join(","))}]::belt[], ${s.profiles.belt}) desc`, s.profiles.name);
  if (!isActiveStaff(m)) return c.json(rows);
  // Staff also see how often each member was confirmed present in the last 30 days.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const counts = await db
    .select({ userId: s.attendance.userId, n: sql<number>`count(*)::int` })
    .from(s.attendance)
    .innerJoin(s.academyClasses, eq(s.academyClasses.id, s.attendance.classId))
    .where(and(eq(s.academyClasses.academyId, a.id), gte(s.attendance.date, since)))
    .groupBy(s.attendance.userId);
  const byUser = new Map(counts.map((r) => [r.userId, r.n]));
  return c.json(rows.map((r) => ({ ...r, attendance30d: byUser.get(r.id) ?? 0 })));
});

/** Staff approve requests; only the owner grants or removes staff roles. */
academiesRoutes.patch("/academies/:id/members/:userId", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const input = await body(c, z.object({ status: z.literal("active").optional(), role: z.enum(ACADEMY_ROLES).optional() }));
  const a = await findAcademy(c, c.req.param("id"));
  const actor = await membership(db, a.id, userId);
  const target = await membership(db, a.id, c.req.param("userId"));
  if (!isActiveStaff(actor)) fail(403, "Só professores podem fazer isso");
  if (!target) fail(404, "Membro não encontrado");
  if (input.role && actor!.role !== "owner") fail(403, "Só o responsável muda papéis");
  if (target.role === "owner" && target.userId !== userId) fail(403, "Não é possível alterar o responsável");
  await db
    .update(s.academyMembers)
    .set(input)
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.userId, target.userId)));
  if (input.status === "active" && target.status === "pending") {
    await db.update(s.profiles).set({ homeAcademyId: a.id }).where(and(eq(s.profiles.userId, target.userId), isNull(s.profiles.homeAcademyId)));
    await notify(db, "membership_approved", userId, [target.userId], a.id);
  }
  return c.body(null, 204);
});

/** Members leave; staff remove students (and rejected requests); nobody removes the owner. */
academiesRoutes.delete("/academies/:id/members/:userId", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const a = await findAcademy(c, c.req.param("id"));
  const targetId = c.req.param("userId");
  const target = await membership(db, a.id, targetId);
  if (!target) fail(404, "Membro não encontrado");
  if (target.role === "owner") fail(403, "O responsável não pode sair; transfira a academia antes");
  if (targetId !== userId) {
    const actor = await membership(db, a.id, userId);
    if (!isActiveStaff(actor) || (target.role === "coach" && actor!.role !== "owner")) fail(403, "Sem permissão");
  }
  await db.delete(s.academyMembers).where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.userId, targetId)));
  await db.update(s.profiles).set({ homeAcademyId: null }).where(and(eq(s.profiles.userId, targetId), eq(s.profiles.homeAcademyId, a.id)));
  return c.body(null, 204);
});

/** Sessions logged at this academy in the current month, by active members who show up in rankings. */
academiesRoutes.get("/academies/:id/ranking", async (c) => {
  const userId = viewer(c);
  const db = c.get("db");
  const a = await findAcademy(c, c.req.param("id"));
  if ((await membership(db, a.id, userId))?.status !== "active") fail(403, "Só membros veem o ranking");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      belt: s.profiles.belt,
      sessions: sql<number>`count(${s.sessions.id})::int`,
    })
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .innerJoin(s.sessions, and(eq(s.sessions.userId, s.academyMembers.userId), eq(s.sessions.academyId, a.id), gte(s.sessions.startedAt, monthStart)))
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.status, "active"), eq(s.profiles.showInRanking, true)))
    .groupBy(s.profiles.userId, s.profiles.name, s.profiles.username, s.profiles.belt)
    .orderBy(sql`count(${s.sessions.id}) desc`, s.profiles.name);
  return c.json(rows.map((r, i) => ({ ...r, rank: i + 1 })));
});
