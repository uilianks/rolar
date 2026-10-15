import type { Db } from "./db/client";
import { notifications } from "./db/schema";

export type NotificationType =
  | "oss"
  | "comment"
  | "follow"
  | "membership_request"
  | "membership_approved"
  | "promotion_request"
  | "promotion_confirmed"
  | "academy_submitted"
  | "academy_approved"
  | "academy_rejected"
  | "attendance_confirmed"
  | "class_cancelled"
  | "event_published"
  | "announcement"
  | "payment_reminder";

/** Records one notification per recipient, skipping the actor themself. */
export async function notify(
  db: Db,
  type: NotificationType,
  actorId: string,
  recipients: string[],
  targetId: string | null = null,
) {
  const rows = [...new Set(recipients)].filter((r) => r !== actorId).map((userId) => ({ userId, actorId, type, targetId }));
  if (rows.length) await db.insert(notifications).values(rows);
}
