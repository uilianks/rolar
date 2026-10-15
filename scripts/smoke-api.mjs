// Loads the bundled Vercel function the way Vercel does: an ESM file on its own, with no node_modules
// next to it, then calls it once. Catches module-format and bundling errors (a dependency left out of
// the bundle, CommonJS where ESM is needed) that unit tests, which run the TypeScript sources, cannot see.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "rolar-fn-"));
copyFileSync(".vercel/output/functions/api.func/index.mjs", join(dir, "index.mjs"));

// Production settings; the database is never reached by /api/health (the pool connects lazily).
Object.assign(process.env, {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  BETTER_AUTH_URL: "https://rolar.app",
  BETTER_AUTH_SECRET: "smoke-test-secret-smoke-test-secret-00",
  DATABASE_URL: "postgres://smoke:smoke@localhost:5/smoke",
});
const fn = await import(pathToFileURL(join(dir, "index.mjs")).href);
const res = await fn.GET(new Request("https://rolar.app/api/health"));
const body = await res.text();
if (res.status !== 200) {
  console.error(`API smoke test failed: ${res.status} ${body}`);
  process.exit(1);
}
console.log("API bundle OK:", body);
process.exit(0);
