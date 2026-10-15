import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Db } from "./db/client";
import { notifications } from "./db/schema";

export type NotificationType =
  | "oss"
  | "comment"
  | "follow"
  | "membership_request"
  | "membership_approved"
  | "membership_rejected"
  | "membership_removed"
  | "coach_granted"
  | "coach_revoked"
  | "ownership_received"
  | "ownership_transferred"
  | "promotion_request"
  | "promotion_confirmed"
  | "academy_submitted"
  | "academy_approved"
  | "academy_rejected"
  | "attendance_confirmed"
  | "class_cancelled"
  | "class_restored"
  | "schedule_changed"
  | "event_published"
  | "event_changed"
  | "event_cancelled"
  | "event_result"
  | "announcement"
  | "payment_reminder"
  | "report_resolved"
  | "content_removed";

/**
 * Records one notification per recipient, skipping the actor themself. With `collapse`, recipients who still
 * have an unread one of the same type and target are skipped, so a burst of edits (setting up a timetable)
 * shows up once.
 */
export async function notify(
  db: Db,
  type: NotificationType,
  actorId: string,
  recipients: string[],
  targetId: string | null = null,
  { collapse = false } = {},
) {
  let ids = [...new Set(recipients)].filter((r) => r !== actorId);
  if (collapse && ids.length && targetId) {
    const unread = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(and(inArray(notifications.userId, ids), eq(notifications.type, type), eq(notifications.targetId, targetId), isNull(notifications.readAt)));
    const skip = new Set(unread.map((r) => r.userId));
    ids = ids.filter((r) => !skip.has(r));
  }
  if (ids.length) await db.insert(notifications).values(ids.map((userId) => ({ userId, actorId, type, targetId })));
}
