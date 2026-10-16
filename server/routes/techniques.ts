import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";

import { TECHNIQUE_CATEGORIES, TECHNIQUE_POSITIONS, techniqueInput } from "../../src/shared/domain";
import * as s from "../db/schema";
import type { Db } from "../db/client";
import { type AppEnv, body, fail, isUniqueViolation, viewer } from "../http";
import { canManageTechnique, membership } from "../policies";
import { requireStaff } from "./academies";

/** The technique catalog: academy staff write it, everyone signed in reads it (approved academies only). */
export const techniquesRoutes = new Hono<AppEnv>();

/** Unknown filter values are ignored rather than rejected: the list is a search. */
const listQuery = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(TECHNIQUE_CATEGORIES).optional().catch(undefined),
  position: z.enum(TECHNIQUE_POSITIONS).optional().catch(undefined),
  academy: z.string().max(80).optional().catch(undefined),
});

const academyRef = { id: s.academies.id, name: s.academies.name, slug: s.academies.slug };

techniquesRoutes.get("/techniques", async (c) => {
  const userId = viewer(c);
  const { q, category, position, academy } = listQuery.parse(c.req.query());
  const where: (SQL | undefined)[] = [eq(s.academies.status, "approved")];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(or(ilike(s.techniques.name, like), sql`array_to_string(${s.techniques.aliases}, ' ') ilike ${like}`));
  }
  if (category) where.push(eq(s.techniques.category, category));
  if (position) where.push(eq(s.techniques.position, position));
  if (academy) where.push(eq(s.techniques.academyId, academy));
  const rows = await c
    .get("db")
    .select({
      id: s.techniques.id,
      name: s.techniques.name,
      aliases: s.techniques.aliases,
      category: s.techniques.category,
      position: s.techniques.position,
      academy: academyRef,
      /** The viewer marked it as known (so the list can toggle it in place). */
      known: sql<boolean>`exists (select 1 from known_techniques k where k.user_id = ${userId} and k.technique_id = ${s.techniques.id})`,
    })
    .from(s.techniques)
    .innerJoin(s.academies, eq(s.academies.id, s.techniques.academyId))
    .where(and(...where))
    .orderBy(asc(sql`lower(${s.techniques.name})`))
    .limit(200);
  return c.json(rows);
});

/** The techniques matching `where` (approved academies only) and the "leads to" links among them. */
async function graph(db: Db, where: SQL) {
  const nodes = await db
    .select({ id: s.techniques.id, name: s.techniques.name, category: s.techniques.category, position: s.techniques.position })
    .from(s.techniques)
    .innerJoin(s.academies, eq(s.academies.id, s.techniques.academyId))
    .where(and(where, eq(s.academies.status, "approved")));
  const ids = nodes.map((n) => n.id);
  const links = ids.length
    ? await db
        .select({ from: s.techniqueLinks.fromId, to: s.techniqueLinks.toId })
        .from(s.techniqueLinks)
        .where(and(inArray(s.techniqueLinks.fromId, ids), inArray(s.techniqueLinks.toId, ids)))
    : [];
  return { nodes, links };
}

/** Every technique of an academy, for its map. */
techniquesRoutes.get("/techniques/graph", async (c) => {
  viewer(c);
  return c.json(await graph(c.get("db"), eq(s.techniques.academyId, c.req.query("academy") ?? "")));
});

/**
 * Techniques the viewer marked as known, plus those of their academies whose name or other name
 * they wrote in a session they logged. Private: only ever the viewer's own map.
 */
function knownBy(userId: string): SQL {
  return or(
    sql`exists (select 1 from known_techniques k where k.user_id = ${userId} and k.technique_id = ${s.techniques.id})`,
    sql`exists (select 1 from academy_members m where m.user_id = ${userId} and m.academy_id = ${s.techniques.academyId} and m.status = 'active')
      and exists (select 1 from sessions x, unnest(x.techniques) w where x.user_id = ${userId}
        and (lower(trim(w)) = lower(${s.techniques.name}) or lower(trim(w)) in (select lower(a) from unnest(${s.techniques.aliases}) a)))`,
  )!;
}

techniquesRoutes.get("/techniques/known", async (c) => c.json(await graph(c.get("db"), knownBy(viewer(c)))));

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

