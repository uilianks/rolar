// Local API: PGlite in .data/pglite (no Docker, no Neon account), migrated on start.
import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";

import { loadEnv } from "./env";
import { buildApp } from "./main";

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL.startsWith("postgres")) mkdirSync(env.DATABASE_URL, { recursive: true });
  const { app, handle } = await buildApp(env);
  await handle.migrate();
  const port = Number(process.env.PORT ?? 8799);
  serve({ fetch: app.fetch, port });
  console.info(`API em http://localhost:${port}/api (banco: ${env.DATABASE_URL})`);
}

void main();
