import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";

import { TECHNIQUE_CATEGORIES, TECHNIQUE_POSITIONS, techniqueInput, techniqueNotesInput } from "../../src/shared/domain";
import * as s from "../db/schema";
import type { Db } from "../db/client";
import { type AppEnv, body, fail, isUniqueViolation, viewer } from "../http";
import { canManageTechnique, membership } from "../policies";
import { findAcademy } from "./academies";

/**
 * The technique catalog, read by everyone signed in. Two kinds: an approved academy's (its staff
 * write them) and the Rolar catalog (no academy; admins write it in Portuguese and English).
 */
export const techniquesRoutes = new Hono<AppEnv>();

/** Unknown filter values are ignored rather than rejected: the list is a search. */
const listQuery = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(TECHNIQUE_CATEGORIES).optional().catch(undefined),
  position: z.enum(TECHNIQUE_POSITIONS).optional().catch(undefined),
  academy: z.string().max(80).optional().catch(undefined),
  /** `mine`: the academies the viewer is an active member of; `rolar`: the app's own catalog. */
  scope: z.enum(["mine", "rolar"]).optional().catch(undefined),
});

const academyRef = { id: s.academies.id, name: s.academies.name, slug: s.academies.slug };

/** Rolar techniques, and those of approved academies. */
const visible = or(isNull(s.techniques.academyId), eq(s.academies.status, "approved"))!;

/** The academy's own catalog, or Rolar's when `academyId` is null. */
const sameCatalog = (academyId: string | null) => (academyId ? eq(s.techniques.academyId, academyId) : isNull(s.techniques.academyId));

const memberOf = (userId: string, academy: SQL | typeof s.techniques.academyId) =>
  sql`exists (select 1 from academy_members m where m.user_id = ${userId} and m.academy_id = ${academy} and m.status = 'active')`;

/** Name and description in the request's language (Rolar techniques have English versions). */
function localized(c: Context<AppEnv>) {
  const en = c.get("locale") === "en";
  return {
    name: en ? sql<string>`coalesce(${s.techniques.nameEn}, ${s.techniques.name})` : s.techniques.name,
    description: en ? sql<string>`coalesce(${s.techniques.descriptionEn}, ${s.techniques.description})` : s.techniques.description,
  };
}

/** `academy` is null for Rolar techniques (the left join leaves its columns null). */
const withAcademy = <T extends { academy: { id: string | null; name: string | null; slug: string | null } | null }>(r: T) => ({
  ...r,
  academy: r.academy?.id ? (r.academy as { id: string; name: string; slug: string }) : null,
});

techniquesRoutes.get("/techniques", async (c) => {
  const userId = viewer(c);
  const { q, category, position, academy, scope } = listQuery.parse(c.req.query());
  const where: (SQL | undefined)[] = [visible];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(sql`concat_ws(' ', ${s.techniques.name}, ${s.techniques.nameEn}, array_to_string(${s.techniques.aliases}, ' ')) ilike ${like}`);
  }
  if (category) where.push(eq(s.techniques.category, category));
  if (position) where.push(eq(s.techniques.position, position));
  if (academy) where.push(eq(s.techniques.academyId, academy));
  if (scope === "rolar") where.push(isNull(s.techniques.academyId));
  if (scope === "mine") where.push(memberOf(userId, s.techniques.academyId));
  const { name } = localized(c);
  const rows = await c
    .get("db")
    .select({
      id: s.techniques.id,
      name,
      aliases: s.techniques.aliases,
      category: s.techniques.category,
      position: s.techniques.position,
      academy: academyRef,
      /** The viewer marked it as known (so the list can toggle it in place). */
      known: sql<boolean>`exists (select 1 from known_techniques k where k.user_id = ${userId} and k.technique_id = ${s.techniques.id})`,
    })
    .from(s.techniques)
    .leftJoin(s.academies, eq(s.academies.id, s.techniques.academyId))
    .where(and(...where))
    .orderBy(asc(sql`lower(${name})`))
    .limit(200);
  return c.json(rows.map(withAcademy));
});

/** The techniques matching `where` (visible ones only) and the "leads to" links among them. */
async function graph(c: Context<AppEnv>, where: SQL) {
  const db = c.get("db");
  const nodes = await db
    .select({ id: s.techniques.id, name: localized(c).name, category: s.techniques.category, position: s.techniques.position })
    .from(s.techniques)
    .leftJoin(s.academies, eq(s.academies.id, s.techniques.academyId))
    .where(and(where, visible));
  const ids = nodes.map((n) => n.id);
  const links = ids.length
    ? await db
        .select({ from: s.techniqueLinks.fromId, to: s.techniqueLinks.toId })
        .from(s.techniqueLinks)
        .where(and(inArray(s.techniqueLinks.fromId, ids), inArray(s.techniqueLinks.toId, ids)))
    : [];
  return { nodes, links };
}

