// Assembles the deployment in Vercel's Build Output API format (.vercel/output):
//   static/            the Expo web export (dist/)
//   functions/api.func one ESM bundle of the API, so ESM-only packages (better-auth) load as ESM
//   config.json        /api/* → the function, files as they are, everything else → the SPA
// Vercel's own TypeScript compile emitted CommonJS for the API, which cannot require() better-auth.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = ".vercel/output";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/functions/api.func`, { recursive: true });

cpSync("dist", `${OUT}/static`, { recursive: true });

await build({
  entryPoints: ["server/vercel.ts"],
  outfile: `${OUT}/functions/api.func/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: "linked",
  // Production uses Neon; the PGlite driver is development-only. ws's native speed-ups are optional.
  external: ["@electric-sql/pglite", "@electric-sql/pglite/*", "bufferutil", "utf-8-validate"],
  // Some bundled CommonJS dependencies call require() for Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "warning",
});

writeFileSync(
  `${OUT}/functions/api.func/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs24.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 10, supportsResponseStreaming: true }, null, 2),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/api(/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        { src: "^/.*$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("Vercel output ready:", OUT);
