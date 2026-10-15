// Admin actions on accounts, shared by the moderation queue (reports) and the user pages.
import { eq } from "drizzle-orm";

import type { Db } from "./db/client";
import * as s from "./db/schema";

/** Suspends an account: it is signed out everywhere and cannot sign in again (see createAuth). */
export async function suspendUser(db: Db, userId: string, reason: string) {
  await db.update(s.user).set({ suspendedAt: new Date(), suspensionReason: reason }).where(eq(s.user.id, userId));
  await db.delete(s.session).where(eq(s.session.userId, userId));
}

export async function unsuspendUser(db: Db, userId: string) {
  await db.update(s.user).set({ suspendedAt: null, suspensionReason: null }).where(eq(s.user.id, userId));
}

export async function removeAvatar(db: Db, userId: string) {
  await db.delete(s.avatars).where(eq(s.avatars.userId, userId));
  await db.update(s.profiles).set({ avatarUrl: null }).where(eq(s.profiles.userId, userId));
}
