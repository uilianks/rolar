// Loads the bundled Vercel function (as Vercel does: ESM) and calls it once. Catches module-format and
// bundling errors that unit tests, which run the TypeScript sources, cannot see.
import { pathToFileURL } from "node:url";

const fn = await import(pathToFileURL(".vercel/output/functions/api.func/index.mjs").href);
const res = await fn.GET(new Request("http://localhost/api/health"));
const body = await res.text();
if (res.status !== 200) {
  console.error(`API smoke test failed: ${res.status} ${body}`);
  process.exit(1);
}
console.log("API bundle OK:", body);
process.exit(0);
