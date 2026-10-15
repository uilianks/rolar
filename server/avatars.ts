// Profile photo bytes. On Vercel they live in the private Blob store (BLOB_STORE_ID, OIDC auth); without
// Blob credentials (local dev, tests) they stay in the `avatars` table. Photos saved in the table before
// Blob was set up are still served from there until the person changes or removes them.
import { del, get, put } from "@vercel/blob";
import { eq } from "drizzle-orm";

import type { Db } from "./db/client";
import * as s from "./db/schema";

const blobEnabled = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const pathname = (userId: string) => `avatars/${userId}`;

export async function saveAvatar(db: Db, userId: string, mime: string, bytes: Buffer) {
  if (blobEnabled()) {
    await put(pathname(userId), bytes, { access: "private", contentType: mime, addRandomSuffix: false, allowOverwrite: true });
    await db.delete(s.avatars).where(eq(s.avatars.userId, userId));
  } else {
    const data = bytes.toString("base64");
    await db
      .insert(s.avatars)
      .values({ userId, mime, data })
      .onConflictDoUpdate({ target: s.avatars.userId, set: { mime, data, updatedAt: new Date() } });
  }
  // A new URL on every change, so the photo can be cached forever.
  const avatarUrl = `/api/avatars/${userId}?v=${Date.now().toString(36)}`;
  await db.update(s.profiles).set({ avatarUrl }).where(eq(s.profiles.userId, userId));
  return avatarUrl;
}

export async function readAvatar(db: Db, userId: string): Promise<{ mime: string; bytes: Uint8Array<ArrayBuffer> } | null> {
  if (blobEnabled()) {
    // No CDN cache: an overwritten photo must not come back stale under its new versioned URL.
    const b = await get(pathname(userId), { access: "private", useCache: false });
    if (b?.statusCode === 200) return { mime: b.blob.contentType, bytes: new Uint8Array(await new Response(b.stream).arrayBuffer()) };
  }
  const [a] = await db.select({ mime: s.avatars.mime, data: s.avatars.data }).from(s.avatars).where(eq(s.avatars.userId, userId));
  return a ? { mime: a.mime, bytes: new Uint8Array(Buffer.from(a.data, "base64")) } : null;
}

/** Also called before the account is deleted: the table row cascades, the Blob file does not. */
export async function removeAvatar(db: Db, userId: string) {
  if (blobEnabled()) await del(pathname(userId));
  await db.delete(s.avatars).where(eq(s.avatars.userId, userId));
  await db.update(s.profiles).set({ avatarUrl: null }).where(eq(s.profiles.userId, userId));
}
