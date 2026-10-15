import { createApp } from "./app";
import { createAuth, type LoginCodeSender } from "./auth";
import { createDb } from "./db/client";
import { type Env, loadEnv } from "./env";

/** Wires database, auth and routes from the environment; shared by the dev server, Vercel and tests. */
export async function buildApp(env: Env = loadEnv(), sendLoginCode?: LoginCodeSender) {
  const handle = await createDb(env.DATABASE_URL);
  const auth = createAuth(handle.db, env, sendLoginCode);
  return { app: createApp({ db: handle.db, auth, trustedOrigins: env.TRUSTED_ORIGINS, adminEmails: env.ADMIN_EMAILS }), handle, env };
}