/** A technique of an approved academy, or 404. */
async function findTechnique(c: Context<AppEnv>, id: string) {
  const [row] = await c
    .get("db")
    .select({
      id: s.techniques.id,
      name: s.techniques.name,
      aliases: s.techniques.aliases,
      category: s.techniques.category,
      position: s.techniques.position,
      description: s.techniques.description,
      updatedAt: s.techniques.updatedAt,
      academy: academyRef,
      author: { id: s.profiles.userId, name: s.profiles.name, username: s.profiles.username },
    })
    .from(s.techniques)
    .innerJoin(s.academies, eq(s.academies.id, s.techniques.academyId))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.techniques.authorId))
    .where(and(eq(s.techniques.id, id), eq(s.academies.status, "approved")));
  if (!row) fail(404, "techniqueNotFound");
  const ref = { id: s.techniques.id, name: s.techniques.name, category: s.techniques.category };
  const [leadsTo, comesFrom] = await Promise.all([
    c.get("db").select(ref).from(s.techniqueLinks).innerJoin(s.techniques, eq(s.techniques.id, s.techniqueLinks.toId)).where(eq(s.techniqueLinks.fromId, id)),
    c.get("db").select(ref).from(s.techniqueLinks).innerJoin(s.techniques, eq(s.techniques.id, s.techniqueLinks.fromId)).where(eq(s.techniqueLinks.toId, id)),
  ]);
  return { ...row, author: row.author?.id ? row.author : null, leadsTo, comesFrom };
}

async function requireTechniqueManager(c: Context<AppEnv>, id: string) {
  const tq = await findTechnique(c, id);
  if (!canManageTechnique(await membership(c.get("db"), tq.academy.id, viewer(c)), c.get("isAdmin"))) fail(403, "academyCoachesOnly");
  return tq;
}

techniquesRoutes.get("/techniques/:id", async (c) => {
  const tq = await findTechnique(c, c.req.param("id"));
  const db = c.get("db");
  const userId = viewer(c);
  const [canEdit, [known]] = await Promise.all([
    membership(db, tq.academy.id, userId).then((m) => canManageTechnique(m, c.get("isAdmin"))),
    db.select({ id: s.knownTechniques.techniqueId }).from(s.knownTechniques).where(and(eq(s.knownTechniques.userId, userId), eq(s.knownTechniques.techniqueId, tq.id))),
  ]);
  return c.json({ ...tq, canEdit, known: !!known });
});

/** Replaces a technique's outgoing links; targets must be other techniques of the same academy. */
async function setLinks(db: Pick<Db, "select" | "insert" | "delete">, academyId: string, fromId: string, leadsTo: string[]) {
  const targets = [...new Set(leadsTo)].filter((id) => id !== fromId);
  const found = targets.length
    ? await db.select({ id: s.techniques.id }).from(s.techniques).where(and(inArray(s.techniques.id, targets), eq(s.techniques.academyId, academyId)))
    : [];
  if (found.length !== targets.length) fail(400, "techniqueLinkInvalid");
  await db.delete(s.techniqueLinks).where(eq(s.techniqueLinks.fromId, fromId));
  if (targets.length) await db.insert(s.techniqueLinks).values(targets.map((toId) => ({ fromId, toId })));
}

techniquesRoutes.post("/academies/:id/techniques", async (c) => {
  const { a } = await requireStaff(c, c.req.param("id"));
  const { leadsTo, ...input } = await body(c, techniqueInput);
  try {
    const row = await c.get("db").transaction(async (tx) => {
      const [created] = await tx.insert(s.techniques).values({ ...input, academyId: a.id, authorId: viewer(c) }).returning({ id: s.techniques.id });
      await setLinks(tx, a.id, created.id, leadsTo);
      return created;
    });
    return c.json(row, 201);
  } catch (e) {
    if (isUniqueViolation(e)) fail(409, "techniqueExists");
    throw e;
  }
});

techniquesRoutes.put("/techniques/:id", async (c) => {
  const tq = await requireTechniqueManager(c, c.req.param("id"));
  const { leadsTo, ...input } = await body(c, techniqueInput);
  try {
    await c.get("db").transaction(async (tx) => {
      await tx.update(s.techniques).set({ ...input, updatedAt: new Date() }).where(eq(s.techniques.id, tq.id));
      await setLinks(tx, tq.academy.id, tq.id, leadsTo);
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
