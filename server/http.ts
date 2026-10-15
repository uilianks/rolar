import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

import { messages, validationMessage, type Locale, type Messages } from "../src/shared/i18n";
import type { Auth } from "./auth";
import type { Db } from "./db/client";

export type AppEnv = {
  Variables: { locale: Locale; db: Db; auth: Auth; userId: string | null; isAdmin: boolean; adminEmails: string[] };
};

type Errors = Messages["errors"];
export type ErrorKey = keyof Errors;
type ErrorArgs<K extends ErrorKey> = Errors[K] extends (...args: infer A) => string ? A : [];

/** An API error by dictionary key; the error handler words it in the request's language. */
export class Failure extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409,
    public key: ErrorKey,
    public args: unknown[],
  ) {
    super(status, { message: key });
  }

  text(m: Messages) {
    const entry = m.errors[this.key] as string | ((...args: unknown[]) => string);
    return typeof entry === "function" ? entry(...this.args) : entry;
  }
}

export function fail<K extends ErrorKey>(status: 400 | 401 | 403 | 404 | 409, key: K, ...args: ErrorArgs<K>): never {
  throw new Failure(status, key, args);
}

/** The dictionary of the request's language (Accept-Language). */
export function t(c: Context<AppEnv>): Messages {
  return messages(c.get("locale"));
}

export async function body<T extends z.ZodType>(c: Context<AppEnv>, schema: T): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => fail(400, "invalidJson"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const m = t(c);
    throw new HTTPException(400, { message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${validationMessage(m, i.message)}`).join("; ") });
  }
  return parsed.data;
}

export function viewer(c: Context<AppEnv>): string {
  const id = c.get("userId");
  if (!id) fail(401, "signIn");
  return id;
}

export function admin(c: Context<AppEnv>): string {
  const id = viewer(c);
  if (!c.get("isAdmin")) fail(403, "adminsOnly");
  return id;
}

/** Unique-violation (23505) from Postgres, through either driver. */
export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}