/** An academy's map (`?academy=`), or the Rolar catalog's (`?scope=rolar`). */
techniquesRoutes.get("/techniques/graph", async (c) => {
  viewer(c);
  const rolar = c.req.query("scope") === "rolar";
  return c.json(await graph(c, rolar ? isNull(s.techniques.academyId) : eq(s.techniques.academyId, c.req.query("academy") ?? "")));
});

/** True when session word `w` names the technique aliased `t` (its name, English name or another name). */
const names = (t: string, w: string) =>
  sql.raw(`(lower(trim(${w})) = lower(${t}.name) or lower(trim(${w})) = lower(${t}.name_en)
    or lower(trim(${w})) in (select lower(a) from unnest(${t}.aliases) a))`);

/**
 * Techniques the viewer marked as known, plus the ones they wrote in a session they logged: from
 * their academies, or from the Rolar catalog when none of their academies has a technique by that
 * name (the academy's version wins). Private: only ever the viewer's own map.
 */
function knownBy(userId: string): SQL {
  return or(
    sql`exists (select 1 from known_techniques k where k.user_id = ${userId} and k.technique_id = ${s.techniques.id})`,
    sql`exists (select 1 from sessions x, unnest(x.techniques) w where x.user_id = ${userId} and ${names('"techniques"', "w")}
      and (
        (${s.techniques.academyId} is not null and ${memberOf(userId, s.techniques.academyId)})
        or (${s.techniques.academyId} is null and not exists (
          select 1 from techniques o where o.academy_id is not null and ${memberOf(userId, sql`o.academy_id`)} and ${names("o", "w")}))
      ))`,
  )!;
}

techniquesRoutes.get("/techniques/known", async (c) => c.json(await graph(c, knownBy(viewer(c)))));

/** A visible technique, or 404. */
async function findTechnique(c: Context<AppEnv>, id: string) {
  const { name, description } = localized(c);
  const [row] = await c
    .get("db")
    .select({
      id: s.techniques.id,
      name,
      aliases: s.techniques.aliases,
      category: s.techniques.category,
      position: s.techniques.position,
      description,
      // The stored texts, for the edit form (the fields above are in the request's language).
      source: { name: s.techniques.name, nameEn: s.techniques.nameEn, description: s.techniques.description, descriptionEn: s.techniques.descriptionEn },
      updatedAt: s.techniques.updatedAt,
      academy: academyRef,
      author: { id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username },
    })
    .from(s.techniques)
    .leftJoin(s.academies, eq(s.academies.id, s.techniques.academyId))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.techniques.authorId))
    .where(and(eq(s.techniques.id, id), visible));
  if (!row) fail(404, "techniqueNotFound");
  const ref = { id: s.techniques.id, name, category: s.techniques.category };
  const [leadsTo, comesFrom] = await Promise.all([
    c.get("db").select(ref).from(s.techniqueLinks).innerJoin(s.techniques, eq(s.techniques.id, s.techniqueLinks.toId)).where(eq(s.techniqueLinks.fromId, id)),
    c.get("db").select(ref).from(s.techniqueLinks).innerJoin(s.techniques, eq(s.techniques.id, s.techniqueLinks.fromId)).where(eq(s.techniqueLinks.toId, id)),
  ]);
  return { ...withAcademy(row), author: row.author?.id ? row.author : null, leadsTo, comesFrom };
}

/** Staff of its academy, or an admin; only admins for the Rolar catalog. */
async function canManage(c: Context<AppEnv>, academyId: string | null) {
  return canManageTechnique(academyId ? await membership(c.get("db"), academyId, viewer(c)) : null, c.get("isAdmin"));
}

async function requireTechniqueManager(c: Context<AppEnv>, id: string) {
  const tq = await findTechnique(c, id);
  if (!(await canManage(c, tq.academy?.id ?? null))) fail(403, tq.academy ? "academyCoachesOnly" : "adminsOnly");
  return tq;
}

techniquesRoutes.get("/techniques/:id", async (c) => {
  const { source, ...tq } = await findTechnique(c, c.req.param("id"));
  const db = c.get("db");
  const [canEdit, [known], [notes]] = await Promise.all([
    canManage(c, tq.academy?.id ?? null),
    db
      .select({ id: s.knownTechniques.techniqueId })
      .from(s.knownTechniques)
      .where(and(eq(s.knownTechniques.userId, viewer(c)), eq(s.knownTechniques.techniqueId, tq.id))),
    db
      .select({ body: s.techniqueNotes.body, updatedAt: s.techniqueNotes.updatedAt })
      .from(s.techniqueNotes)
      .where(and(eq(s.techniqueNotes.userId, viewer(c)), eq(s.techniqueNotes.techniqueId, tq.id))),
  ]);
  return c.json({ ...tq, canEdit, known: !!known, myNotes: notes ?? null, source: canEdit ? source : undefined });
});

