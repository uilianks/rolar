import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import type { Auth } from "./auth";
import type { Db } from "./db/client";
import type { AppEnv } from "./http";
import { academiesRoutes } from "./routes/academies";
import { adminRoutes } from "./routes/admin";
import { billingRoutes } from "./routes/billing";
import { boardRoutes } from "./routes/board";
import { calendarRoutes } from "./routes/calendar";
import { classesRoutes } from "./routes/classes";
import { me } from "./routes/me";
import { promotionsRoutes } from "./routes/promotions";
import { sessionsRoutes } from "./routes/sessions";
import { social } from "./routes/social";

export function createApp({
  db,
  auth,
  trustedOrigins,
  adminEmails,
}: {
  db: Db;
  auth: Auth;
  trustedOrigins: string[];
  adminEmails: string[];
}) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use(
    "*",
    cors({
      origin: (origin) => (trustedOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("userId", session?.user.id ?? null);
    // Login proves the e-mail (code or Google), so the admin list is a list of e-mails.
    c.set("isAdmin", !!session?.user.emailVerified && adminEmails.includes(session.user.email.toLowerCase()));
    c.set("adminEmails", adminEmails);
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/me", me);
  app.route("/", sessionsRoutes);
  app.route("/", social);
  app.route("/", academiesRoutes);
  app.route("/", promotionsRoutes);
  app.route("/", classesRoutes);
  app.route("/", calendarRoutes);
  app.route("/", boardRoutes);
  app.route("/", billingRoutes);
  app.route("/admin", adminRoutes);

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Erro interno" }, 500);
  });
  app.notFound((c) => c.json({ error: "Rota não encontrada" }, 404));

  return app;
}
