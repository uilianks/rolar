// Access rules. Every route that reads or writes user content goes through these functions,
// so the rules live in one place (docs/03-dados.md) and the tests cover each one.
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { isMinor, type Visibility } from "../src/shared/domain";
import type { Db } from "./db/client";
import { academyMembers, profiles, sessions } from "./db/schema";

/** True when either user blocked the other. */
export function blockedBetween(viewerId: string, other: AnyPgColumn | string): SQL {
  return sql`exists (select 1 from blocks b where (b.blocker_id = ${viewerId} and b.blocked_id = ${other})
    or (b.blocker_id = ${other} and b.blocked_id = ${viewerId}))`;
}

/** True when an admin suspended the account: its content is hidden from everyone else. */
export function suspended(userId: AnyPgColumn | string): SQL {
  return sql`exists (select 1 from "user" u where u.id = ${userId} and u.suspended_at is not null)`;
}

export function follows(viewerId: string, owner: AnyPgColumn | string): SQL {
  return sql`exists (select 1 from follows f where f.follower_id = ${viewerId} and f.followee_id = ${owner})`;
}

/** Sessions the viewer may read: own; otherwise public, or followers-only when following; never across a block or from a suspended account. */
export function sessionVisibleTo(viewerId: string): SQL {
  return or(
    eq(sessions.userId, viewerId),
    and(
      sql`not ${blockedBetween(viewerId, sessions.userId)}`,
      sql`not ${suspended(sessions.userId)}`,
      or(
        eq(sessions.visibility, "public"),
        and(eq(sessions.visibility, "followers"), follows(viewerId, sessions.userId)),
      ),
    ),
  )!;
}

/** Minors never publish publicly; everything else keeps the requested visibility. */
export function effectiveVisibility(requested: Visibility, birthYear: number): Visibility {
  return requested === "public" && isMinor(birthYear) ? "followers" : requested;
}

/** Adults can be followed by anyone they have not blocked; minors only by people from one of their academies. */
export async function canFollow(db: Db, viewerId: string, targetId: string) {
  if (viewerId === targetId) return false;
  const [target] = await db
    .select({
      birthYear: profiles.birthYear,
      blocked: sql<boolean>`${blockedBetween(viewerId, targetId)}`,
      sharedAcademy: sql<boolean>`exists (select 1 from academy_members a join academy_members b
        on a.academy_id = b.academy_id where a.user_id = ${viewerId} and b.user_id = ${targetId}
        and a.status = 'active' and b.status = 'active')`,
    })
    .from(profiles)
    .where(eq(profiles.userId, targetId));
  if (!target || target.blocked) return false;
  return !isMinor(target.birthYear) || target.sharedAcademy;
}

export async function membership(db: Db, academyId: string, userId: string) {
  const [m] = await db
    .select()
    .from(academyMembers)
    .where(and(eq(academyMembers.academyId, academyId), eq(academyMembers.userId, userId)));
  return m ?? null;
}

/** Minors keep initials: a photo would make them identifiable to strangers (their profile is not private by URL). */
export function canHaveAvatar(birthYear: number) {
  return !isMinor(birthYear);
}

export function isActiveStaff(m: { role: string; status: string } | null) {
  return !!m && m.status === "active" && (m.role === "owner" || m.role === "coach");
}

/** Billing (plans, payments, who is late) is visible to the owner only, not to coaches. */
export function canManageBilling(m: { role: string; status: string } | null) {
  return !!m && m.status === "active" && m.role === "owner";
}