/** Saves the viewer's notes on a technique they can see; empty notes remove the row. */
techniquesRoutes.put("/techniques/:id/notes", async (c) => {
  const tq = await findTechnique(c, c.req.param("id"));
  const { body: text } = await body(c, techniqueNotesInput);
  const db = c.get("db");
  if (!text) {
    await db.delete(s.techniqueNotes).where(and(eq(s.techniqueNotes.userId, viewer(c)), eq(s.techniqueNotes.techniqueId, tq.id)));
    return c.json(null);
  }
  const [row] = await db
    .insert(s.techniqueNotes)
    .values({ userId: viewer(c), techniqueId: tq.id, body: text })
    .onConflictDoUpdate({ target: [s.techniqueNotes.userId, s.techniqueNotes.techniqueId], set: { body: text, updatedAt: new Date() } })
    .returning({ body: s.techniqueNotes.body, updatedAt: s.techniqueNotes.updatedAt });
  return c.json(row);
});

techniquesRoutes.put("/techniques/:id/known", async (c) => {
  const tq = await findTechnique(c, c.req.param("id"));
  await c.get("db").insert(s.knownTechniques).values({ userId: viewer(c), techniqueId: tq.id }).onConflictDoNothing();
  return c.body(null, 204);
});

techniquesRoutes.delete("/techniques/:id/known", async (c) => {
  await c
    .get("db")
    .delete(s.knownTechniques)
    .where(and(eq(s.knownTechniques.userId, viewer(c)), eq(s.knownTechniques.techniqueId, c.req.param("id"))));
  return c.body(null, 204);
});

/** Replaces a technique's outgoing links; targets must be other techniques of the same catalog. */
async function setLinks(db: Pick<Db, "select" | "insert" | "delete">, academyId: string | null, fromId: string, leadsTo: string[]) {
  const targets = [...new Set(leadsTo)].filter((id) => id !== fromId);
  const found = targets.length
    ? await db.select({ id: s.techniques.id }).from(s.techniques).where(and(inArray(s.techniques.id, targets), sameCatalog(academyId)))
    : [];
  if (found.length !== targets.length) fail(400, "techniqueLinkInvalid");
  await db.delete(s.techniqueLinks).where(eq(s.techniqueLinks.fromId, fromId));
  if (targets.length) await db.insert(s.techniqueLinks).values(targets.map((toId) => ({ fromId, toId })));
}

async function create(c: Context<AppEnv>, academyId: string | null) {
  const { leadsTo, ...input } = await body(c, techniqueInput);
  try {
    const row = await c.get("db").transaction(async (tx) => {
      const [created] = await tx.insert(s.techniques).values({ ...input, academyId, authorId: viewer(c) }).returning({ id: s.techniques.id });
      await setLinks(tx, academyId, created.id, leadsTo);
      return created;
    });
    return c.json(row, 201);
  } catch (e) {
    if (isUniqueViolation(e)) fail(409, "techniqueExists");
    throw e;
  }
}

/** Staff add techniques to their academy; admins to any approved one (from the admin panel). */
techniquesRoutes.post("/academies/:id/techniques", async (c) => {
  const a = await findAcademy(c, c.req.param("id"));
  if (a.status !== "approved") fail(404, "academyNotFound");
  if (!(await canManage(c, a.id))) fail(403, "academyCoachesOnly");
  return create(c, a.id);
});

/** The Rolar catalog: admins only. */
techniquesRoutes.post("/techniques", async (c) => {
  viewer(c);
  if (!c.get("isAdmin")) fail(403, "adminsOnly");
  return create(c, null);
});

techniquesRoutes.put("/techniques/:id", async (c) => {
  const tq = await requireTechniqueManager(c, c.req.param("id"));
  const { leadsTo, ...input } = await body(c, techniqueInput);
  try {
    await c.get("db").transaction(async (tx) => {
      await tx.update(s.techniques).set({ ...input, updatedAt: new Date() }).where(eq(s.techniques.id, tq.id));
      await setLinks(tx, tq.academy?.id ?? null, tq.id, leadsTo);
    });
  } catch (e) {
    if (isUniqueViolation(e)) fail(409, "techniqueExists");
    throw e;
  }
  return c.body(null, 204);
});

techniquesRoutes.delete("/techniques/:id", async (c) => {
  const tq = await requireTechniqueManager(c, c.req.param("id"));
  await c.get("db").delete(s.techniques).where(eq(s.techniques.id, tq.id));
  return c.body(null, 204);
});
