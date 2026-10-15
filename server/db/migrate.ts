// Applies pending migrations to DATABASE_URL (run during the Vercel build and locally).
import { createDb } from "./client";
import { loadEnv } from "../env";

async function main() {
  const handle = await createDb(loadEnv().DATABASE_URL);
  await handle.migrate();
  await handle.close();
  console.info("Migrações aplicadas");
}

void main();
