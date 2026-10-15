import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  /** postgres:// URL (Neon) or a local PGlite directory; empty = in-memory PGlite. */
  DATABASE_URL: z.string().default(".data/pglite"),
  BETTER_AUTH_URL: z.url().default("http://localhost:8799"),
  BETTER_AUTH_SECRET: z.string().min(32).default("dev-secret-dev-secret-dev-secret-0000"),
  /** Comma-separated origins allowed to call the API with credentials (web app, app scheme). */
  TRUSTED_ORIGINS: z
    .string()
    .default("http://localhost:8081,rolar://")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  /** Comma-separated e-mails with access to the admin panel (academy verification). */
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("rolar <login@mail.rolar.app>"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // On Vercel the deployment URL is known without configuration (VERCEL_ENV/VERCEL_URL are system variables).
  const vercelHost =
    source.VERCEL_ENV === "production" ? source.VERCEL_PROJECT_PRODUCTION_URL : source.VERCEL_URL;
  const env = schema.parse({
    ...source,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL ?? (vercelHost ? `https://${vercelHost}` : undefined),
  });
  // The web app is served from the API's own origin.
  const own = new URL(env.BETTER_AUTH_URL).origin;
  if (!env.TRUSTED_ORIGINS.includes(own)) env.TRUSTED_ORIGINS.push(own);
  if (env.NODE_ENV === "production" && env.BETTER_AUTH_SECRET.startsWith("dev-secret")) {
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  }
  // Without it the API would quietly fall back to a local PGlite folder (lost on every deploy).
  if (source.VERCEL_ENV && !env.DATABASE_URL.startsWith("postgres")) {
    throw new Error("DATABASE_URL must point to Postgres (Neon) on Vercel");
  }
  return env;
}
