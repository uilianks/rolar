// One Drizzle database type for both drivers: Neon (production/preview) and PGlite (local dev, tests).
// Drivers are imported lazily so the Vercel function never bundles PGlite's WASM.
import type { PgliteDatabase } from "drizzle-orm/pglite";
import path from "node:path";

import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;
export type DbHandle = { db: Db; migrate: () => Promise<void>; close: () => Promise<void> };

const MIGRATIONS = path.resolve(process.cwd(), "server/db/migrations");

/** Host of the Postgres + Neon proxy from compose.yaml (resolves to localhost). */
const LOCAL_NEON_HOST = "db.localtest.me";

/** Neon when `url` is a postgres:// URL; otherwise PGlite stored in directory `url` (in memory when empty). */
export async function createDb(url: string | undefined): Promise<DbHandle> {
  if (url?.startsWith("postgres")) {
    const [{ Pool, neonConfig }, { drizzle }, { migrate }, ws] = await Promise.all([
      import("@neondatabase/serverless"),
      import("drizzle-orm/neon-serverless"),
      import("drizzle-orm/neon-serverless/migrator"),
      import("ws"),
    ]);
    neonConfig.webSocketConstructor = ws.default;
    if (new URL(url).hostname === LOCAL_NEON_HOST) {
      neonConfig.wsProxy = (host) => `${host}:4444/v2`;
      neonConfig.useSecureWebSocket = false;
      neonConfig.pipelineTLS = false;
      neonConfig.pipelineConnect = false;
    }
    const pool = new Pool({ connectionString: url });
    const db = drizzle({ client: pool, schema });
    return {
      // Both drivers expose the same query builder; the PGlite type stands in for the shared surface.
      db: db as unknown as Db,
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }),
      close: () => pool.end(),
    };
  }
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = new PGlite(url || undefined);
  const db = drizzle({ client, schema });
  return { db, migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }), close: () => client.close() };
}
