import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

import type { Auth } from "./auth";
import type { Db } from "./db/client";

export type AppEnv = {
  Variables: { db: Db; auth: Auth; userId: string | null; isAdmin: boolean; adminEmails: string[] };
};

export function fail(status: 400 | 401 | 403 | 404 | 409, message: string): never {
  throw new HTTPException(status, { message });
}

export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => fail(400, "JSON inválido"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) fail(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return parsed.data;
}

export function viewer(c: Context<AppEnv>): string {
  const id = c.get("userId");
  if (!id) fail(401, "Faça login");
  return id;
}

export function admin(c: Context<AppEnv>): string {
  const id = viewer(c);
  if (!c.get("isAdmin")) fail(403, "Só administradores");
  return id;
}

/** Unique-violation (23505) from Postgres, through either driver. */
export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}
