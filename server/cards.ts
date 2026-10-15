// The "session card" shape used by the feed, profiles and the session page.
import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";

import type { Db } from "./db/client";
import { academies, profiles, sessions } from "./db/schema";
import { sessionVisibleTo } from "./policies";

export const PAGE_SIZE = 20;

export function sessionCards(db: Db, viewerId: string) {
  return db
    .select({
      id: sessions.id,
      kind: sessions.kind,
      startedAt: sessions.startedAt,
      durationMin: sessions.durationMin,
      rounds: sessions.rounds,
      rpe: sessions.rpe,
      title: sessions.title,
      notes: sessions.notes,
      techniques: sessions.techniques,
      visibility: sessions.visibility,
      source: sessions.source,
      academy: { id: academies.id, name: academies.name, slug: academies.slug },
      author: {
        id: profiles.userId,
        name: profiles.name,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
        belt: profiles.belt,
        stripes: profiles.stripes,
      },
      ossCount: sql<number>`(select count(*)::int from reactions r where r.session_id = ${sessions.id})`,
      commentCount: sql<number>`(select count(*)::int from comments c where c.session_id = ${sessions.id})`,
      ossed: sql<boolean>`exists (select 1 from reactions r where r.session_id = ${sessions.id} and r.user_id = ${viewerId})`,
    })
    .from(sessions)
    .innerJoin(profiles, eq(profiles.userId, sessions.userId))
    .leftJoin(academies, eq(academies.id, sessions.academyId))
    .$dynamic();
}

export type SessionCard = Awaited<ReturnType<ReturnType<typeof sessionCards>["execute"]>>[number];

/** Cursor = "<startedAt ISO>|<id>", newest first. */
export function cursorCondition(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const [at, id] = cursor.split("|");
  const date = new Date(at);
  if (!id || Number.isNaN(date.getTime())) return undefined;
  return or(lt(sessions.startedAt, date), and(eq(sessions.startedAt, date), lt(sessions.id, id)));
}

export async function pageOfCards(db: Db, viewerId: string, where: SQL | undefined, cursor?: string) {
  const rows = await sessionCards(db, viewerId)
    .where(and(sessionVisibleTo(viewerId), where, cursorCondition(cursor)))
    .orderBy(desc(sessions.startedAt), desc(sessions.id))
    .limit(PAGE_SIZE + 1);
  const items = rows.slice(0, PAGE_SIZE).map(normalizeCard);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > PAGE_SIZE && last ? `${new Date(last.startedAt).toISOString()}|${last.id}` : null,
  };
}

/** Left joins yield an object of nulls; expose a missing academy as null. */
export function normalizeCard(card: SessionCard) {
  return { ...card, academy: card.academy?.id ? card.academy : null };
}
